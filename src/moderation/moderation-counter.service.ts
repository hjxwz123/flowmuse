import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ModerationCounterService {
  private readonly logger = new Logger(ModerationCounterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getChatBlockedCount(userId: bigint) {
    return this.getCounter(
      this.getChatCounterKey(userId),
      async () => this.prisma.chatModerationLog.count({ where: { userId } }),
      'getChatBlockedCount',
    );
  }

  async incrementChatBlockedCount(userId: bigint) {
    return this.incrementCounter(
      this.getChatCounterKey(userId),
      async () => this.prisma.chatModerationLog.count({ where: { userId } }),
      'incrementChatBlockedCount',
    );
  }

  async getInputBlockedCount(userId: bigint) {
    return this.getCounter(
      this.getInputCounterKey(userId),
      async () => this.countInputModerationLogs(userId),
      'getInputBlockedCount',
    );
  }

  async incrementInputBlockedCount(userId: bigint) {
    return this.incrementCounter(
      this.getInputCounterKey(userId),
      async () => this.countInputModerationLogs(userId),
      'incrementInputBlockedCount',
    );
  }

  private async getCounter(
    key: string,
    seedLoader: () => Promise<number>,
    label: string,
  ): Promise<number> {
    try {
      const cached = await this.redis.get(key);
      if (cached !== null) {
        const parsed = Number(cached);
        return Number.isFinite(parsed) ? parsed : 0;
      }

      const seeded = await seedLoader();
      await this.redis.setNx(key, String(seeded));
      const latest = await this.redis.get(key);
      const parsed = Number(latest ?? seeded);
      return Number.isFinite(parsed) ? parsed : seeded;
    } catch (error) {
      this.logger.warn(
        `[${label}] Redis counter unavailable, falling back to DB: ${error instanceof Error ? error.message : String(error)}`,
      );
      return seedLoader();
    }
  }

  private async incrementCounter(
    key: string,
    seedLoader: () => Promise<number>,
    label: string,
  ): Promise<number> {
    try {
      const cached = await this.redis.get(key);
      if (cached === null) {
        const seeded = await seedLoader();
        await this.redis.setNx(key, String(seeded));
      }

      return await this.redis.incr(key);
    } catch (error) {
      this.logger.warn(
        `[${label}] Redis counter unavailable, falling back to DB: ${error instanceof Error ? error.message : String(error)}`,
      );
      const seeded = await seedLoader();
      return seeded + 1;
    }
  }

  private getChatCounterKey(userId: bigint) {
    return `moderation:blocked:chat:${userId.toString()}`;
  }

  private getInputCounterKey(userId: bigint) {
    return `moderation:blocked:input:${userId.toString()}`;
  }

  private async countInputModerationLogs(userId: bigint): Promise<number> {
    try {
      const rows = await this.prisma.$queryRaw<{ total: bigint | number | string }[]>(Prisma.sql`
        SELECT COUNT(1) as total
        FROM input_moderation_logs
        WHERE user_id = ${userId}
      `);
      const raw = rows[0]?.total ?? 0;
      const parsed = typeof raw === 'bigint' ? Number(raw) : Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch (error) {
      if (this.isMissingInputModerationTable(error)) return 0;
      this.logger.warn(
        `Failed to count input moderation logs: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  private isMissingInputModerationTable(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const message = JSON.stringify(error.meta ?? {});
      return error.code === 'P2010' && message.includes('input_moderation_logs');
    }

    return error instanceof Error && error.message.includes('input_moderation_logs');
  }
}
