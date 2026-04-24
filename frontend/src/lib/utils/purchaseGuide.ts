export type PurchaseGuideReason = 'credits' | 'membership'

const CREDIT_PATTERNS = [
  /insufficient credits/i,
  /insufficient permanent credits/i,
  /点数不足/,
  /积分不足/,
  /余额不足/,
]

const MEMBERSHIP_PATTERNS = [
  /未开通会员/,
  /请先开通会员/,
  /需要开通会员/,
  /需要会员/,
  /仅会员/,
  /会员可用/,
  /会员专享/,
  /成为会员/,
  /会员已过期/,
  /非会员/,
  /membership required/i,
  /free user daily question limit/i,
  /免费用户今日提问次数已达上限/,
]

export function resolvePurchaseGuideReason(message: string | null | undefined): PurchaseGuideReason | null {
  const normalized = (message ?? '').trim()
  if (!normalized) return null

  if (CREDIT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'credits'
  }

  if (MEMBERSHIP_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'membership'
  }

  return null
}
