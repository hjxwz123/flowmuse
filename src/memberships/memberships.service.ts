import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipPeriod, Prisma } from '@prisma/client';

import { dateKeyToDateOnlyValue, toBeijingDateKey, toDateOnlyKey } from '../common/utils/date-only.util';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const MEMBERSHIP_LEVEL_SELECT = {
  id: true,
  name: true,
  nameEn: true,
  color: true,
  monthlyPrice: true,
  yearlyPrice: true,
  dailyCredits: true,
  bonusPermanentCredits: true,
  benefitsEn: true,
  sortOrder: true,
  isActive: true,
} satisfies Prisma.MembershipLevelSelect;

const USER_MEMBERSHIP_STATE_INCLUDE = {
  membershipLevel: {
    select: MEMBERSHIP_LEVEL_SELECT,
  },
  membershipSchedules: {
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    include: {
      membershipLevel: {
        select: MEMBERSHIP_LEVEL_SELECT,
      },
    },
  },
} satisfies Prisma.UserInclude;

type MembershipLevelSnapshot = Prisma.MembershipLevelGetPayload<{ select: typeof MEMBERSHIP_LEVEL_SELECT }>;
type UserMembershipState = Prisma.UserGetPayload<{ include: typeof USER_MEMBERSHIP_STATE_INCLUDE }>;
type MembershipClient = Prisma.TransactionClient | PrismaService;
type MembershipActionMode = 'activated' | 'renewed' | 'upgraded' | 'scheduled';

export type MembershipActivationResult = {
  mode: MembershipActionMode;
  expireAt: Date;
  durationDays: number;
  level: MembershipLevelSnapshot;
  cycles: number;
  startsAt: Date;
  activeLevel: MembershipLevelSnapshot | null;
  activeExpireAt: Date | null;
};

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveLevels() {
    return this.prisma.membershipLevel.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getUserMembership(userId: bigint, _cleanupExpired = true) {
    return this.prisma.$transaction(async (tx) => {
      await this.syncUserMembershipState(tx, userId);

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          membershipLevelId: true,
          membershipExpireAt: true,
          membershipLevel: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              color: true,
              dailyCredits: true,
            },
          },
        },
      });

      if (!user || !user.membershipLevelId || !user.membershipExpireAt || !user.membershipLevel) {
        return null;
      }

      const now = new Date();
      if (user.membershipExpireAt <= now) {
        return null;
      }

      const daysLeft = Math.max(1, Math.ceil((user.membershipExpireAt.getTime() - now.getTime()) / DAY_MS));

      return {
        isActive: true,
        levelId: user.membershipLevel.id.toString(),
        levelName: user.membershipLevel.name,
        levelNameEn: user.membershipLevel.nameEn,
        color: user.membershipLevel.color,
        dailyCredits: Math.max(0, Math.floor(user.membershipLevel.dailyCredits ?? 0)),
        expireAt: user.membershipExpireAt,
        daysLeft,
      };
    });
  }

  async getActiveMembershipLevelId(userId: bigint, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      await this.syncUserMembershipState(tx, userId, now);
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          membershipLevelId: true,
          membershipExpireAt: true,
        },
      });

      if (!user?.membershipLevelId || !user.membershipExpireAt || user.membershipExpireAt <= now) {
        return null;
      }

      return user.membershipLevelId;
    });
  }

  getMembershipDurationDays(period: MembershipPeriod) {
    return period === MembershipPeriod.yearly ? 365 : 30;
  }

  getMembershipBonusMultiplier(period: MembershipPeriod) {
    return period === MembershipPeriod.yearly ? 12 : 1;
  }

  calculateMembershipBonusCredits(
    baseBonusCredits: number,
    period: MembershipPeriod,
    cycles = 1,
  ) {
    const normalizedBase = Number.isFinite(baseBonusCredits)
      ? Math.max(0, Math.floor(baseBonusCredits))
      : 0;
    const normalizedCycles = Number.isFinite(cycles) ? Math.max(1, Math.floor(cycles)) : 1;
    return normalizedBase * this.getMembershipBonusMultiplier(period) * normalizedCycles;
  }

  async syncUserMembershipState(
    tx: MembershipClient,
    userId: bigint,
    now = new Date(),
  ) {
    const user = await this.loadMembershipState(tx, userId);
    if (!user) throw new NotFoundException('User not found');

    const hasActiveMembership = Boolean(
      user.membershipLevelId &&
      user.membershipExpireAt &&
      user.membershipExpireAt > now &&
      user.membershipLevel,
    );

    if (hasActiveMembership) {
      return;
    }

    const expiredScheduleIds: bigint[] = [];
    let nextSchedule = user.membershipSchedules.find((schedule) => {
      if (schedule.expireAt <= now) {
        expiredScheduleIds.push(schedule.id);
        return false;
      }
      return schedule.startsAt <= now;
    }) ?? null;

    if (expiredScheduleIds.length > 0) {
      await tx.userMembershipSchedule.deleteMany({
        where: { id: { in: expiredScheduleIds } },
      });
    }

    const todayKey = toBeijingDateKey(now);

    if (nextSchedule) {
      const nextDailyCredits = this.normalizeDailyCredits(nextSchedule.membershipLevel.dailyCredits);
      await tx.user.update({
        where: { id: userId },
        data: {
          membershipLevelId: nextSchedule.membershipLevelId,
          membershipExpireAt: nextSchedule.expireAt,
          membershipRateFenPerDay: nextSchedule.rateFenPerDay,
          membershipDailyCredits: nextDailyCredits,
          membershipDailyDate: dateKeyToDateOnlyValue(todayKey),
        },
      });

      await tx.userMembershipSchedule.delete({
        where: { id: nextSchedule.id },
      });
      return;
    }

    if (
      user.membershipLevelId ||
      user.membershipExpireAt ||
      user.membershipRateFenPerDay ||
      user.membershipDailyCredits > 0
    ) {
      await tx.user.update({
        where: { id: userId },
        data: {
          membershipLevelId: null,
          membershipExpireAt: null,
          membershipRateFenPerDay: null,
          membershipDailyCredits: 0,
        },
      });
    }
  }

  async activateMembership(
    tx: Prisma.TransactionClient,
    userId: bigint,
    membershipLevelId: bigint,
    period: MembershipPeriod,
    cycles = 1,
    options?: { amountFen?: number },
  ): Promise<MembershipActivationResult> {
    const normalizedCycles = Number.isFinite(cycles) ? Math.floor(cycles) : 1;
    if (normalizedCycles < 1) throw new BadRequestException('Invalid membership cycles');

    await this.syncUserMembershipState(tx, userId);

    const user = await this.loadMembershipState(tx, userId);
    if (!user) throw new NotFoundException('User not found');

    const targetLevel = await tx.membershipLevel.findUnique({
      where: { id: membershipLevelId },
      select: MEMBERSHIP_LEVEL_SELECT,
    });

    if (!targetLevel) throw new NotFoundException('Membership level not found');
    if (!targetLevel.isActive) throw new BadRequestException('Membership level is inactive');

    const now = new Date();
    const durationDays = this.getMembershipDurationDays(period) * normalizedCycles;
    const purchaseDurationMs = durationDays * DAY_MS;
    const purchaseAmountFen = this.resolvePurchaseAmountFen(targetLevel, period, normalizedCycles, options?.amountFen);
    const purchaseRateFenPerDay = this.toRateFenPerDay(purchaseAmountFen, durationDays);

    const hasActiveMembership = Boolean(
      user.membershipLevelId &&
      user.membershipExpireAt &&
      user.membershipExpireAt > now &&
      user.membershipLevel,
    );

    if (!hasActiveMembership || !user.membershipLevel || !user.membershipExpireAt) {
      const expireAt = new Date(now.getTime() + purchaseDurationMs);
      await tx.user.update({
        where: { id: userId },
        data: {
          membershipLevelId,
          membershipExpireAt: expireAt,
          membershipRateFenPerDay: purchaseRateFenPerDay,
          membershipDailyCredits: this.buildImmediateDailyCredits(user, targetLevel, false, now),
          membershipDailyDate: dateKeyToDateOnlyValue(toBeijingDateKey(now)),
        },
      });

      return {
        mode: 'activated',
        expireAt,
        durationDays,
        level: targetLevel,
        cycles: normalizedCycles,
        startsAt: now,
        activeLevel: targetLevel,
        activeExpireAt: expireAt,
      };
    }

    if (user.membershipLevel.id === targetLevel.id) {
      const previousExpireAt = user.membershipExpireAt;
      const expireAt = new Date(previousExpireAt.getTime() + purchaseDurationMs);
      const currentRateFenPerDay = this.getCurrentRateFenPerDay(user.membershipLevel, user.membershipRateFenPerDay, now, previousExpireAt);
      const remainingValueFen = this.toRemainingValueFen(currentRateFenPerDay, previousExpireAt.getTime() - now.getTime());
      const totalValueFen = remainingValueFen.plus(purchaseAmountFen);
      const totalRemainingMs = Math.max(expireAt.getTime() - now.getTime(), 0);
      const blendedRateFenPerDay = totalRemainingMs > 0
        ? totalValueFen.mul(DAY_MS).div(totalRemainingMs)
        : purchaseRateFenPerDay;

      await tx.user.update({
        where: { id: userId },
        data: {
          membershipExpireAt: expireAt,
          membershipRateFenPerDay: blendedRateFenPerDay,
          membershipDailyCredits: this.buildImmediateDailyCredits(user, targetLevel, true, now),
          membershipDailyDate: dateKeyToDateOnlyValue(toBeijingDateKey(now)),
        },
      });

      await this.shiftScheduledMemberships(tx, userId, purchaseDurationMs);

      return {
        mode: 'renewed',
        expireAt,
        durationDays,
        level: targetLevel,
        cycles: normalizedCycles,
        startsAt: now,
        activeLevel: targetLevel,
        activeExpireAt: expireAt,
      };
    }

    const levelComparison = this.compareLevelRank(targetLevel, user.membershipLevel);
    if (levelComparison > 0) {
      const previousExpireAt = user.membershipExpireAt;
      const currentRateFenPerDay = this.getCurrentRateFenPerDay(user.membershipLevel, user.membershipRateFenPerDay, now, previousExpireAt);
      const remainingValueFen = this.toRemainingValueFen(currentRateFenPerDay, previousExpireAt.getTime() - now.getTime());
      const totalValueFen = remainingValueFen.plus(purchaseAmountFen);
      const convertedDurationMs = this.toDurationMs(totalValueFen, purchaseRateFenPerDay, purchaseDurationMs);
      const expireAt = new Date(now.getTime() + convertedDurationMs);
      const deltaMs = expireAt.getTime() - previousExpireAt.getTime();

      await tx.user.update({
        where: { id: userId },
        data: {
          membershipLevelId,
          membershipExpireAt: expireAt,
          membershipRateFenPerDay: purchaseRateFenPerDay,
          membershipDailyCredits: this.buildImmediateDailyCredits(user, targetLevel, true, now),
          membershipDailyDate: dateKeyToDateOnlyValue(toBeijingDateKey(now)),
        },
      });

      await this.shiftScheduledMemberships(tx, userId, deltaMs);

      return {
        mode: 'upgraded',
        expireAt,
        durationDays,
        level: targetLevel,
        cycles: normalizedCycles,
        startsAt: now,
        activeLevel: targetLevel,
        activeExpireAt: expireAt,
      };
    }

    const scheduleTail = user.membershipSchedules[user.membershipSchedules.length - 1] ?? null;
    const startsAt = scheduleTail ? scheduleTail.expireAt : user.membershipExpireAt;
    const expireAt = new Date(startsAt.getTime() + purchaseDurationMs);

    await tx.userMembershipSchedule.create({
      data: {
        userId,
        membershipLevelId,
        startsAt,
        expireAt,
        rateFenPerDay: purchaseRateFenPerDay,
      },
    });

    return {
      mode: 'scheduled',
      expireAt,
      durationDays,
      level: targetLevel,
      cycles: normalizedCycles,
      startsAt,
      activeLevel: user.membershipLevel,
      activeExpireAt: user.membershipExpireAt,
    };
  }

  async activatePaidMembership(
    tx: Prisma.TransactionClient,
    userId: bigint,
    membershipLevelId: bigint,
    period: MembershipPeriod,
    amountFen?: number,
  ) {
    return this.activateMembership(tx, userId, membershipLevelId, period, 1, { amountFen });
  }

  async processScheduledMemberships(now = new Date()) {
    const candidateUserIds = new Set<bigint>();

    const [expiredUsers, scheduledUsers] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          membershipExpireAt: { lte: now },
        },
        select: { id: true },
      }),
      this.prisma.userMembershipSchedule.findMany({
        where: {
          OR: [
            { startsAt: { lte: now } },
            { expireAt: { lte: now } },
          ],
        },
        select: { userId: true },
      }),
    ]);

    for (const item of expiredUsers) candidateUserIds.add(item.id);
    for (const item of scheduledUsers) candidateUserIds.add(item.userId);

    for (const userId of candidateUserIds) {
      await this.prisma.$transaction(async (tx) => {
        await this.syncUserMembershipState(tx, userId, now);
      });
    }
  }

  async cleanupExpiredMemberships(now = new Date()) {
    await this.processScheduledMemberships(now);
  }

  private async loadMembershipState(tx: MembershipClient, userId: bigint) {
    return tx.user.findUnique({
      where: { id: userId },
      include: USER_MEMBERSHIP_STATE_INCLUDE,
    });
  }

  private normalizeDailyCredits(value: number | null | undefined) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(Number(value)));
  }

  private resolvePurchaseAmountFen(
    level: MembershipLevelSnapshot,
    period: MembershipPeriod,
    cycles: number,
    explicitAmountFen?: number,
  ) {
    if (typeof explicitAmountFen === 'number' && Number.isFinite(explicitAmountFen) && explicitAmountFen >= 0) {
      return Math.round(explicitAmountFen);
    }

    const unitPrice = period === MembershipPeriod.yearly
      ? Number(level.yearlyPrice)
      : Number(level.monthlyPrice);
    const unitAmountFen = Math.round(unitPrice * 100);
    return unitAmountFen * cycles;
  }

  private toRateFenPerDay(amountFen: number, durationDays: number) {
    if (amountFen <= 0 || durationDays <= 0) {
      return new Prisma.Decimal(0);
    }

    return new Prisma.Decimal(amountFen).div(durationDays);
  }

  private toRemainingValueFen(rateFenPerDay: Prisma.Decimal, remainingMs: number) {
    if (remainingMs <= 0 || rateFenPerDay.lte(0)) {
      return new Prisma.Decimal(0);
    }

    return rateFenPerDay.mul(remainingMs).div(DAY_MS);
  }

  private toDurationMs(
    totalValueFen: Prisma.Decimal,
    targetRateFenPerDay: Prisma.Decimal,
    fallbackDurationMs: number,
  ) {
    if (totalValueFen.lte(0) || targetRateFenPerDay.lte(0)) {
      return fallbackDurationMs;
    }

    return totalValueFen.mul(DAY_MS).div(targetRateFenPerDay).floor().toNumber();
  }

  private compareLevelRank(targetLevel: MembershipLevelSnapshot, currentLevel: MembershipLevelSnapshot) {
    const comparisons = [
      Number(targetLevel.monthlyPrice) - Number(currentLevel.monthlyPrice),
      Number(targetLevel.yearlyPrice) - Number(currentLevel.yearlyPrice),
      this.normalizeDailyCredits(targetLevel.dailyCredits) - this.normalizeDailyCredits(currentLevel.dailyCredits),
      (targetLevel.sortOrder ?? 0) - (currentLevel.sortOrder ?? 0),
    ];

    for (const comparison of comparisons) {
      if (comparison !== 0) return comparison;
    }

    if (targetLevel.id > currentLevel.id) return 1;
    if (targetLevel.id < currentLevel.id) return -1;
    return 0;
  }

  private getCurrentRateFenPerDay(
    currentLevel: MembershipLevelSnapshot,
    storedRate: Prisma.Decimal | null,
    now: Date,
    expireAt: Date,
  ) {
    if (storedRate && storedRate.gt(0)) {
      return storedRate;
    }

    const remainingDays = Math.max((expireAt.getTime() - now.getTime()) / DAY_MS, 0);
    const monthlyRate = this.toRateFenPerDay(Math.round(Number(currentLevel.monthlyPrice) * 100), 30);
    const yearlyRate = this.toRateFenPerDay(Math.round(Number(currentLevel.yearlyPrice) * 100), 365);

    // Legacy memberships created before rate tracking use a conservative
    // heuristic based on the remaining membership term.
    if (remainingDays >= 180) return yearlyRate;
    if (remainingDays <= 45) return monthlyRate;
    return monthlyRate.plus(yearlyRate).div(2);
  }

  private buildImmediateDailyCredits(
    user: UserMembershipState,
    level: MembershipLevelSnapshot,
    preserveTodayCredits: boolean,
    now: Date,
  ) {
    const configuredDailyCredits = this.normalizeDailyCredits(level.dailyCredits);
    if (!preserveTodayCredits) {
      return configuredDailyCredits;
    }

    const todayKey = toBeijingDateKey(now);
    const currentKey = toDateOnlyKey(user.membershipDailyDate);
    if (currentKey !== todayKey) {
      return configuredDailyCredits;
    }

    return Math.max(this.normalizeDailyCredits(user.membershipDailyCredits), configuredDailyCredits);
  }

  private async shiftScheduledMemberships(
    tx: Prisma.TransactionClient,
    userId: bigint,
    deltaMs: number,
  ) {
    if (!Number.isFinite(deltaMs) || deltaMs === 0) return;

    const schedules = await tx.userMembershipSchedule.findMany({
      where: { userId },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        startsAt: true,
        expireAt: true,
      },
    });

    for (const schedule of schedules) {
      await tx.userMembershipSchedule.update({
        where: { id: schedule.id },
        data: {
          startsAt: new Date(schedule.startsAt.getTime() + deltaMs),
          expireAt: new Date(schedule.expireAt.getTime() + deltaMs),
        },
      });
    }
  }
}
