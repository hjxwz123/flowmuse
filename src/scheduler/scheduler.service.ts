// import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
// import { Queue } from 'bullmq';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { MembershipsService } from '../memberships/memberships.service';
import { DashboardMetricsService } from '../metrics/dashboard-metrics.service';
import { PrismaService } from '../prisma/prisma.service';
// import { CHANNEL_HEALTH_CHECK_QUEUE } from '../queues/queue-names';

@Injectable()
export class SchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberships: MembershipsService,
    private readonly dashboardMetrics: DashboardMetricsService,
    // @InjectQueue(CHANNEL_HEALTH_CHECK_QUEUE) private readonly channelHealthQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async membershipMaintenance() {
    const now = new Date();

    await this.memberships.processScheduledMemberships(now);
    await this.dashboardMetrics.refreshRecent(3);

    // 非会员不应保留会员积分
    await this.prisma.user.updateMany({
      where: {
        OR: [
          { membershipLevelId: null },
          { membershipExpireAt: null },
          { membershipExpireAt: { lte: now } },
        ],
        membershipDailyCredits: { gt: 0 },
      },
      data: {
        membershipDailyCredits: 0,
      },
    });
  }

  // 已禁用：渠道健康检查占用过多 Redis 资源
  // @Cron(CronExpression.EVERY_5_MINUTES)
  // async enqueueChannelHealthChecks() {
  //   const channels = await this.prisma.apiChannel.findMany({
  //     where: { status: 'active' },
  //     select: { id: true },
  //   });

  //   for (const ch of channels) {
  //     await this.channelHealthQueue.add('check', { channelId: ch.id.toString() });
  //   }
  // }

  @Cron('0 2 * * *') // daily 02:00
  async cleanupTempFiles() {
    const tmpDir = join(process.cwd(), 'tmp');
    await rm(tmpDir, { recursive: true, force: true });
  }

  @Cron('0 3 * * *') // daily 03:00
  async cleanupOldFailedTasks() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await this.prisma.imageTask.deleteMany({
      where: { status: 'failed', createdAt: { lt: cutoff } },
    });

    await this.prisma.videoTask.deleteMany({
      where: { status: 'failed', createdAt: { lt: cutoff } },
    });
  }
}
