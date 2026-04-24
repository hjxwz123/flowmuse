import { Injectable } from '@nestjs/common';
import { DashboardDailyMetric, Prisma } from '@prisma/client';

import { toDateOnlyKey } from '../../common/utils/date-only.util';
import { PrismaService } from '../../prisma/prisma.service';
import type { DashboardDataDto } from './dto/dashboard-response.dto';
import { RedisService } from '../../redis/redis.service';
import { DashboardMetricsService } from '../../metrics/dashboard-metrics.service';

const DASHBOARD_CACHE_TTL_SECONDS = 60;

type CountRow = {
  total: number | string | bigint;
};

type DailyTaskTrendRow = {
  metricDate: Date | string;
  completedCount?: number | string | bigint | null;
  failedCount?: number | string | bigint | null;
};

type DailyCreditsTrendRow = {
  metricDate: Date | string;
  issued?: number | string | bigint | null;
  used?: number | string | bigint | null;
};

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly metrics: DashboardMetricsService,
  ) {}

  async getDashboardData(range: string = '30d'): Promise<DashboardDataDto> {
    const normalizedRange = this.normalizeRange(range);
    const cacheKey = `admin:dashboard:v3:${normalizedRange}`;

    try {
      const cached = await this.redis.getJson<DashboardDataDto>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    } catch {
      // Cache read failures are non-fatal for admin analytics.
    }

    const days = this.parseDaysFromRange(normalizedRange);
    const today = this.normalizeDate(new Date());
    const startDate = this.addDays(today, -(days - 1));
    const metrics = await this.metrics.ensureRange(startDate, today);

    const [overview, modelUsage, taskTrend, creditsConsumption] = await Promise.all([
      this.getOverviewStats(today),
      this.getModelUsage(),
      this.getTaskTrendData(startDate, days),
      this.getCreditsConsumptionData(startDate, days),
    ]);

    const response: DashboardDataDto = {
      overview,
      userGrowth: this.buildUserGrowth(metrics, startDate, days),
      taskTrend,
      modelUsage,
      revenueTrend: this.buildRevenueTrend(metrics, startDate, days),
      creditsConsumption,
    };

    try {
      await this.redis.setJson(cacheKey, response, DASHBOARD_CACHE_TTL_SECONDS);
    } catch {
      // Cache write failures should not fail the dashboard endpoint.
    }

    return response;
  }

  private parseDaysFromRange(range: string): number {
    const map: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };
    return map[range] || 30;
  }

  private normalizeRange(range: string) {
    const days = this.parseDaysFromRange(range);
    if (days === 7) return '7d';
    if (days === 30) return '30d';
    if (days === 90) return '90d';
    return '1y';
  }

  private async getOverviewStats(today: Date) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const activeSince = this.addDays(today, -29);

    const [totalUsers, activeUserRows] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(DISTINCT user_id) AS total
        FROM (
          SELECT image_tasks.user_id AS user_id
          FROM image_tasks
          WHERE image_tasks.created_at >= ${activeSince}

          UNION ALL

          SELECT video_tasks.user_id AS user_id
          FROM video_tasks
          WHERE video_tasks.created_at >= ${activeSince}

          UNION ALL

          SELECT research_tasks.user_id AS user_id
          FROM research_tasks
          WHERE research_tasks.created_at >= ${activeSince}
        ) AS active_task_users
      `),
    ]);
    const recentActiveUsers = this.toSafeNumber(activeUserRows[0]?.total);

    const [imageTasksCount, videoTasksCount, researchTasksCount] = await Promise.all([
      this.prisma.imageTask.count(),
      this.prisma.videoTask.count(),
      this.prisma.researchTask.count(),
    ]);
    const totalTasks = imageTasksCount + videoTasksCount + researchTasksCount;

    const [completedImageTasks, completedVideoTasks, completedResearchTasks] = await Promise.all([
      this.prisma.imageTask.count({ where: { status: 'completed' } }),
      this.prisma.videoTask.count({ where: { status: 'completed' } }),
      this.prisma.researchTask.count({ where: { status: 'completed' } }),
    ]);
    const completedTasks = completedImageTasks + completedVideoTasks + completedResearchTasks;

    const [creditIssued, creditUsed] = await Promise.all([
      this.prisma.creditLog.aggregate({
        where: { type: { in: ['redeem', 'admin_adjust', 'refund'] } },
        _sum: { amount: true },
      }),
      this.prisma.creditLog.aggregate({
        where: { type: 'consume' },
        _sum: { amount: true },
      }),
    ]);

    const totalCreditsIssued = creditIssued._sum.amount || 0;
    const totalCreditsUsed = Math.abs(creditUsed._sum.amount || 0);

    const [totalRevenueAggregate, todayRevenueAggregate] = await Promise.all([
      this.prisma.paymentOrder.aggregate({
        where: { status: 'paid' },
        _sum: { amount: true },
      }),
      this.prisma.paymentOrder.aggregate({
        where: {
          status: 'paid',
          paidAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = (totalRevenueAggregate._sum.amount || 0) / 100;
    const todayRevenue = (todayRevenueAggregate._sum.amount || 0) / 100;

    return {
      totalUsers,
      activeUsers: recentActiveUsers,
      totalTasks,
      completedTasks,
      totalCreditsIssued,
      totalCreditsUsed,
      totalRevenue,
      todayRevenue,
    };
  }

  private buildUserGrowth(rows: DashboardDailyMetric[], startDate: Date, days: number) {
    const map = this.toMetricMap(rows);
    return this.buildDateSeries(startDate, days, (dateKey) => ({
      date: dateKey,
      count: map.get(dateKey)?.newUsers ?? 0,
    }));
  }

  private async getModelUsage() {
    const [imageModels, videoModels, researchModels] = await Promise.all([
      this.prisma.imageTask.groupBy({
        by: ['modelId'],
        _count: { _all: true },
      }),
      this.prisma.videoTask.groupBy({
        by: ['modelId'],
        _count: { _all: true },
      }),
      this.prisma.researchTask.groupBy({
        by: ['modelId'],
        _count: { _all: true },
      }),
    ]);

    // Combine and get model names
    const allModelUsage = new Map<bigint, number>();
    for (const item of imageModels) {
      const count = typeof item._count === 'object' && item._count._all ? item._count._all : 0;
      allModelUsage.set(item.modelId, count);
    }
    for (const item of videoModels) {
      const current = allModelUsage.get(item.modelId) || 0;
      const count = typeof item._count === 'object' && item._count._all ? item._count._all : 0;
      allModelUsage.set(item.modelId, current + count);
    }
    for (const item of researchModels) {
      const current = allModelUsage.get(item.modelId) || 0;
      const count = typeof item._count === 'object' && item._count._all ? item._count._all : 0;
      allModelUsage.set(item.modelId, current + count);
    }

    // Sort by count descending and take top 10
    const sortedModelIds = Array.from(allModelUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map((entry) => entry[0]);

    // Fetch model names
    const models = await this.prisma.aiModel.findMany({
      where: { id: { in: sortedModelIds } },
      select: { id: true, name: true },
    });

    const modelNameMap = new Map(models.map((m) => [m.id, m.name]));
    const totalCount = Array.from(allModelUsage.values()).reduce(
      (sum, count) => sum + count,
      0,
    );

    return sortedModelIds
      .map((modelId) => {
        const count = allModelUsage.get(modelId) || 0;
        const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
        return {
          modelName: modelNameMap.get(modelId) || `Model ${modelId}`,
          count,
          percentage: Math.round(percentage * 10) / 10,
        };
      })
      .filter((item) => item.count > 0);
  }

  private buildRevenueTrend(rows: DashboardDailyMetric[], startDate: Date, days: number) {
    const map = this.toMetricMap(rows);
    return this.buildDateSeries(startDate, days, (dateKey) => ({
      date: dateKey,
      amount: (map.get(dateKey)?.revenueFen ?? 0) / 100,
    }));
  }

  private toMetricMap(rows: DashboardDailyMetric[]) {
    return new Map(rows.map((row) => [this.toStoredDateKey(row.date), row]));
  }

  private async getTaskTrendData(startDate: Date, days: number) {
    const endExclusive = this.addDays(startDate, days);
    const rows = await this.prisma.$queryRaw<DailyTaskTrendRow[]>(Prisma.sql`
      SELECT
        metric_date AS metricDate,
        SUM(completed_count) AS completedCount,
        SUM(failed_count) AS failedCount
      FROM (
        SELECT
          DATE(completed_at) AS metric_date,
          COUNT(1) AS completed_count,
          0 AS failed_count
        FROM image_tasks
        WHERE status = 'completed'
          AND completed_at >= ${startDate}
          AND completed_at < ${endExclusive}
        GROUP BY DATE(completed_at)

        UNION ALL

        SELECT
          DATE(COALESCE(completed_at, created_at)) AS metric_date,
          0 AS completed_count,
          COUNT(1) AS failed_count
        FROM image_tasks
        WHERE status = 'failed'
          AND COALESCE(completed_at, created_at) >= ${startDate}
          AND COALESCE(completed_at, created_at) < ${endExclusive}
        GROUP BY DATE(COALESCE(completed_at, created_at))

        UNION ALL

        SELECT
          DATE(completed_at) AS metric_date,
          COUNT(1) AS completed_count,
          0 AS failed_count
        FROM video_tasks
        WHERE status = 'completed'
          AND completed_at >= ${startDate}
          AND completed_at < ${endExclusive}
        GROUP BY DATE(completed_at)

        UNION ALL

        SELECT
          DATE(COALESCE(completed_at, created_at)) AS metric_date,
          0 AS completed_count,
          COUNT(1) AS failed_count
        FROM video_tasks
        WHERE status = 'failed'
          AND COALESCE(completed_at, created_at) >= ${startDate}
          AND COALESCE(completed_at, created_at) < ${endExclusive}
        GROUP BY DATE(COALESCE(completed_at, created_at))

        UNION ALL

        SELECT
          DATE(completed_at) AS metric_date,
          COUNT(1) AS completed_count,
          0 AS failed_count
        FROM research_tasks
        WHERE status = 'completed'
          AND completed_at >= ${startDate}
          AND completed_at < ${endExclusive}
        GROUP BY DATE(completed_at)

        UNION ALL

        SELECT
          DATE(COALESCE(completed_at, created_at)) AS metric_date,
          0 AS completed_count,
          COUNT(1) AS failed_count
        FROM research_tasks
        WHERE status = 'failed'
          AND COALESCE(completed_at, created_at) >= ${startDate}
          AND COALESCE(completed_at, created_at) < ${endExclusive}
        GROUP BY DATE(COALESCE(completed_at, created_at))
      ) AS task_trends
      GROUP BY metric_date
      ORDER BY metric_date ASC
    `);

    const map = new Map(
      rows
        .map((row) => [this.normalizeRawDateKey(row.metricDate), row] as const)
        .filter((entry): entry is [string, DailyTaskTrendRow] => Boolean(entry[0]))
    );

    return this.buildDateSeries(startDate, days, (dateKey) => ({
      date: dateKey,
      completed: this.toSafeNumber(map.get(dateKey)?.completedCount),
      failed: this.toSafeNumber(map.get(dateKey)?.failedCount),
    }));
  }

  private async getCreditsConsumptionData(startDate: Date, days: number) {
    const endExclusive = this.addDays(startDate, days);
    const rows = await this.prisma.$queryRaw<DailyCreditsTrendRow[]>(Prisma.sql`
      SELECT
        DATE(created_at) AS metricDate,
        COALESCE(
          SUM(
            CASE
              WHEN type IN ('redeem', 'admin_adjust', 'refund') AND amount > 0 THEN amount
              ELSE 0
            END
          ),
          0
        ) AS issued,
        COALESCE(
          SUM(
            CASE
              WHEN type = 'consume' THEN ABS(amount)
              ELSE 0
            END
          ),
          0
        ) AS used
      FROM credit_logs
      WHERE created_at >= ${startDate}
        AND created_at < ${endExclusive}
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `);

    const map = new Map(
      rows
        .map((row) => [this.normalizeRawDateKey(row.metricDate), row] as const)
        .filter((entry): entry is [string, DailyCreditsTrendRow] => Boolean(entry[0]))
    );

    return this.buildDateSeries(startDate, days, (dateKey) => ({
      date: dateKey,
      issued: this.toSafeNumber(map.get(dateKey)?.issued),
      used: this.toSafeNumber(map.get(dateKey)?.used),
    }));
  }

  private buildDateSeries<T>(
    startDate: Date,
    days: number,
    mapper: (dateKey: string) => T,
  ) {
    const out: T[] = [];
    for (let i = 0; i < days; i += 1) {
      const date = this.addDays(startDate, i);
      out.push(mapper(this.toDateKey(date)));
    }
    return out;
  }

  private normalizeDate(date: Date) {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private toDateKey(date: Date) {
    const normalized = this.normalizeDate(date);
    const year = normalized.getFullYear();
    const month = `${normalized.getMonth() + 1}`.padStart(2, '0');
    const day = `${normalized.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toStoredDateKey(date: Date) {
    return toDateOnlyKey(date) ?? this.toDateKey(date);
  }

  private normalizeRawDateKey(value: Date | string | null | undefined) {
    if (!value) return null;
    if (value instanceof Date) return this.toStoredDateKey(value);
    const text = String(value).trim();
    if (!text) return null;
    return text.length >= 10 ? text.slice(0, 10) : text;
  }

  private toSafeNumber(value: number | string | bigint | null | undefined) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
}
