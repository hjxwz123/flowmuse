import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ApiChannel, Prisma, TaskStatus, VideoTask } from '@prisma/client';
import { Job } from 'bullmq';

import { AdapterFactory } from '../adapters/adapter.factory';
import { TaskStatusResponse } from '../adapters/base/base-image.adapter';
import { BaseVideoAdapter, VideoGenerateParams } from '../adapters/base/base-video.adapter';
import { serializeVideoTask } from '../common/serializers/task.serializer';
import { mergeTaskProviderData } from '../common/utils/task-provider-data.util';
import { canCancelVideoTask, supportsVideoTaskCancel } from '../common/utils/video-task-cancel.util';
import { CreditsService } from '../credits/credits.service';
import { EncryptionService } from '../encryption/encryption.service';
import { InboxService } from '../inbox/inbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { VIDEO_GENERATION_QUEUE } from '../queues/queue-names';
import { UpstreamThrottleService } from '../queues/upstream-throttle.service';
import { StorageService } from '../storage/storage.service';

const VIDEO_WORKER_LIMIT_MAX = Math.max(1, Number(process.env.VIDEO_WORKER_LIMIT_MAX ?? '20'));
const VIDEO_WORKER_LIMIT_DURATION_MS = Math.max(100, Number(process.env.VIDEO_WORKER_LIMIT_DURATION_MS ?? '1000'));

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

function toPositiveNumber(value: unknown) {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function findDurationSeconds(source: unknown): number | null {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;

  const record = source as Record<string, unknown>;
  const direct =
    toPositiveNumber(record.duration)
    ?? toPositiveNumber(record.durationSeconds)
    ?? toPositiveNumber(record.videoDuration)
    ?? toPositiveNumber(record.seconds);
  if (direct !== null) return direct;

  return findDurationSeconds(record.output)
    ?? findDurationSeconds(record.content)
    ?? findDurationSeconds(record.parameters)
    ?? findDurationSeconds(record.providerData);
}

@Injectable()
@Processor(VIDEO_GENERATION_QUEUE, {
  limiter: {
    max: VIDEO_WORKER_LIMIT_MAX,
    duration: VIDEO_WORKER_LIMIT_DURATION_MS,
  },
})
export class VideoTaskProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly storage: StorageService,
    private readonly credits: CreditsService,
    private readonly inbox: InboxService,
    private readonly projects: ProjectsService,
    private readonly upstreamThrottle: UpstreamThrottleService,
  ) {
    super();
  }

  async process(job: Job<{ taskId: string }>) {
    if (job.name !== 'generate') return;
    const taskId = BigInt(job.data.taskId);

    const task = await this.prisma.videoTask.findUnique({ where: { id: taskId } });
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

    const adapter = AdapterFactory.createVideoAdapter(model.provider, decryptedChannel as any);
    const params = this.buildTaskParams(task, model);
    const validation = adapter.validateParams(params);

    if (!validation.valid) {
      await this.markFailedAndRefund(task, taskId, validation.errors?.join(', ') ?? 'Invalid params');
      return;
    }

    try {
      const providerTaskId =
        task.providerTaskId && (task.status === TaskStatus.processing || task.status === TaskStatus.pending)
          ? task.providerTaskId
          : await this.submitTask(adapter, params, channel);

      let initialStatus: TaskStatusResponse | null = null;
      try {
        initialStatus = await this.queryStatus(adapter, providerTaskId, channel);
      } catch {
        initialStatus = null;
      }

      await this.ensureProcessingState(taskId, task, providerTaskId, initialStatus);

      const pollConfig = this.getPollConfig();
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
        const providerData = status.providerData
          ? mergeTaskProviderData(latestState.providerData, status.providerData)
          : latestState.providerData;

        if (status.status === 'pending' || status.status === 'processing') {
          await this.updateNonTerminalState(taskId, latestState, status.status, providerData);
          continue;
        }

        if (status.status === 'completed') {
          const output = status.resultUrls?.[0] ?? (await this.getTaskResult(adapter, providerTaskId, channel));
          if (!output) {
            await this.markFailedAndRefund(task, taskId, 'Missing result', providerData);
            return;
          }

          const saved = await this.storage.saveVideoResult(output, task.taskNo);
          const thumbnailDurationSeconds =
            findDurationSeconds(status.providerData)
            ?? findDurationSeconds(providerData)
            ?? findDurationSeconds(task.parameters);
          const thumbnailUrl = await this.resolveThumbnailUrl(
            status.providerData,
            saved.url,
            saved.ossKey,
            task.taskNo,
            thumbnailDurationSeconds,
          );
          await this.markCompleted(task, taskId, saved.url, thumbnailUrl, saved.ossKey, providerData);
          return;
        }

        if (status.status === 'failed') {
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

      const providerData = mergeTaskProviderData(latestState?.providerData ?? task.providerData, error?.response?.data);
      await this.markFailedAndRefund(task, taskId, error?.message ?? 'Task failed', providerData);
    }
  }

  private buildTaskParams(task: VideoTask, model: { defaultParams: Prisma.JsonValue | null; modelKey: string }) {
    const params: VideoGenerateParams = {
      ...(model.defaultParams && typeof model.defaultParams === 'object' ? (model.defaultParams as Record<string, unknown>) : {}),
      ...(typeof task.parameters === 'object' && task.parameters ? (task.parameters as Record<string, unknown>) : {}),
      prompt: task.prompt,
    };

    if (model.modelKey && !(params as Record<string, unknown>).model) {
      (params as Record<string, unknown>).model = model.modelKey;
    }

    return params;
  }

  private getPollConfig() {
    return {
      initialDelayMs: 5_000,
      maxDelayMs: 90_000,
      maxDurationMs: 20 * 60_000,
    };
  }

  private async submitTask(adapter: BaseVideoAdapter, params: VideoGenerateParams, channel: ApiChannel) {
    await this.upstreamThrottle.waitForChannelTurn(channel.provider, channel.id, channel.rateLimit);
    return adapter.submitTask(params);
  }

  private async queryStatus(adapter: BaseVideoAdapter, providerTaskId: string, channel: ApiChannel): Promise<TaskStatusResponse> {
    await this.upstreamThrottle.waitForChannelTurn(channel.provider, channel.id, channel.rateLimit);
    return adapter.queryTaskStatus(providerTaskId);
  }

  private async getTaskResult(adapter: BaseVideoAdapter, providerTaskId: string, channel: ApiChannel) {
    await this.upstreamThrottle.waitForChannelTurn(channel.provider, channel.id, channel.rateLimit);
    return adapter.getTaskResult(providerTaskId);
  }

  private async ensureProcessingState(
    taskId: bigint,
    task: VideoTask,
    providerTaskId: string,
    initialStatus: TaskStatusResponse | null,
  ) {
    const nextStatus = initialStatus?.status === 'pending' ? TaskStatus.pending : TaskStatus.processing;
    const nextProviderData = initialStatus?.providerData
      ? mergeTaskProviderData(task.providerData, initialStatus.providerData)
      : task.providerData;
    const shouldUpdate =
      task.providerTaskId !== providerTaskId
      || task.status !== nextStatus
      || task.errorMessage !== null
      || task.startedAt === null
      || (nextProviderData !== task.providerData && JSON.stringify(nextProviderData ?? null) !== JSON.stringify(task.providerData ?? null));

    if (!shouldUpdate) {
      return;
    }

    await this.prisma.videoTask.update({
      where: { id: taskId },
      data: {
        providerTaskId,
        status: nextStatus,
        startedAt: task.startedAt ?? new Date(),
        errorMessage: null,
        providerData: nextProviderData ?? undefined,
      },
    });
    await this.publishTaskUpdate(taskId);
  }

  private async updateNonTerminalState(
    taskId: bigint,
    current: TaskStateSnapshot,
    upstreamStatus: 'pending' | 'processing',
    providerData: ProviderDataValue,
  ) {
    const nextStatus = upstreamStatus === 'pending' ? TaskStatus.pending : TaskStatus.processing;
    const shouldUpdateStatus = current.status !== nextStatus;
    const shouldUpdateProviderData = shouldUpdateStatus
      && JSON.stringify(current.providerData ?? null) !== JSON.stringify(providerData ?? null);

    if (!shouldUpdateStatus && !shouldUpdateProviderData) {
      return;
    }

    await this.prisma.videoTask.update({
      where: { id: taskId },
      data: {
        ...(shouldUpdateStatus ? { status: nextStatus } : {}),
        ...(shouldUpdateProviderData ? { providerData: providerData ?? undefined } : {}),
      },
    });

    if (shouldUpdateStatus) {
      await this.publishTaskUpdate(taskId);
    }
  }

  private async resolveThumbnailUrl(
    providerData: unknown,
    savedVideoUrl: string,
    savedOssKey: string,
    taskNo: string,
    durationSeconds: number | null,
  ) {
    let thumbnailUrl: string | null = null;
    const providerThumbnail =
      providerData && typeof providerData === 'object'
        ? (providerData as Record<string, unknown>).thumbnailUrl
        : undefined;

    if (typeof providerThumbnail === 'string' && providerThumbnail.trim().length > 0) {
      try {
        const savedThumbnail = await this.storage.saveImageResult(providerThumbnail, `${taskNo}-thumbnail`);
        thumbnailUrl = savedThumbnail.original.url;
      } catch {
        thumbnailUrl = null;
      }
    }

    if (thumbnailUrl) {
      return thumbnailUrl;
    }

    try {
      const thumbnail = await this.storage.saveVideoLastFrameFromVideoUrl({
        videoUrl: savedVideoUrl,
        objectKey: savedOssKey,
        taskNo,
        durationSeconds,
      });
      return thumbnail.url;
    } catch {
      return null;
    }
  }

  private async markCompleted(
    task: VideoTask,
    taskId: bigint,
    resultUrl: string,
    thumbnailUrl: string | null,
    ossKey: string | null,
    providerData?: ProviderDataValue,
  ) {
    const latestState = await this.getTaskState(taskId);
    if (!latestState) return;
    if (latestState.status === TaskStatus.completed && latestState.resultUrl) return;

    await this.prisma.videoTask.update({
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

    await this.projects.syncVideoTaskAsset(taskId);
    await this.publishTaskUpdate(taskId);
    await this.inbox.emitTaskMessage({
      userId: task.userId,
      taskType: 'video',
      taskId,
      taskNo: task.taskNo,
      retryCount: task.retryCount,
      status: 'completed',
      title: '视频任务已完成',
      content: task.prompt,
      resultUrl,
      thumbnailUrl,
      provider: task.provider,
      modelId: task.modelId,
      channelId: task.channelId,
    });
  }

  private async markFailedAndRefund(
    task: VideoTask,
    taskId: bigint,
    errorMessage: string,
    providerData?: ProviderDataValue,
  ) {
    const latestState = await this.getTaskState(taskId);
    if (!latestState) return;
    if (latestState.status === TaskStatus.completed) return;
    if (latestState.status === TaskStatus.failed) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.videoTask.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.failed,
          errorMessage,
          providerData: providerData ?? undefined,
          completedAt: new Date(),
        },
      });
      await this.credits.refundCredits(tx, task.userId, taskId, `Refund video task ${task.taskNo}`, {
        scopeDescriptionContains: task.taskNo,
        maxRefundAmount: typeof task.creditsCost === 'number' ? Math.max(task.creditsCost, 0) : undefined,
      });
    });

    await this.publishTaskUpdate(taskId);
    await this.inbox.emitTaskMessage({
      userId: task.userId,
      taskType: 'video',
      taskId,
      taskNo: task.taskNo,
      retryCount: task.retryCount,
      status: 'failed',
      title: errorMessage === 'Task timeout' ? '视频任务超时' : '视频任务失败',
      content: task.prompt,
      errorMessage,
      provider: task.provider,
      modelId: task.modelId,
      channelId: task.channelId,
    });
  }

  private async getTaskState(taskId: bigint): Promise<TaskStateSnapshot | null> {
    return this.prisma.videoTask.findUnique({
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
    const task = await this.prisma.videoTask.findUnique({
      where: { id: taskId },
      include: {
        model: {
          select: {
            provider: true,
            modelKey: true,
          },
        },
      },
    });
    if (!task) return;
    await this.inbox.publishTaskUpdate(
      task.userId,
      serializeVideoTask(task, {
        canCancel: canCancelVideoTask(task.status, task.model.provider, task.model.modelKey),
        cancelSupported: supportsVideoTaskCancel(task.model.provider, task.model.modelKey),
      }),
    );
  }
}
