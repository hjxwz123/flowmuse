/**
 * 兑换码 Redeem 类型定义
 */

export interface RedeemDto {
  code: string
}

export type RedeemResultCredits = {
  ok: true
  type: 'credits'
  credits: number
  code: string
}

export type RedeemResultMembership = {
  ok: true
  type: 'membership'
  membershipLevelId: string
  membershipLevelName: string
  membershipLevelNameEn?: string | null
  membershipPeriod: 'monthly' | 'yearly'
  membershipCycles: number
  expireAt: string
  bonusPermanentCredits: number
  code: string
}

export type RedeemResult = RedeemResultCredits | RedeemResultMembership

export interface RedeemLog {
  id: string
  userId: string
  codeId: string
  code: string
  type: 'membership' | 'credits'
  membershipLevelId: string | null
  membershipPeriod: 'monthly' | 'yearly' | null
  membershipCycles: number | null
  credits: number | null
  redeemedAt: string
}
