import { Injectable } from '@nestjs/common';
import { DashboardDailyMetric, Prisma } from '@prisma/client';

import { dateKeyToDateOnlyValue, toDateOnlyKey } from '../common/utils/date-only.util';
import { PrismaService } from '../prisma/prisma.service';

type DailyCountRow = {
  metricDate: Date | string;
  total?: bigint | number | string | null;
  newUsers?: bigint | number | string | null;
  completedCount?: bigint | number | string | null;
  failedCount?: bigint | number | string | null;
  paidOrders?: bigint | number | string | null;
  revenueFen?: bigint | number | string | null;
  creditsIssued?: bigint | number | string | null;
  creditsUsed?: bigint | number | string | null;
};

type MetricBucket = {
  newUsers: number;
  imageCompleted: number;
  imageFailed: number;
  videoCompleted: number;
  videoFailed: number;
  paidOrders: number;
  revenueFen: number;
  creditsIssued: number;
  creditsUsed: number;
};

@Injectable()
export class DashboardMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async listRange(startDate: Date, endDate: Date) {
    return this.prisma.dashboardDailyMetric.findMany({
      where: {
        date: {
          gte: this.toDateOnlyValue(startDate),
          lte: this.toDateOnlyValue(endDate),
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async ensureRange(startDate: Date, endDate: Date) {
    const normalizedStart = this.normalizeDate(startDate);
    const normalizedEnd = this.normalizeDate(endDate);
    const existing = await this.listRange(normalizedStart, normalizedEnd);
    const existingKeys = new Set(existing.map((item) => this.toStoredDateKey(item.date)));
    const staleCutoff = this.addDays(this.normalizeDate(new Date()), -2);

    let refreshStart: Date | null = null;
    for (let cursor = new Date(normalizedStart); cursor <= normalizedEnd; cursor = this.addDays(cursor, 1)) {
      const key = this.toDateKey(cursor);
      const isMissing = !existingKeys.has(key);
      const isStale = cursor >= staleCutoff;
      if (isMissing || isStale) {
        refreshStart = new Date(cursor);
        break;
      }
    }

    if (!refreshStart) {
      return existing;
    }

    await this.refreshRange(refreshStart, normalizedEnd);
    return this.listRange(normalizedStart, normalizedEnd);
  }

  async refreshRecent(days = 3) {
    const safeDays = Math.max(1, Math.floor(days));
    const endDate = this.normalizeDate(new Date());
    const startDate = this.addDays(endDate, -(safeDays - 1));
    await this.refreshRange(startDate, endDate);
  }

  async refreshRange(startDate: Date, endDate: Date) {
    const normalizedStart = this.normalizeDate(startDate);
    const normalizedEnd = this.normalizeDate(endDate);
    if (normalizedStart > normalizedEnd) {
      return [];
    }

    const endExclusive = this.addDays(normalizedEnd, 1);
    const [userRows, imageRows, videoRows, paymentRows, creditRows] = await Promise.all([
      this.prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
        SELECT
          DATE(created_at) AS metricDate,
          COUNT(1) AS newUsers
        FROM users
        WHERE created_at >= ${normalizedStart}
          AND created_at < ${endExclusive}
        GROUP BY DATE(created_at)
      `),
      this.prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
        SELECT
          DATE(completed_at) AS metricDate,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedCount,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedCount
        FROM image_tasks
        WHERE completed_at >= ${normalizedStart}
          AND completed_at < ${endExclusive}
          AND status IN ('completed', 'failed')
        GROUP BY DATE(completed_at)
      `),
      this.prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
        SELECT
          DATE(completed_at) AS metricDate,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedCount,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedCount
        FROM video_tasks
        WHERE completed_at >= ${normalizedStart}
          AND completed_at < ${endExclusive}
          AND status IN ('completed', 'failed')
        GROUP BY DATE(completed_at)
      `),
      this.prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
        SELECT
          DATE(paid_at) AS metricDate,
          COUNT(1) AS paidOrders,
          COALESCE(SUM(amount), 0) AS revenueFen
        FROM payment_orders
        WHERE status = 'paid'
          AND paid_at >= ${normalizedStart}
          AND paid_at < ${endExclusive}
        GROUP BY DATE(paid_at)
      `),
      this.prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
        SELECT
          DATE(created_at) AS metricDate,
          COALESCE(SUM(CASE WHEN type IN ('redeem', 'admin_adjust') THEN amount ELSE 0 END), 0) AS creditsIssued,
          COALESCE(SUM(CASE WHEN type = 'consume' THEN ABS(amount) ELSE 0 END), 0) AS creditsUsed
        FROM credit_logs
        WHERE created_at >= ${normalizedStart}
          AND created_at < ${endExclusive}
        GROUP BY DATE(created_at)
      `),
    ]);

    const buckets = new Map<string, MetricBucket>();
    for (let cursor = new Date(normalizedStart); cursor <= normalizedEnd; cursor = this.addDays(cursor, 1)) {
      buckets.set(this.toDateKey(cursor), this.createEmptyBucket());
    }

    this.applyRows(buckets, userRows, (bucket, row) => {
      bucket.newUsers = this.toSafeNumber(row.newUsers ?? row.total);
    });
    this.applyRows(buckets, imageRows, (bucket, row) => {
      bucket.imageCompleted = this.toSafeNumber(row.completedCount);
      bucket.imageFailed = this.toSafeNumber(row.failedCount);
    });
    this.applyRows(buckets, videoRows, (bucket, row) => {
      bucket.videoCompleted = this.toSafeNumber(row.completedCount);
      bucket.videoFailed = this.toSafeNumber(row.failedCount);
    });
    this.applyRows(buckets, paymentRows, (bucket, row) => {
      bucket.paidOrders = this.toSafeNumber(row.paidOrders ?? row.total);
      bucket.revenueFen = this.toSafeNumber(row.revenueFen);
    });
    this.applyRows(buckets, creditRows, (bucket, row) => {
      bucket.creditsIssued = this.toSafeNumber(row.creditsIssued);
      bucket.creditsUsed = this.toSafeNumber(row.creditsUsed);
    });

    const refreshedAt = new Date();
    const records = Array.from(buckets.entries()).map(([dateKey, bucket]) => ({
      date: dateKeyToDateOnlyValue(dateKey),
      ...bucket,
      refreshedAt,
    }));

    if (records.length > 0) {
      const values = records.map((record) => Prisma.sql`
        (
          ${record.date},
          ${record.newUsers},
          ${record.imageCompleted},
          ${record.imageFailed},
          ${record.videoCompleted},
          ${record.videoFailed},
          ${record.paidOrders},
          ${record.revenueFen},
          ${record.creditsIssued},
          ${record.creditsUsed},
          ${record.refreshedAt}
        )
      `);

      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO dashboard_daily_metrics (
          date,
          new_users,
          image_completed,
          image_failed,
          video_completed,
          video_failed,
          paid_orders,
          revenue_fen,
          credits_issued,
          credits_used,
          refreshed_at
        )
        VALUES ${Prisma.join(values)}
        ON DUPLICATE KEY UPDATE
          new_users = VALUES(new_users),
          image_completed = VALUES(image_completed),
          image_failed = VALUES(image_failed),
          video_completed = VALUES(video_completed),
          video_failed = VALUES(video_failed),
          paid_orders = VALUES(paid_orders),
          revenue_fen = VALUES(revenue_fen),
          credits_issued = VALUES(credits_issued),
          credits_used = VALUES(credits_used),
          refreshed_at = VALUES(refreshed_at)
      `);
    }

    return this.listRange(normalizedStart, normalizedEnd);
  }

  private applyRows(
    buckets: Map<string, MetricBucket>,
    rows: DailyCountRow[],
    apply: (bucket: MetricBucket, row: DailyCountRow) => void,
  ) {
    for (const row of rows) {
      const key = this.normalizeRawDateKey(row.metricDate);
      if (!key) continue;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      apply(bucket, row);
    }
  }

  private createEmptyBucket(): MetricBucket {
    return {
      newUsers: 0,
      imageCompleted: 0,
      imageFailed: 0,
      videoCompleted: 0,
      videoFailed: 0,
      paidOrders: 0,
      revenueFen: 0,
      creditsIssued: 0,
      creditsUsed: 0,
    };
  }

  private normalizeRawDateKey(value: Date | string | null | undefined) {
    if (!value) return null;
    if (value instanceof Date) return this.toStoredDateKey(value);
    const text = String(value).trim();
    if (!text) return null;
    return text.length >= 10 ? text.slice(0, 10) : text;
  }

  private toSafeNumber(value: bigint | number | string | null | undefined) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
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
    return this.formatLocalDateKey(this.normalizeDate(date));
  }

  private toStoredDateKey(date: Date) {
    return toDateOnlyKey(date) ?? this.toDateKey(date);
  }

  private toDateOnlyValue(date: Date) {
    return dateKeyToDateOnlyValue(this.toDateKey(date));
  }

  private formatLocalDateKey(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
