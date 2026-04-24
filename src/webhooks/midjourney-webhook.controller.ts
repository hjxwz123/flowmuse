import { BadRequestException, Body, Controller, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageTask, Prisma, TaskStatus } from '@prisma/client';

import { serializeImageTask } from '../common/serializers/task.serializer';
import { mergeTaskProviderData } from '../common/utils/task-provider-data.util';
import { CreditsService } from '../credits/credits.service';
import { InboxService } from '../inbox/inbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { StorageService } from '../storage/storage.service';

type MjCallbackPayload = {
  id: string;
  action?: string;
  status?: string;
  progress?: string;
  imageUrl?: string;
  failReason?: string | null;
  state?: string;
  properties?: Record<string, unknown>;
  buttons?: unknown[];
  [key: string]: unknown;
};

function mapMidjourneyStatus(status?: string): TaskStatus | null {
  if (!status) return null;
  if (status === 'SUCCESS') return TaskStatus.completed;
  if (status === 'FAILURE' || status === 'CANCEL') return TaskStatus.failed;
  if (status === 'NOT_START' || status === 'SUBMITTED') return TaskStatus.pending;
  if (status === 'IN_PROGRESS' || status === 'MODAL') return TaskStatus.processing;
  return null;
}

function parseStateTaskId(value: unknown): bigint | null {
  if (!value || typeof value !== 'string') return null;
  const m = value.trim().match(/^task:(\d+)$/);
  if (!m) return null;
  try {
    return BigInt(m[1]);
  } catch {
    return null;
  }
}

function jsonEquals(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

@Controller('webhooks/midjourney')
export class MidjourneyWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly credits: CreditsService,
    private readonly config: ConfigService,
    private readonly inbox: InboxService,
    private readonly projects: ProjectsService,
  ) {}

  @Post()
  async handle(@Body() payload: MjCallbackPayload, @Headers('x-webhook-secret') secretHeader?: string) {
    const secret = (this.config.get<string>('MJ_WEBHOOK_SECRET') ?? '').trim();
    if (secret && secretHeader !== secret) {
      throw new BadRequestException('Invalid webhook secret');
    }

    if (!payload?.id) throw new BadRequestException('Missing id');

    const providerTaskId = String(payload.id);
    let task = await this.prisma.imageTask.findFirst({
      where: { provider: 'midjourney', providerTaskId },
    });

    let shouldSetProviderTaskId = false;
    if (!task) {
      const state = payload.state ?? payload.properties?.state;
      const localTaskId = parseStateTaskId(state);
      if (localTaskId) {
        const byId = await this.prisma.imageTask.findUnique({ where: { id: localTaskId } });
        if (byId && byId.provider === 'midjourney' && (!byId.providerTaskId || byId.providerTaskId === providerTaskId)) {
          task = byId;
          shouldSetProviderTaskId = !byId.providerTaskId;
        }
      }
    }
    if (!task) return { ok: true, ignored: true };

    const mapped = mapMidjourneyStatus(payload.status);
    const mergedProviderData = mergeTaskProviderData(task.providerData, payload);
    const shouldUpdateProviderTaskId = shouldSetProviderTaskId ? providerTaskId : task.providerTaskId;

    if (!mapped) {
      const shouldUpdate =
        shouldUpdateProviderTaskId !== task.providerTaskId
        || !jsonEquals(task.providerData, mergedProviderData ?? null);

      if (!shouldUpdate) {
        return { ok: true, ignored: true };
      }

      await this.prisma.imageTask.update({
        where: { id: task.id },
        data: {
          providerData: mergedProviderData,
          ...(shouldSetProviderTaskId ? { providerTaskId } : {}),
        },
      });
      return { ok: true };
    }

    if (task.status === TaskStatus.completed && mapped !== TaskStatus.completed) {
      if (
        shouldUpdateProviderTaskId !== task.providerTaskId
        || !jsonEquals(task.providerData, mergedProviderData ?? null)
      ) {
        await this.prisma.imageTask.update({
          where: { id: task.id },
          data: {
            providerData: mergedProviderData,
            ...(shouldSetProviderTaskId ? { providerTaskId } : {}),
          },
        });
      }
      return { ok: true, ignored: true };
    }

    if (task.status === TaskStatus.failed && mapped !== TaskStatus.failed) {
      if (
        shouldUpdateProviderTaskId !== task.providerTaskId
        || !jsonEquals(task.providerData, mergedProviderData ?? null)
      ) {
        await this.prisma.imageTask.update({
          where: { id: task.id },
          data: {
            providerData: mergedProviderData,
            ...(shouldSetProviderTaskId ? { providerTaskId } : {}),
          },
        });
      }
      return { ok: true, ignored: true };
    }

    if (mapped === TaskStatus.processing && payload.status === 'MODAL') {
      const shouldUpdate =
        task.status !== TaskStatus.processing
        || task.errorMessage !== 'MODAL'
        || shouldUpdateProviderTaskId !== task.providerTaskId
        || !jsonEquals(task.providerData, mergedProviderData ?? null);

      if (!shouldUpdate) {
        return { ok: true, ignored: true };
      }

      await this.prisma.imageTask.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.processing,
          providerData: mergedProviderData,
          errorMessage: 'MODAL',
          ...(shouldSetProviderTaskId ? { providerTaskId } : {}),
        },
      });
      await this.publishTaskUpdate(task.id);
      return { ok: true };
    }

    if (mapped === TaskStatus.completed) {
      if (task.status === TaskStatus.completed && task.resultUrl) {
        if (
          shouldUpdateProviderTaskId !== task.providerTaskId
          || !jsonEquals(task.providerData, mergedProviderData ?? null)
        ) {
          await this.prisma.imageTask.update({
            where: { id: task.id },
            data: {
              providerData: mergedProviderData,
              ...(shouldSetProviderTaskId ? { providerTaskId } : {}),
            },
          });
        }
        await this.projects.syncImageTaskAsset(task.id);
        await this.publishTaskUpdate(task.id);
        await this.emitCompletedMessage(task, task.resultUrl, task.thumbnailUrl);
        return { ok: true, alreadyCompleted: true };
      }

      if (!payload.imageUrl) throw new BadRequestException('Missing imageUrl');
      const stored = await this.storage.saveImageResult(payload.imageUrl, task.taskNo);

      await this.prisma.imageTask.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.completed,
          resultUrl: stored.original.url,
          thumbnailUrl: stored.thumbnail.url,
          ossKey: stored.original.ossKey,
          providerData: mergedProviderData,
          completedAt: new Date(),
          errorMessage: null,
          ...(shouldSetProviderTaskId ? { providerTaskId } : {}),
        },
      });
      await this.projects.syncImageTaskAsset(task.id);
      await this.publishTaskUpdate(task.id);
      await this.emitCompletedMessage(task, stored.original.url, stored.thumbnail.url);

      return { ok: true };
    }

    if (mapped === TaskStatus.failed) {
      if (task.status === TaskStatus.failed) {
        if (
          shouldUpdateProviderTaskId !== task.providerTaskId
          || !jsonEquals(task.providerData, mergedProviderData ?? null)
        ) {
          await this.prisma.imageTask.update({
            where: { id: task.id },
            data: {
              providerData: mergedProviderData,
              ...(shouldSetProviderTaskId ? { providerTaskId } : {}),
            },
          });
        }
        await this.publishTaskUpdate(task.id);
        await this.emitFailedMessage(task, task.errorMessage ?? payload.failReason ?? 'Task failed');
        return { ok: true, alreadyFailed: true };
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.imageTask.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.failed,
            providerData: mergedProviderData,
            errorMessage: payload.failReason ?? 'Task failed',
            completedAt: new Date(),
            ...(shouldSetProviderTaskId ? { providerTaskId } : {}),
          },
        });
        await this.credits.refundCredits(tx, task.userId, task.id, `Refund image task ${task.taskNo}`, {
          scopeDescriptionContains: task.taskNo,
          maxRefundAmount: typeof task.creditsCost === 'number' ? Math.max(task.creditsCost, 0) : undefined,
        });
      });
      await this.publishTaskUpdate(task.id);
      await this.emitFailedMessage(task, payload.failReason ?? 'Task failed');

      return { ok: true };
    }

    const shouldUpdate =
      task.status !== mapped
      || shouldUpdateProviderTaskId !== task.providerTaskId
      || !jsonEquals(task.providerData, mergedProviderData ?? null)
      || task.errorMessage !== null;

    if (!shouldUpdate) {
      return { ok: true, ignored: true };
    }

    await this.prisma.imageTask.update({
      where: { id: task.id },
      data: {
        status: mapped,
        providerData: mergedProviderData,
        errorMessage: null,
        ...(shouldSetProviderTaskId ? { providerTaskId } : {}),
      },
    });
    await this.publishTaskUpdate(task.id);

    return { ok: true };
  }

  private async publishTaskUpdate(taskId: bigint) {
    const task = await this.prisma.imageTask.findUnique({ where: { id: taskId } });
    if (!task) return;
    await this.inbox.publishTaskUpdate(task.userId, serializeImageTask(task));
  }

  private async emitCompletedMessage(task: ImageTask, resultUrl: string, thumbnailUrl: string | null) {
    await this.inbox.emitTaskMessage({
      userId: task.userId,
      taskType: 'image',
      taskId: task.id,
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

  private async emitFailedMessage(task: ImageTask, errorMessage: string) {
    await this.inbox.emitTaskMessage({
      userId: task.userId,
      taskType: 'image',
      taskId: task.id,
      taskNo: task.taskNo,
      retryCount: task.retryCount,
      status: 'failed',
      title: '图片任务失败',
      content: task.prompt,
      errorMessage,
      provider: task.provider,
      modelId: task.modelId,
      channelId: task.channelId,
    });
  }
}
