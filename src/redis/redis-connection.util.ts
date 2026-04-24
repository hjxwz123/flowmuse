import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export function resolveRedisConnection(config: ConfigService): RedisOptions {
  const url = config.get<string>('REDIS_URL');
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 6379,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      db: parsed.pathname?.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
    };
  }

  return {
    host: config.get<string>('REDIS_HOST') ?? '127.0.0.1',
    port: Number(config.get<string>('REDIS_PORT') ?? 6379),
    username: config.get<string>('REDIS_USERNAME') || undefined,
    password: config.get<string>('REDIS_PASSWORD') || undefined,
    db: Number(config.get<string>('REDIS_DB') ?? 0),
  };
}
