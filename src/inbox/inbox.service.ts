import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InboxMessage, Prisma } from '@prisma/client';
import { Redis as RedisClient } from 'ioredis';
import { randomUUID } from 'node:crypto';

import { PaginatedResult, PaginationDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ApiTask } from '../common/serializers/task.serializer';
import { ApiResearchTask } from '../research/research.serializer';
import { InboxMessagesQueryDto } from './dto/inbox-messages-query.dto';

export type TaskMessageInput = {
  userId: bigint;
  taskType: 'image' | 'video';
  taskId: bigint;
  taskNo: string;
  retryCount: number;
  status: 'completed' | 'failed';
  title: string;
  content?: string | null;
  level?: 'success' | 'error' | 'info';
  resultUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
  provider?: string | null;
  modelId?: bigint | null;
  channelId?: bigint | null;
};

export type SystemMessageInput = {
  userId: bigint;
  type?: string;
  level?: 'success' | 'error' | 'info';
  title: string;
  content?: string | null;
  relatedType?: string | null;
  relatedId?: bigint | null;
  dedupKey?: string | null;
  meta?: Prisma.InputJsonValue;
};

export type InboxStreamMessage = {
  id: string;
  userId: string;
  type: string;
  level: string | null;
  title: string;
  content: string | null;
  relatedType: string | null;
  relatedId: string | null;
  dedupKey: string | null;
  meta: Prisma.JsonValue | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type InboxStreamEvent =
  | {
      type: 'snapshot';
      unreadCount: number;
    }
  | {
      type: 'message_created';
      unreadCount: number;
      message: InboxStreamMessage;
    }
  | {
      type: 'message_read';
      unreadCount: number;
      message: InboxStreamMessage;
    }
  | {
      type: 'messages_read_all';
      unreadCount: number;
      readAt: string;
    }
  | {
      type: 'message_deleted';
      unreadCount: number;
      messageId: string;
    }
  | {
      type: 'task_updated';
      task: ApiTask;
    }
  | {
      type: 'research_updated';
      task: ApiResearchTask;
    };

type InboxStreamListener = (event: InboxStreamEvent) => void;

@Injectable()
export class InboxService implements OnModuleInit, OnModuleDestroy {
  private static readonly STREAM_CHANNEL = 'inbox:stream:events';
  private static readonly UNREAD_COUNT_PREFIX = 'inbox:unread:';
  private readonly logger = new Logger(InboxService.name);
  private readonly listeners = new Map<string, Map<string, InboxStreamListener>>();
  private subscriber: RedisClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    this.subscriber = this.redis.createSubscriber('inbox-stream-subscriber');
    this.subscriber.on('message', (channel, payload) => {
      if (channel !== InboxService.STREAM_CHANNEL) return;

      try {
        const parsed = JSON.parse(payload) as { userId: string; event: InboxStreamEvent };
        this.dispatchLocalEvent(parsed.userId, parsed.event);
      } catch (error) {
        this.logger.warn(
          `Failed to parse inbox stream payload: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    try {
      await this.subscriber.subscribe(InboxService.STREAM_CHANNEL);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe inbox stream channel: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy() {
    if (!this.subscriber) return;

    await this.subscriber
      .quit()
      .catch(() => this.subscriber?.disconnect())
      .finally(() => {
        this.subscriber = null;
      });
  }

  async listMessages(userId: bigint, query: InboxMessagesQueryDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10 } = query as PaginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.InboxMessageWhereInput = {
      userId,
      ...(query.isRead ? { isRead: query.isRead === 'true' } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.inboxMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inboxMessage.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: items,
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    };
  }

  async unreadCount(userId: bigint) {
    const count = await this.getUnreadCountValue(userId);
    return { count };
  }

  async markRead(userId: bigint, id: bigint) {
    const msg = await this.prisma.inboxMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.userId !== userId) throw new ForbiddenException('No access');

    if (msg.isRead) return msg;

    const updated = await this.prisma.inboxMessage.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    const unreadCount = await this.decrementUnreadCount(userId);

    await this.publishEvent(userId, {
      type: 'message_read',
      unreadCount,
      message: this.serializeMessage(updated),
    });

    return updated;
  }

  async markAllRead(userId: bigint) {
    const readAt = new Date();
    const result = await this.prisma.inboxMessage.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt },
    });
    await this.setUnreadCountCache(userId, 0);

    if (result.count > 0) {
      await this.publishEvent(userId, {
        type: 'messages_read_all',
        unreadCount: 0,
        readAt: readAt.toISOString(),
      });
    }

    return { ok: true, updated: result.count };
  }

  async remove(userId: bigint, id: bigint) {
    const msg = await this.prisma.inboxMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.userId !== userId) throw new ForbiddenException('No access');
    await this.prisma.inboxMessage.delete({ where: { id } });
    const unreadCount = msg.isRead ? await this.getUnreadCountValue(userId) : await this.decrementUnreadCount(userId);

    await this.publishEvent(userId, {
      type: 'message_deleted',
      unreadCount,
      messageId: id.toString(),
    });

    return { ok: true };
  }

  async emitTaskMessage(input: TaskMessageInput) {
    const dedupKey = `task:${input.taskType}:${input.taskId.toString()}:${input.status}:${input.retryCount}`;

    try {
      const created = await this.prisma.inboxMessage.create({
        data: {
          userId: input.userId,
          type: input.status === 'completed' ? 'task_completed' : 'task_failed',
          level: input.level ?? (input.status === 'completed' ? 'success' : 'error'),
          title: input.title,
          content: input.content ?? null,
          relatedType: input.taskType,
          relatedId: input.taskId,
          dedupKey,
          meta: {
            taskType: input.taskType,
            taskId: input.taskId.toString(),
            taskNo: input.taskNo,
            retryCount: input.retryCount,
            status: input.status,
            provider: input.provider ?? null,
            modelId: input.modelId?.toString() ?? null,
            channelId: input.channelId?.toString() ?? null,
            resultUrl: input.resultUrl ?? null,
            thumbnailUrl: input.thumbnailUrl ?? null,
            errorMessage: input.errorMessage ?? null,
          } satisfies Prisma.JsonObject,
        },
      });
      const unreadCount = await this.incrementUnreadCount(input.userId);

      await this.publishEvent(input.userId, {
        type: 'message_created',
        unreadCount,
        message: this.serializeMessage(created),
      });
    } catch (err: any) {
      // Ignore duplicate messages (dedupKey unique).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      // Non-fatal: task completion should not fail due to inbox errors.
    }
  }

  async sendSystemMessage(input: SystemMessageInput) {
    try {
      const created = await this.prisma.inboxMessage.create({
        data: {
          userId: input.userId,
          type: input.type ?? 'system',
          level: input.level ?? 'info',
          title: input.title,
          content: input.content ?? null,
          relatedType: input.relatedType ?? null,
          relatedId: input.relatedId ?? null,
          dedupKey: input.dedupKey ?? null,
          meta: input.meta,
        },
      });
      const unreadCount = await this.incrementUnreadCount(input.userId);

      await this.publishEvent(input.userId, {
        type: 'message_created',
        unreadCount,
        message: this.serializeMessage(created),
      });
    } catch (err: any) {
      // Ignore duplicate messages (dedupKey unique).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      // Non-fatal: admin moderation should not fail due to inbox errors.
    }
  }

  subscribe(userId: bigint, listener: InboxStreamListener) {
    const key = userId.toString();
    const id = randomUUID();
    const group = this.listeners.get(key) ?? new Map<string, InboxStreamListener>();
    group.set(id, listener);
    this.listeners.set(key, group);

    return () => {
      const current = this.listeners.get(key);
      if (!current) return;
      current.delete(id);
      if (current.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  async buildSnapshotEvent(userId: bigint): Promise<InboxStreamEvent> {
    return {
      type: 'snapshot',
      unreadCount: await this.getUnreadCountValue(userId),
    };
  }

  async clearUnreadCountCache(userId: bigint) {
    await this.deleteUnreadCountCache(userId);
  }

  async publishTaskUpdate(userId: bigint, task: ApiTask) {
    await this.publishEvent(userId, {
      type: 'task_updated',
      task,
    });
  }

  async publishResearchUpdate(userId: bigint, task: ApiResearchTask) {
    await this.publishEvent(userId, {
      type: 'research_updated',
      task,
    });
  }

  private async publishEvent(userId: bigint, event: InboxStreamEvent) {
    const envelope = JSON.stringify({
      userId: userId.toString(),
      event,
    });

    try {
      await this.redis.publish(InboxService.STREAM_CHANNEL, envelope);
    } catch (error) {
      this.logger.warn(
        `Failed to publish inbox stream event via Redis, falling back to local listeners: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.dispatchLocalEvent(userId.toString(), event);
    }
  }

  private async getUnreadCountValue(userId: bigint) {
    const cached = await this.readUnreadCountCache(userId);
    if (cached !== null) return cached;

    return this.syncUnreadCountCache(userId);
  }

  private buildUnreadCountKey(userId: bigint) {
    return `${InboxService.UNREAD_COUNT_PREFIX}${userId.toString()}`;
  }

  private async readUnreadCountCache(userId: bigint): Promise<number | null> {
    const key = this.buildUnreadCountKey(userId);

    try {
      const raw = await this.redis.get(key);
      if (raw === null) return null;

      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0) {
        await this.redis.del(key);
        return null;
      }

      return parsed;
    } catch (error) {
      this.logger.warn(
        `Failed to read inbox unread cache for ${userId.toString()}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async setUnreadCountCache(userId: bigint, count: number) {
    const normalized = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;

    try {
      await this.redis.set(this.buildUnreadCountKey(userId), normalized.toString());
    } catch (error) {
      this.logger.warn(
        `Failed to write inbox unread cache for ${userId.toString()}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return normalized;
  }

  private async deleteUnreadCountCache(userId: bigint) {
    try {
      await this.redis.del(this.buildUnreadCountKey(userId));
    } catch (error) {
      this.logger.warn(
        `Failed to delete inbox unread cache for ${userId.toString()}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async syncUnreadCountCache(userId: bigint) {
    const count = await this.prisma.inboxMessage.count({ where: { userId, isRead: false } });
    return this.setUnreadCountCache(userId, count);
  }

  private async incrementUnreadCount(userId: bigint) {
    const key = this.buildUnreadCountKey(userId);
    const cached = await this.readUnreadCountCache(userId);
    if (cached === null) return this.syncUnreadCountCache(userId);

    try {
      return await this.redis.incr(key);
    } catch (error) {
      this.logger.warn(
        `Failed to increment inbox unread cache for ${userId.toString()}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.syncUnreadCountCache(userId);
    }
  }

  private async decrementUnreadCount(userId: bigint) {
    const key = this.buildUnreadCountKey(userId);
    const cached = await this.readUnreadCountCache(userId);
    if (cached === null) return this.syncUnreadCountCache(userId);

    try {
      const next = await this.redis.decr(key);
      if (next >= 0) return next;

      return this.syncUnreadCountCache(userId);
    } catch (error) {
      this.logger.warn(
        `Failed to decrement inbox unread cache for ${userId.toString()}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.syncUnreadCountCache(userId);
    }
  }

  private serializeMessage(message: InboxMessage): InboxStreamMessage {
    return {
      id: message.id.toString(),
      userId: message.userId.toString(),
      type: message.type,
      level: message.level ?? null,
      title: message.title,
      content: message.content ?? null,
      relatedType: message.relatedType ?? null,
      relatedId: message.relatedId?.toString() ?? null,
      dedupKey: message.dedupKey ?? null,
      meta: message.meta ?? null,
      isRead: message.isRead,
      readAt: message.readAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private dispatchLocalEvent(userId: string, event: InboxStreamEvent) {
    const group = this.listeners.get(userId);
    if (!group || group.size === 0) return;

    for (const listener of group.values()) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors so inbox writes remain non-fatal.
      }
    }
  }
}
