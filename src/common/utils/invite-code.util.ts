import * as crypto from 'crypto';

export function normalizeInviteCode(value?: string | null) {
  const normalized = value?.trim().toUpperCase() ?? '';
  return normalized || null;
}

export function buildInviteCode(userId: bigint) {
  const base = userId.toString(36).toUpperCase();
  const digest = crypto.createHash('sha1').update(userId.toString()).digest('hex').slice(0, 4).toUpperCase();
  return `INV${base}${digest}`;
}
