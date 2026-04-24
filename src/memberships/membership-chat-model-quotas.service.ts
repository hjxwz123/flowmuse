import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AiModelType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const QUOTA_CACHE_TTL_SECONDS = 60 * 60;
const ARCHIVED_CHAT_MODEL_NAME_PREFIX = '[DELETED#';

type MembershipChatQuotaMap = Record<string, number>;
type MembershipPermissions = {
  chat?: {
    modelDailyLimits?: Record<string, number>;
  };
  [key: string]: unknown;
};

@Injectable()
export class MembershipChatModelQuotasService {
  private readonly logger = new Logger(MembershipChatModelQuotasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getDailyLimit(levelId: bigint, modelId: bigint): Promise<number | null> {
    const quotaMap = await this.getQuotaMap(levelId);
    const raw = quotaMap[modelId.toString()];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return null;
    }
    return Math.max(0, Math.floor(raw));
  }

  async getQuotaMap(levelId: bigint): Promise<MembershipChatQuotaMap> {
    const cacheKey = this.buildCacheKey(levelId);

    try {
      const cached = await this.redis.getJson<MembershipChatQuotaMap>(cacheKey);
      if (cached && typeof cached === 'object' && !Array.isArray(cached)) {
        return this.normalizeQuotaMap(cached);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to read membership chat model quota cache: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const fresh = await this.loadQuotaMapFromDb(levelId);

    try {
      await this.redis.setJson(cacheKey, fresh, QUOTA_CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(
        `Failed to write membership chat model quota cache: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return fresh;
  }

  async clearCache(levelId: bigint) {
    try {
      await this.redis.del(this.buildCacheKey(levelId));
    } catch (error) {
      this.logger.warn(
        `Failed to clear membership chat model quota cache: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getAdminQuotaConfig(levelId: bigint) {
    const level = await this.prisma.membershipLevel.findUnique({
      where: { id: levelId },
      select: {
        id: true,
        name: true,
        color: true,
        isActive: true,
        permissions: true,
      },
    });
    if (!level) {
      throw new NotFoundException('Membership level not found');
    }

    const [models, quotaMap] = await Promise.all([
      this.prisma.aiModel.findMany({
        where: {
          type: AiModelType.chat,
          name: { not: { startsWith: ARCHIVED_CHAT_MODEL_NAME_PREFIX } },
        },
        select: {
          id: true,
          name: true,
          modelKey: true,
          icon: true,
          description: true,
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      Promise.resolve(this.extractQuotaMap(level.permissions)),
    ]);

    return {
      level: {
        id: level.id,
        name: level.name,
        color: level.color,
        isActive: level.isActive,
      },
      items: models.map((model) => ({
        modelId: model.id,
        modelName: model.name,
        modelKey: model.modelKey,
        icon: model.icon,
        description: model.description,
        isActive: model.isActive,
        dailyLimit: quotaMap[model.id.toString()] ?? null,
      })),
    };
  }

  async replaceAdminQuotaConfig(
    levelId: bigint,
    items: Array<{ modelId: string; dailyLimit: number | null | undefined }>,
  ) {
    const level = await this.prisma.membershipLevel.findUnique({
      where: { id: levelId },
      select: {
        id: true,
        permissions: true,
      },
    });
    if (!level) {
      throw new NotFoundException('Membership level not found');
    }

    const normalized = this.normalizeAdminItems(items);
    const modelIds = normalized.map((item) => item.modelId);

    if (modelIds.length > 0) {
      const models = await this.prisma.aiModel.findMany({
        where: {
          id: { in: modelIds },
          type: AiModelType.chat,
          name: { not: { startsWith: ARCHIVED_CHAT_MODEL_NAME_PREFIX } },
        },
        select: { id: true },
      });
      const found = new Set(models.map((item) => item.id.toString()));
      const missing = normalized.find((item) => !found.has(item.modelId.toString()));
      if (missing) {
        throw new BadRequestException(`Chat model not found: ${missing.modelId.toString()}`);
      }
    }

    const nextPermissions = this.mergeQuotaMapIntoPermissions(level.permissions, normalized);
    const permissionsValue =
      Object.keys(nextPermissions).length > 0 ? (nextPermissions as Prisma.InputJsonValue) : Prisma.JsonNull;

    await this.prisma.membershipLevel.update({
      where: { id: levelId },
      data: {
        permissions: permissionsValue,
      },
    });

    const fresh = this.extractQuotaMap(nextPermissions as Prisma.JsonValue);
    try {
      await this.redis.setJson(this.buildCacheKey(levelId), fresh, QUOTA_CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(
        `Failed to refresh membership chat model quota cache: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return this.getAdminQuotaConfig(levelId);
  }

  private buildCacheKey(levelId: bigint) {
    return `membership:chat-model-quotas:${levelId.toString()}`;
  }

  private normalizeQuotaMap(input: MembershipChatQuotaMap) {
    const next: MembershipChatQuotaMap = {};
    for (const [key, value] of Object.entries(input)) {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0) continue;
      next[key] = parsed;
    }
    return next;
  }

  private async loadQuotaMapFromDb(levelId: bigint): Promise<MembershipChatQuotaMap> {
    const level = await this.prisma.membershipLevel.findUnique({
      where: { id: levelId },
      select: { permissions: true },
    });

    if (!level) {
      return {};
    }

    return this.extractQuotaMap(level.permissions);
  }

  private extractQuotaMap(raw: Prisma.JsonValue | null): MembershipChatQuotaMap {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }

    const permissions = raw as MembershipPermissions;
    const quotaMap = permissions.chat?.modelDailyLimits;
    if (!quotaMap || typeof quotaMap !== 'object' || Array.isArray(quotaMap)) {
      return {};
    }

    return this.normalizeQuotaMap(quotaMap);
  }

  private mergeQuotaMapIntoPermissions(
    raw: Prisma.JsonValue | null,
    items: Array<{ modelId: bigint; dailyLimit: number }>,
  ): MembershipPermissions {
    const permissions: MembershipPermissions =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? JSON.parse(JSON.stringify(raw)) as MembershipPermissions
        : {};

    const quotaMap = items.reduce<MembershipChatQuotaMap>((accumulator, item) => {
      accumulator[item.modelId.toString()] = item.dailyLimit;
      return accumulator;
    }, {});

    if (Object.keys(quotaMap).length === 0) {
      if (permissions.chat && typeof permissions.chat === 'object') {
        delete permissions.chat.modelDailyLimits;
        if (Object.keys(permissions.chat).length === 0) {
          delete permissions.chat;
        }
      }
      return permissions;
    }

    permissions.chat = {
      ...(permissions.chat && typeof permissions.chat === 'object' ? permissions.chat : {}),
      modelDailyLimits: quotaMap,
    };

    return permissions;
  }

  private normalizeAdminItems(items: Array<{ modelId: string; dailyLimit: number | null | undefined }>) {
    const normalized = new Map<string, { modelId: bigint; dailyLimit: number }>();

    for (const item of items) {
      if (!item || typeof item.modelId !== 'string') continue;

      let modelId: bigint;
      try {
        modelId = BigInt(item.modelId);
      } catch {
        throw new BadRequestException(`Invalid chat model id: ${item.modelId}`);
      }

      if (item.dailyLimit === null || item.dailyLimit === undefined) {
        continue;
      }

      const parsedLimit = Number(item.dailyLimit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 0) {
        throw new BadRequestException('dailyLimit must be a non-negative integer or null');
      }

      normalized.set(modelId.toString(), {
        modelId,
        dailyLimit: parsedLimit,
      });
    }

    return Array.from(normalized.values());
  }
}
