import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

type BanSnapshot = {
  status: UserStatus;
  banReason?: string | null;
  banExpireAt?: Date | null;
};

export function buildBanErrorPayload(reason?: string | null, banExpireAt?: Date | null) {
  return {
    message: 'User is banned',
    banReason: reason?.trim() || '',
    banExpireAt: banExpireAt ? banExpireAt.toISOString() : null,
  };
}

export function buildForbiddenBannedException(reason?: string | null, banExpireAt?: Date | null) {
  return new ForbiddenException(buildBanErrorPayload(reason, banExpireAt));
}

export function buildUnauthorizedBannedException(reason?: string | null, banExpireAt?: Date | null) {
  return new UnauthorizedException(buildBanErrorPayload(reason, banExpireAt));
}

export function isBanExpired(snapshot: BanSnapshot, now = new Date()) {
  return (
    snapshot.status === UserStatus.banned &&
    snapshot.banExpireAt instanceof Date &&
    snapshot.banExpireAt.getTime() <= now.getTime()
  );
}

export function calculateBanExpireAt(banDays?: number | null, now = new Date()) {
  if (!Number.isFinite(banDays)) return null;

  const normalizedDays = Math.max(0, Math.trunc(Number(banDays)));
  if (normalizedDays <= 0) return null;

  return new Date(now.getTime() + normalizedDays * 24 * 60 * 60 * 1000);
}
