import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiChannelStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import axios from 'axios';

import { EncryptionService } from '../../encryption/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@Injectable()
export class AdminChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  list() {
    return this.prisma.apiChannel.findMany({ orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] });
  }

  create(dto: CreateChannelDto) {
    return this.prisma.apiChannel.create({
      data: {
        name: dto.name,
        provider: dto.provider,
        baseUrl: dto.baseUrl,
        apiKey: dto.apiKey ? this.encryption.encryptString(dto.apiKey) : undefined,
        apiSecret: dto.apiSecret ? this.encryption.encryptString(dto.apiSecret) : undefined,
        extraHeaders: dto.extraHeaders as Prisma.InputJsonValue,
        timeout: dto.timeout ?? 300000,
        maxRetry: dto.maxRetry ?? 3,
        rateLimit: dto.rateLimit,
        status: (dto.status as ApiChannelStatus) ?? ApiChannelStatus.active,
        priority: dto.priority ?? 0,
        description: dto.description,
      },
    });
  }

  async detail(id: bigint) {
    const channel = await this.prisma.apiChannel.findUnique({ where: { id } });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  update(id: bigint, dto: UpdateChannelDto) {
    return this.prisma.apiChannel.update({
      where: { id },
      data: {
        name: dto.name,
        provider: dto.provider,
        baseUrl: dto.baseUrl,
        apiKey:
          dto.apiKey === undefined
            ? undefined
            : dto.apiKey
              ? this.encryption.encryptString(dto.apiKey)
              : null,
        apiSecret:
          dto.apiSecret === undefined
            ? undefined
            : dto.apiSecret
              ? this.encryption.encryptString(dto.apiSecret)
              : null,
        extraHeaders: dto.extraHeaders as Prisma.InputJsonValue,
        timeout: dto.timeout,
        maxRetry: dto.maxRetry,
        rateLimit: dto.rateLimit,
        status: dto.status ? (dto.status as ApiChannelStatus) : undefined,
        priority: dto.priority,
        description: dto.description,
      },
    });
  }

  async remove(id: bigint) {
    await this.prisma.apiChannel.delete({ where: { id } });
    return { ok: true };
  }

  async test(id: bigint) {
    const channel = await this.detail(id);
    const startedAt = Date.now();
    try {
      const res = await axios.request({
        method: 'HEAD',
        url: channel.baseUrl,
        timeout: Math.min(channel.timeout, 10_000),
        validateStatus: () => true,
      });

      return { ok: true, baseUrl: channel.baseUrl, provider: channel.provider, status: res.status, ms: Date.now() - startedAt };
    } catch (e: any) {
      return { ok: false, baseUrl: channel.baseUrl, provider: channel.provider, error: e?.message ?? 'Request failed', ms: Date.now() - startedAt };
    }
  }

  async statistics(id: bigint) {
    await this.detail(id);

    const [imageTotal, imageFailed, imageCompleted, imageProcessing, imagePending] = await this.prisma.$transaction([
      this.prisma.imageTask.count({ where: { channelId: id } }),
      this.prisma.imageTask.count({ where: { channelId: id, status: 'failed' } }),
      this.prisma.imageTask.count({ where: { channelId: id, status: 'completed' } }),
      this.prisma.imageTask.count({ where: { channelId: id, status: 'processing' } }),
      this.prisma.imageTask.count({ where: { channelId: id, status: 'pending' } }),
    ]);

    const [videoTotal, videoFailed, videoCompleted, videoProcessing, videoPending] = await this.prisma.$transaction([
      this.prisma.videoTask.count({ where: { channelId: id } }),
      this.prisma.videoTask.count({ where: { channelId: id, status: 'failed' } }),
      this.prisma.videoTask.count({ where: { channelId: id, status: 'completed' } }),
      this.prisma.videoTask.count({ where: { channelId: id, status: 'processing' } }),
      this.prisma.videoTask.count({ where: { channelId: id, status: 'pending' } }),
    ]);

    const imageSamples = await this.prisma.imageTask.findMany({
      where: { channelId: id, status: 'completed', startedAt: { not: null }, completedAt: { not: null } },
      select: { startedAt: true, completedAt: true },
      orderBy: { completedAt: 'desc' },
      take: 200,
    });

    const videoSamples = await this.prisma.videoTask.findMany({
      where: { channelId: id, status: 'completed', startedAt: { not: null }, completedAt: { not: null } },
      select: { startedAt: true, completedAt: true },
      orderBy: { completedAt: 'desc' },
      take: 200,
    });

    const avgImageMs =
      imageSamples.length === 0
        ? null
        : Math.round(
            imageSamples.reduce((sum, t) => sum + (t.completedAt!.getTime() - t.startedAt!.getTime()), 0) /
              imageSamples.length,
          );

    const avgVideoMs =
      videoSamples.length === 0
        ? null
        : Math.round(
            videoSamples.reduce((sum, t) => sum + (t.completedAt!.getTime() - t.startedAt!.getTime()), 0) /
              videoSamples.length,
          );

    const health = await this.prisma.systemConfig.findUnique({ where: { key: `channel_health:${id.toString()}` } });
    const healthValue = health?.value ? (() => { try { return JSON.parse(health.value); } catch { return health.value; } })() : null;

    return {
      images: { total: imageTotal, failed: imageFailed, completed: imageCompleted, processing: imageProcessing, pending: imagePending, avgMs: avgImageMs },
      videos: { total: videoTotal, failed: videoFailed, completed: videoCompleted, processing: videoProcessing, pending: videoPending, avgMs: avgVideoMs },
      health: healthValue,
    };
  }
}
