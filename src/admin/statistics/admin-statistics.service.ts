import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminStatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [users, packages, channels, models, imageTasks, videoTasks] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.package.count(),
      this.prisma.apiChannel.count(),
      this.prisma.aiModel.count(),
      this.prisma.imageTask.count(),
      this.prisma.videoTask.count(),
    ]);

    return { users, packages, channels, models, imageTasks, videoTasks };
  }

  async redeem() {
    const byType = await this.prisma.redeemLog.groupBy({
      by: ['type'],
      _count: { _all: true },
    });

    return { byType };
  }

  async tasks() {
    const [images, videos] = await this.prisma.$transaction([
      this.prisma.imageTask.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.videoTask.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);

    return { images, videos };
  }

  async channels() {
    const byProvider = await this.prisma.apiChannel.groupBy({
      by: ['provider'],
      _count: { _all: true },
      orderBy: { provider: 'asc' },
    });

    return { byProvider };
  }
}
