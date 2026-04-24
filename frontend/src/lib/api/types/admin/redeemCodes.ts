/**
 * 管理后台 - 兑换码管理类型定义
 */

export type RedeemCodeType = 'membership' | 'credits'
export type RedeemCodeStatus = 'active' | 'disabled' | 'expired'
export type MembershipPeriod = 'monthly' | 'yearly'

export interface AdminRedeemCode {
  id: string
  code: string
  type: RedeemCodeType
  membershipLevelId: string | null
  membershipPeriod: MembershipPeriod | null
  membershipCycles: number | null
  membershipLevel?: {
    id: string
    name: string
  } | null
  credits: number | null
  maxUseCount: number
  usedCount: number
  expireDate: string | null
  status: RedeemCodeStatus
  description: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateRedeemCodeDto {
  code?: string
  type: RedeemCodeType
  membershipLevelId?: string | null
  membershipPeriod?: MembershipPeriod | null
  membershipCycles?: number | null
  credits?: number | null
  maxUseCount?: number
  expireDate?: string | null
  status?: RedeemCodeStatus
  description?: string | null
}

export interface BatchCreateRedeemCodeDto {
  count: number
  type: RedeemCodeType
  membershipLevelId?: string | null
  membershipPeriod?: MembershipPeriod | null
  membershipCycles?: number | null
  credits?: number | null
  maxUseCount?: number
  expireDate?: string | null
  status?: RedeemCodeStatus
  description?: string | null
}

export interface BatchCreateResult {
  count: number
  codes: AdminRedeemCode[]
}

export interface UpdateRedeemCodeDto {
  code?: string
  type?: RedeemCodeType
  membershipLevelId?: string | null
  membershipPeriod?: MembershipPeriod | null
  membershipCycles?: number | null
  credits?: number | null
  maxUseCount?: number
  expireDate?: string | null
  status?: RedeemCodeStatus
  description?: string | null
}

export interface RedeemLog {
  id: string
  userId: string
  codeId: string
  code: string
  type: RedeemCodeType
  membershipLevelId: string | null
  membershipPeriod: MembershipPeriod | null
  membershipCycles: number | null
  membershipLevel?: {
    id: string
    name: string
  } | null
  credits: number | null
  redeemedAt: string
}
