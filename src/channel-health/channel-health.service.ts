import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChannelHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(channelId: bigint) {
    const channel = await this.prisma.apiChannel.findUnique({ where: { id: channelId } });
    if (!channel) return { ok: false, error: 'Channel not found' };

    const startedAt = Date.now();
    let ok = false;
    let status: number | null = null;
    let error: string | null = null;

    try {
      const res = await axios.request({
        method: 'HEAD',
        url: channel.baseUrl,
        timeout: Math.min(channel.timeout, 10_000),
        validateStatus: () => true,
      });
      status = res.status;
      ok = res.status >= 200 && res.status < 500;
    } catch (e: any) {
      error = e?.message ?? 'Request failed';
    }

    const ms = Date.now() - startedAt;

    const key = `channel_health:${channelId.toString()}`;
    await this.prisma.systemConfig.upsert({
      where: { key },
      create: {
        key,
        value: JSON.stringify({ ok, status, ms, error, checkedAt: new Date().toISOString() }),
        description: `Channel health check for ${channelId.toString()}`,
      },
      update: {
        value: JSON.stringify({ ok, status, ms, error, checkedAt: new Date().toISOString() }),
      },
    });

    return { ok, status, ms, error };
  }
}

