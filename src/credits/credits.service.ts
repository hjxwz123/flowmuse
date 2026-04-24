import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreditSource, Prisma, UserStatus } from '@prisma/client';

import { dateKeyToDateOnlyValue, toBeijingDateKey, toDateOnlyKey } from '../common/utils/date-only.util';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreditLogsQueryDto } from './dto/credit-logs-query.dto';

type RefundCreditsOptions = {
  // Scope credit logs by a stable substring in description (for taskNo-based isolation).
  scopeDescriptionContains?: string;
  // Cap refund amount for this call (prevents accidental over-refund on legacy/colliding logs).
  maxRefundAmount?: number;
};

const USER_CREDITS_SELECT = {
  id: true,
  status: true,
  permanentCredits: true,
  membershipDailyCredits: true,
  membershipDailyDate: true,
  membershipLevelId: true,
  membershipExpireAt: true,
  membershipLevel: {
    select: {
      dailyCredits: true,
    },
  },
} satisfies Prisma.UserSelect;

type UserCreditsSnapshot = Prisma.UserGetPayload<{ select: typeof USER_CREDITS_SELECT }>;

@Injectable()
export class CreditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberships: MembershipsService,
  ) {}

  private normalizeDailyCredits(value: number | null | undefined) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(Number(value)));
  }

  private isMembershipActive(user: {
    membershipLevelId: bigint | null;
    membershipExpireAt: Date | null;
  }, now: Date) {
    return Boolean(user.membershipLevelId && user.membershipExpireAt && user.membershipExpireAt > now);
  }

  private async syncMembershipDailyCredits(
    tx: Prisma.TransactionClient | PrismaService,
    user: UserCreditsSnapshot,
    now = new Date(),
  ): Promise<UserCreditsSnapshot> {
    const todayKey = toBeijingDateKey(now);
    const isActive = this.isMembershipActive(user, now);
    const configuredDailyCredits = isActive
      ? this.normalizeDailyCredits(user.membershipLevel?.dailyCredits ?? 0)
      : 0;
    const isTodaySynced = toDateOnlyKey(user.membershipDailyDate) === todayKey;

    if (isTodaySynced) {
      if (!isActive && user.membershipDailyCredits > 0) {
        const updated = await tx.user.update({
          where: { id: user.id },
          data: { membershipDailyCredits: 0 },
          select: USER_CREDITS_SELECT,
        });

        await tx.creditLog.create({
          data: {
            userId: user.id,
            amount: -user.membershipDailyCredits,
            balanceAfter: 0,
            type: 'expire',
            source: 'membership',
            description: '会员积分失效（会员已过期）',
          },
        });

        return updated;
      }
      return user;
    }

    const expiredAmount = Math.max(user.membershipDailyCredits, 0);
    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        membershipDailyCredits: configuredDailyCredits,
        membershipDailyDate: dateKeyToDateOnlyValue(todayKey),
      },
      select: USER_CREDITS_SELECT,
    });

    if (expiredAmount > 0) {
      await tx.creditLog.create({
        data: {
          userId: user.id,
          amount: -expiredAmount,
          balanceAfter: updated.membershipDailyCredits,
          type: 'expire',
          source: 'membership',
          description: '昨日会员积分过期',
        },
      });
    }

    if (configuredDailyCredits > 0) {
      await tx.creditLog.create({
        data: {
          userId: user.id,
          amount: configuredDailyCredits,
          balanceAfter: updated.membershipDailyCredits,
          type: 'redeem',
          source: 'membership',
          description: '会员每日积分发放',
        },
      });
    }

    return updated;
  }

  private formatBalance(user: UserCreditsSnapshot, now = new Date()) {
    const isActive = this.isMembershipActive(user, now);
    const dailyLimit = isActive
      ? this.normalizeDailyCredits(user.membershipLevel?.dailyCredits ?? 0)
      : 0;
    const membershipCredits = isActive ? Math.max(user.membershipDailyCredits, 0) : 0;

    return {
      permanentCredits: user.permanentCredits,
      membershipCredits: {
        remaining: membershipCredits,
        dailyLimit,
        date: user.membershipDailyDate,
      },
      total: user.permanentCredits + membershipCredits,
    };
  }

  async getBalance(userId: bigint) {
    return this.prisma.$transaction(async (tx) => {
      await this.memberships.syncUserMembershipState(tx, userId);
      const user = await tx.user.findUnique({ where: { id: userId }, select: USER_CREDITS_SELECT });
      if (!user) throw new NotFoundException('User not found');

      const synced = await this.syncMembershipDailyCredits(tx, user);
      return this.formatBalance(synced);
    });
  }

  async getLogs(userId: bigint, query: CreditLogsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);

    const where: Prisma.CreditLogWhereInput = { userId };

    if (query.type) where.type = query.type as Prisma.CreditLogWhereInput['type'];
    if (query.source) where.source = query.source as Prisma.CreditLogWhereInput['source'];

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && Number.isNaN(from.getTime())) throw new BadRequestException('Invalid from');
    if (to && Number.isNaN(to.getTime())) throw new BadRequestException('Invalid to');
    if (from || to) where.createdAt = { gte: from, lte: to };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.creditLog.count({ where }),
      this.prisma.creditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { page, pageSize, total, items };
  }

  async getTotalAvailableCredits(tx: Prisma.TransactionClient, userId: bigint) {
    await this.memberships.syncUserMembershipState(tx, userId);
    const user = await tx.user.findUnique({ where: { id: userId }, select: USER_CREDITS_SELECT });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== UserStatus.active) throw new ForbiddenException('User is banned');

    const synced = await this.syncMembershipDailyCredits(tx, user);
    const balance = this.formatBalance(synced);
    return {
      permanentCredits: balance.permanentCredits,
      membershipCredits: balance.membershipCredits.remaining,
      total: balance.total,
    };
  }

  async consumeCredits(
    tx: Prisma.TransactionClient,
    userId: bigint,
    cost: number,
    relatedId?: bigint,
    description?: string,
  ): Promise<{ creditsCost: number; creditSource: CreditSource }> {
    if (cost <= 0) return { creditsCost: 0, creditSource: CreditSource.permanent };

    const now = new Date();
    await this.memberships.syncUserMembershipState(tx, userId, now);
    const user = await tx.user.findUnique({ where: { id: userId }, select: USER_CREDITS_SELECT });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== UserStatus.active) throw new ForbiddenException('User is banned');

    const synced = await this.syncMembershipDailyCredits(tx, user, now);

    const availableMembership = this.isMembershipActive(synced, now)
      ? Math.max(synced.membershipDailyCredits, 0)
      : 0;
    const totalAvailable = availableMembership + synced.permanentCredits;
    if (totalAvailable < cost) throw new BadRequestException('Insufficient credits');

    const usedMembership = Math.min(availableMembership, cost);
    const usedPermanent = cost - usedMembership;

    if (usedMembership > 0) {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { membershipDailyCredits: { decrement: usedMembership } },
        select: { membershipDailyCredits: true },
      });

      await tx.creditLog.create({
        data: {
          userId,
          amount: -usedMembership,
          balanceAfter: updated.membershipDailyCredits,
          type: 'consume',
          source: 'membership',
          relatedId,
          description: description ?? 'Consume credits',
        },
      });
    }

    if (usedPermanent > 0) {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { permanentCredits: { decrement: usedPermanent } },
        select: { permanentCredits: true },
      });

      await tx.creditLog.create({
        data: {
          userId,
          amount: -usedPermanent,
          balanceAfter: updated.permanentCredits,
          type: 'consume',
          source: 'permanent',
          relatedId,
          description: description ?? 'Consume credits',
        },
      });
    }

    const creditSource = usedPermanent > 0 ? CreditSource.permanent : CreditSource.membership;
    return { creditsCost: cost, creditSource };
  }

  async refundCredits(
    tx: Prisma.TransactionClient,
    userId: bigint,
    relatedId: bigint,
    description?: string,
    options?: RefundCreditsOptions,
  ) {
    const scopedKeyword = options?.scopeDescriptionContains?.trim();
    const baseWhere: Prisma.CreditLogWhereInput = {
      userId,
      relatedId,
      type: { in: ['consume', 'refund'] },
    };

    const fetchLogs = async (withScope: boolean) =>
      tx.creditLog.findMany({
        where: withScope && scopedKeyword ? { ...baseWhere, description: { contains: scopedKeyword } } : baseWhere,
        orderBy: { createdAt: 'asc' },
      });

    let logs = await fetchLogs(Boolean(scopedKeyword));
    // Backward compatibility: if scoped logs are empty, fallback to unscoped query.
    if (!logs.length && scopedKeyword) {
      logs = await fetchLogs(false);
    }

    if (!logs.length) return { ok: true, skipped: true };

    type RefundBucket = {
      source: CreditSource;
      consumed: number;
      refunded: number;
    };

    const buckets = new Map<CreditSource, RefundBucket>();

    for (const log of logs) {
      const source = log.source as CreditSource;
      const existing = buckets.get(source) ?? { source, consumed: 0, refunded: 0 };

      if (log.type === 'consume' && log.amount < 0) {
        existing.consumed += -log.amount;
      }
      if (log.type === 'refund' && log.amount > 0) {
        existing.refunded += log.amount;
      }

      buckets.set(source, existing);
    }

    let refundedCount = 0;
    let remainingCap = Number.POSITIVE_INFINITY;
    if (typeof options?.maxRefundAmount === 'number' && Number.isFinite(options.maxRefundAmount)) {
      remainingCap = Math.max(Math.trunc(options.maxRefundAmount), 0);
    }

    for (const bucket of buckets.values()) {
      if (remainingCap <= 0) break;

      let refundAmount = bucket.consumed - bucket.refunded;
      if (Number.isFinite(remainingCap)) {
        refundAmount = Math.min(refundAmount, remainingCap);
      }
      if (refundAmount <= 0) continue;

      if (bucket.source === CreditSource.permanent) {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { permanentCredits: { increment: refundAmount } },
          select: { permanentCredits: true },
        });

        await tx.creditLog.create({
          data: {
            userId,
            amount: refundAmount,
            balanceAfter: updatedUser.permanentCredits,
            type: 'refund',
            source: 'permanent',
            relatedId,
            description: description ?? 'Refund credits',
          },
        });

        refundedCount += 1;
        remainingCap -= refundAmount;
        continue;
      }

      await this.memberships.syncUserMembershipState(tx, userId);
      const user = await tx.user.findUnique({ where: { id: userId }, select: USER_CREDITS_SELECT });
      if (!user) throw new NotFoundException('User not found');
      const synced = await this.syncMembershipDailyCredits(tx, user);
      const activeMembership = this.isMembershipActive(synced, new Date());

      if (activeMembership) {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { membershipDailyCredits: { increment: refundAmount } },
          select: { membershipDailyCredits: true },
        });

        await tx.creditLog.create({
          data: {
            userId,
            amount: refundAmount,
            balanceAfter: updatedUser.membershipDailyCredits,
            type: 'refund',
            source: 'membership',
            relatedId,
            description: description ?? 'Refund credits',
          },
        });
      } else {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { permanentCredits: { increment: refundAmount } },
          select: { permanentCredits: true },
        });

        await tx.creditLog.create({
          data: {
            userId,
            amount: refundAmount,
            balanceAfter: updatedUser.permanentCredits,
            type: 'refund',
            source: 'permanent',
            relatedId,
            description: `${description ?? 'Refund credits'} (会员积分已过期，退回永久积分)`,
          },
        });
      }

      refundedCount += 1;
      remainingCap -= refundAmount;
    }

    return { ok: true, skipped: refundedCount === 0 };
  }
}
