import { Injectable, Logger } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

import { RedisService } from '../redis/redis.service';

type AuthUserCacheRecord = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  banReason: string | null;
  banExpireAt: string | null;
};

export type AuthUserSnapshot = {
  id: bigint;
  email: string;
  role: UserRole;
  status: UserStatus;
  banReason: string | null;
  banExpireAt: Date | null;
};

@Injectable()
export class AuthUserCacheService {
  private static readonly TTL_SECONDS = 60 * 3;
  private readonly logger = new Logger(AuthUserCacheService.name);

  constructor(private readonly redis: RedisService) {}

  async get(userId: bigint): Promise<AuthUserSnapshot | null> {
    const key = this.buildKey(userId);

    try {
      const payload = await this.redis.getJson<AuthUserCacheRecord>(key);
      return this.deserialize(payload);
    } catch (error) {
      this.logger.warn(
        `Failed to read auth user cache for ${userId.toString()}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async set(snapshot: AuthUserSnapshot) {
    const key = this.buildKey(snapshot.id);

    try {
      await this.redis.setJson(key, this.serialize(snapshot), AuthUserCacheService.TTL_SECONDS);
    } catch (error) {
      this.logger.warn(
        `Failed to write auth user cache for ${snapshot.id.toString()}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getOrLoad(userId: bigint, loader: () => Promise<AuthUserSnapshot | null>) {
    const cached = await this.get(userId);
    if (cached) return cached;

    const loaded = await loader();
    if (loaded) {
      await this.set(loaded);
    }

    return loaded;
  }

  async invalidate(userId: bigint) {
    try {
      await this.redis.del(this.buildKey(userId));
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate auth user cache for ${userId.toString()}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private buildKey(userId: bigint) {
    return `user:auth:${userId.toString()}`;
  }

  private serialize(snapshot: AuthUserSnapshot): AuthUserCacheRecord {
    return {
      id: snapshot.id.toString(),
      email: snapshot.email,
      role: snapshot.role,
      status: snapshot.status,
      banReason: snapshot.banReason ?? null,
      banExpireAt: snapshot.banExpireAt?.toISOString() ?? null,
    };
  }

  private deserialize(payload: AuthUserCacheRecord | null): AuthUserSnapshot | null {
    if (!payload) return null;

    const banExpireAt = payload.banExpireAt ? new Date(payload.banExpireAt) : null;
    return {
      id: BigInt(payload.id),
      email: payload.email,
      role: payload.role,
      status: payload.status,
      banReason: payload.banReason ?? null,
      banExpireAt: banExpireAt && !Number.isNaN(banExpireAt.getTime()) ? banExpireAt : null,
    };
  }
}
