import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiChannel, ImageTask, Prisma, TaskStatus } from '@prisma/client';
import { Job } from 'bullmq';

import { AdapterFactory } from '../adapters/adapter.factory';
import { BaseImageAdapter, ImageGenerateParams, TaskStatusResponse } from '../adapters/base/base-image.adapter';
import { serializeImageTask } from '../common/serializers/task.serializer';
import { mergeTaskProviderData } from '../common/utils/task-provider-data.util';
import { CreditsService } from '../credits/credits.service';
import { EncryptionService } from '../encryption/encryption.service';
import { InboxService } from '../inbox/inbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { IMAGE_GENERATION_QUEUE } from '../queues/queue-names';
import { UpstreamThrottleService } from '../queues/upstream-throttle.service';
import { StorageService } from '../storage/storage.service';

const IMAGE_WORKER_LIMIT_MAX = Math.max(1, Number(process.env.IMAGE_WORKER_LIMIT_MAX ?? '30'));
const IMAGE_WORKER_LIMIT_DURATION_MS = Math.max(100, Number(process.env.IMAGE_WORKER_LIMIT_DURATION_MS ?? '1000'));

type TaskStateSnapshot = {
  status: TaskStatus;
  errorMessage: string | null;
  resultUrl: string | null;
  providerData: Prisma.JsonValue | null;
  providerTaskId: string | null;
  startedAt: Date | null;
};

type ProviderDataValue = Prisma.JsonValue | Prisma.InputJsonValue | null | undefined;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

function jsonEquals(left: ProviderDataValue, right: ProviderDataValue) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

@Injectable()
@Processor(IMAGE_GENERATION_QUEUE, {
  limiter: {
    max: IMAGE_WORKER_LIMIT_MAX,
    duration: IMAGE_WORKER_LIMIT_DURATION_MS,
  },
})
export class ImageTaskProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly storage: StorageService,
    private readonly credits: CreditsService,
    private readonly inbox: InboxService,
    private readonly config: ConfigService,
    private readonly projects: ProjectsService,
    private readonly upstreamThrottle: UpstreamThrottleService,
  ) {
    super();
  }

  async process(job: Job<{ taskId: string }>) {
    if (job.name !== 'generate') return;
    const taskId = BigInt(job.data.taskId);

    const task = await this.prisma.imageTask.findUnique({ where: { id: taskId } });
    if (!task) return;
    if (task.status === TaskStatus.completed || task.status === TaskStatus.failed) return;

    const model = await this.prisma.aiModel.findUnique({ where: { id: task.modelId } });
    if (!model) throw new Error('Model not found');

    const channel = await this.prisma.apiChannel.findUnique({ where: { id: task.channelId } });
    if (!channel) throw new Error('Channel not found');

    const decryptedChannel = {
      ...channel,
      apiKey: this.encryption.decryptString(channel.apiKey),
      apiSecret: this.encryption.decryptString(channel.apiSecret),
    };

    const adapter = AdapterFactory.createImageAdapter(model.provider, decryptedChannel as any);
    const params = this.buildTaskParams(task, model, taskId);
    const validation = adapter.validateParams(params);

    if (!validation.valid) {
      await this.markFailedAndRefund(task, taskId, validation.errors?.join(', ') ?? 'Invalid params');
      return;
    }

    try {
      const providerTaskId =
        task.providerTaskId && task.status === TaskStatus.processing
          ? task.providerTaskId
          : await this.submitTask(adapter, params, channel);

      if (typeof providerTaskId === 'string' && (providerTaskId.startsWith('url:') || providerTaskId.startsWith('inline:'))) {
        await this.ensureProcessingState(taskId, task, null);

        const status = await this.queryStatus(adapter, providerTaskId, channel);
        const output = status.resultUrls?.[0] ?? providerTaskId.slice(providerTaskId.indexOf(':') + 1);
        if (!output) {
          await this.markFailedAndRefund(task, taskId, 'Missing result');
          return;
        }

        const stored = await this.storage.saveImageResult(output, task.taskNo);
        const providerData = mergeTaskProviderData(task.providerData, status.providerData);
        await this.markCompleted(task, taskId, stored.original.url, stored.thumbnail.url, stored.original.ossKey, providerData);
        return;
      }

      await this.ensureProcessingState(taskId, task, providerTaskId);

      const pollConfig = this.getPollConfig(task.provider, params);
      let delayMs = pollConfig.initialDelayMs;
      const deadline = Date.now() + pollConfig.maxDurationMs;

      while (Date.now() < deadline) {
        await sleep(delayMs);
        delayMs = Math.min(pollConfig.maxDelayMs, Math.ceil(delayMs * 1.8));

        const latestState = await this.getTaskState(taskId);
        if (!latestState) return;
        if (latestState.status === TaskStatus.completed && latestState.resultUrl) return;
        if (latestState.status === TaskStatus.failed && latestState.errorMessage === 'CANCELED') return;

        const status = await this.queryStatus(adapter, providerTaskId, channel);
        const providerStatus =
          status.providerData && typeof status.providerData === 'object'
            ? (status.providerData as Record<string, unknown>).status
            : undefined;

        if (providerStatus === 'MODAL') {
          const providerData = mergeTaskProviderData(latestState.providerData, status.providerData);
          await this.markModal(taskId, latestState, providerData);
          return;
        }

        if (status.status === 'completed') {
          const resultUrls = status.resultUrls?.length
            ? status.resultUrls
            : await this.getTaskResult(adapter, providerTaskId, channel);
          const output = resultUrls?.[0];
          if (!output) {
            await this.markFailedAndRefund(task, taskId, 'Missing result');
            return;
          }

          const stored = await this.storage.saveImageResult(output, task.taskNo);
          const providerData = mergeTaskProviderData(latestState.providerData, status.providerData);
          await this.markCompleted(task, taskId, stored.original.url, stored.thumbnail.url, stored.original.ossKey, providerData);
          return;
        }

        if (status.status === 'failed') {
          const providerData = mergeTaskProviderData(latestState.providerData, status.providerData);
          await this.markFailedAndRefund(task, taskId, status.errorMessage ?? 'Task failed', providerData);
          return;
        }
      }

      const latestState = await this.getTaskState(taskId);
      if (!latestState) return;
      if (latestState.status === TaskStatus.completed) return;
      if (latestState.status === TaskStatus.failed) return;

      await this.markFailedAndRefund(task, taskId, 'Task timeout', latestState.providerData);
    } catch (error: any) {
      const latestState = await this.getTaskState(taskId);
      if (latestState?.status === TaskStatus.completed) return;
      if (latestState?.status === TaskStatus.failed) return;

      const upstream = error?.response?.data;
      const providerData = mergeTaskProviderData(latestState?.providerData ?? task.providerData, upstream);
      await this.markFailedAndRefund(task, taskId, error?.message ?? 'Task failed', providerData);
    }
  }

  private buildTaskParams(task: ImageTask, model: { defaultParams: Prisma.JsonValue | null; modelKey: string }, taskId: bigint) {
    const modelDefaultParams: Record<string, unknown> =
      model.defaultParams && typeof model.defaultParams === 'object'
        ? ({ ...(model.defaultParams as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const taskParams: Record<string, unknown> =
      task.parameters && typeof task.parameters === 'object'
        ? ({ ...(task.parameters as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    const params: ImageGenerateParams = {
      ...modelDefaultParams,
      ...taskParams,
      prompt: task.prompt,
      negativePrompt: task.negativePrompt ?? undefined,
    };

    if (model.modelKey && !(params as Record<string, unknown>).model) {
      (params as Record<string, unknown>).model = model.modelKey;
    }

    const appPublicUrl = (this.config.get<string>('APP_PUBLIC_URL') ?? '').trim();
    const defaultNotifyHook = appPublicUrl ? `${stripTrailingSlash(appPublicUrl)}/api/webhooks/midjourney` : undefined;
    (params as Record<string, unknown>).notifyHook =
      (params as Record<string, unknown>).notifyHook ?? defaultNotifyHook;
    (params as Record<string, unknown>).state = (params as Record<string, unknown>).state ?? `task:${taskId.toString()}`;

    return params;
  }

  private getPollConfig(provider: string, params: ImageGenerateParams) {
    const preferWebhook =
      provider === 'midjourney'
      && typeof (params as Record<string, unknown>).notifyHook === 'string'
      && String((params as Record<string, unknown>).notifyHook).trim().length > 0;

    return {
      initialDelayMs: preferWebhook ? 15_000 : 5_000,
      maxDelayMs: preferWebhook ? 120_000 : 45_000,
      maxDurationMs: preferWebhook ? 20 * 60_000 : 10 * 60_000,
    };
  }

  private async submitTask(adapter: BaseImageAdapter, params: ImageGenerateParams, channel: ApiChannel) {
    await this.upstreamThrottle.waitForChannelTurn(channel.provider, channel.id, channel.rateLimit);
    return adapter.submitTask(params);
  }

  private async queryStatus(adapter: BaseImageAdapter, providerTaskId: string, channel: ApiChannel): Promise<TaskStatusResponse> {
    await this.upstreamThrottle.waitForChannelTurn(channel.provider, channel.id, channel.rateLimit);
    return adapter.queryTaskStatus(providerTaskId);
  }

  private async getTaskResult(adapter: BaseImageAdapter, providerTaskId: string, channel: ApiChannel) {
    await this.upstreamThrottle.waitForChannelTurn(channel.provider, channel.id, channel.rateLimit);
    return adapter.getTaskResult(providerTaskId);
  }

  private async ensureProcessingState(taskId: bigint, task: ImageTask, providerTaskId: string | null) {
    const nextStartedAt = task.startedAt ?? new Date();
    const shouldUpdate =
      task.status !== TaskStatus.processing
      || task.providerTaskId !== providerTaskId
      || task.errorMessage !== null
      || task.startedAt === null;

    if (!shouldUpdate) {
      return;
    }

    await this.prisma.imageTask.update({
      where: { id: taskId },
      data: {
        providerTaskId,
        status: TaskStatus.processing,
        startedAt: nextStartedAt,
        errorMessage: null,
      },
    });
    await this.publishTaskUpdate(taskId);
  }

  private async markModal(taskId: bigint, current: TaskStateSnapshot, providerData: ProviderDataValue) {
    if (current.status === TaskStatus.processing && current.errorMessage === 'MODAL' && jsonEquals(current.providerData, providerData)) {
      return;
    }

    await this.prisma.imageTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.processing,
        providerData: providerData ?? undefined,
        errorMessage: 'MODAL',
      },
    });
    await this.publishTaskUpdate(taskId);
  }

  private async markCompleted(
    task: ImageTask,
    taskId: bigint,
    resultUrl: string,
    thumbnailUrl: string,
    ossKey: string | null,
    providerData?: ProviderDataValue,
  ) {
    const latestState = await this.getTaskState(taskId);
    if (!latestState) return;
    if (latestState.status === TaskStatus.completed && latestState.resultUrl) return;

    await this.prisma.imageTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.completed,
        resultUrl,
        thumbnailUrl,
        ossKey,
        providerData: providerData ?? undefined,
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    await this.projects.syncImageTaskAsset(taskId);
    await this.publishTaskUpdate(taskId);
    await this.inbox.emitTaskMessage({
      userId: task.userId,
      taskType: 'image',
      taskId,
      taskNo: task.taskNo,
      retryCount: task.retryCount,
      status: 'completed',
      title: '图片任务已完成',
      content: task.prompt,
      resultUrl,
      thumbnailUrl,
      provider: task.provider,
      modelId: task.modelId,
      channelId: task.channelId,
    });
  }

  private async markFailedAndRefund(
    task: ImageTask,
    taskId: bigint,
    errorMessage: string,
    providerData?: ProviderDataValue,
  ) {
    const latestState = await this.getTaskState(taskId);
    if (!latestState) return;
    if (latestState.status === TaskStatus.completed) return;
    if (latestState.status === TaskStatus.failed) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.imageTask.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.failed,
          errorMessage,
          providerData: providerData ?? undefined,
          completedAt: new Date(),
        },
      });
      await this.credits.refundCredits(tx, task.userId, taskId, `Refund image task ${task.taskNo}`, {
        scopeDescriptionContains: task.taskNo,
        maxRefundAmount: typeof task.creditsCost === 'number' ? Math.max(task.creditsCost, 0) : undefined,
      });
    });

    await this.publishTaskUpdate(taskId);
    await this.inbox.emitTaskMessage({
      userId: task.userId,
      taskType: 'image',
      taskId,
      taskNo: task.taskNo,
      retryCount: task.retryCount,
      status: 'failed',
      title: errorMessage === 'Task timeout' ? '图片任务超时' : '图片任务失败',
      content: task.prompt,
      errorMessage,
      provider: task.provider,
      modelId: task.modelId,
      channelId: task.channelId,
    });
  }

  private async getTaskState(taskId: bigint): Promise<TaskStateSnapshot | null> {
    return this.prisma.imageTask.findUnique({
      where: { id: taskId },
      select: {
        status: true,
        errorMessage: true,
        resultUrl: true,
        providerData: true,
        providerTaskId: true,
        startedAt: true,
      },
    });
  }

  private async publishTaskUpdate(taskId: bigint) {
    const task = await this.prisma.imageTask.findUnique({ where: { id: taskId } });
    if (!task) return;
    await this.inbox.publishTaskUpdate(task.userId, serializeImageTask(task));
  }
}
