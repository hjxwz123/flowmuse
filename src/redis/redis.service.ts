import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Redis as RedisClient } from 'ioredis';

import { resolveRedisConnection } from './redis-connection.util';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: RedisClient;

  constructor(config: ConfigService) {
    this.client = new Redis({
      ...resolveRedisConnection(config),
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    this.client.on('error', (error) => {
      this.logger.warn(`Redis error: ${error.message}`);
    });
  }

  getClient() {
    return this.client;
  }

  createSubscriber(name?: string) {
    const subscriber = this.client.duplicate({
      connectionName: name,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    subscriber.on('error', (error) => {
      this.logger.warn(`Redis subscriber error${name ? ` (${name})` : ''}: ${error.message}`);
    });

    return subscriber;
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
      await this.client.set(key, value, 'EX', Math.trunc(ttlSeconds));
      return;
    }

    await this.client.set(key, value);
  }

  async setNx(key: string, value: string) {
    return this.client.set(key, value, 'NX');
  }

  async setNxPx(key: string, value: string, ttlMs: number) {
    return this.client.set(key, value, 'PX', Math.max(1, Math.trunc(ttlMs)), 'NX');
  }

  async del(...keys: string[]) {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async incr(key: string) {
    return this.client.incr(key);
  }

  async decr(key: string) {
    return this.client.decr(key);
  }

  async expireAt(key: string, unixTimeSeconds: number) {
    return this.client.expireat(key, Math.trunc(unixTimeSeconds));
  }

  async ttl(key: string) {
    return this.client.ttl(key);
  }

  async pttl(key: string) {
    return this.client.pttl(key);
  }

  async publish(channel: string, message: string) {
    return this.client.publish(channel, message);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        `Failed to parse Redis JSON payload for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number) {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => this.client.disconnect());
  }
}
