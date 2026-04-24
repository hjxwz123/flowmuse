import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class UpstreamThrottleService {
  constructor(private readonly redis: RedisService) {}

  /**
   * `rateLimit` is interpreted as the maximum number of upstream requests
   * allowed per minute for a specific provider/channel pair.
   */
  async waitForChannelTurn(
    provider: string,
    channelId: bigint,
    rateLimit: number | null | undefined,
  ) {
    const normalizedRate = typeof rateLimit === 'number' ? Math.floor(rateLimit) : 0;
    if (normalizedRate <= 0) {
      return;
    }

    const windowMs = Math.max(250, Math.ceil(60_000 / normalizedRate));
    const throttleKey = `upstream:throttle:${provider}:${channelId.toString()}`;

    for (;;) {
      const acquired = await this.redis.setNxPx(throttleKey, '1', windowMs);
      if (acquired === 'OK') {
        return;
      }

      const ttlMs = await this.redis.pttl(throttleKey);
      await sleep(Math.max(100, ttlMs > 0 ? ttlMs : windowMs));
    }
  }
}
