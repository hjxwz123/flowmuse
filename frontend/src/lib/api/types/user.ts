/**
 * 用户相关类型定义
 * 基于 docs/api/03-user.md 和 00-common.md 5.2 UserProfile
 */

import type { UserRole, UserStatus } from './common'
import type { UserMembershipStatus } from './memberships'

// 用户资料
export interface UserProfile {
  id: string
  email: string
  username: string
  avatar: string | null
  permanentCredits: number
  role: UserRole
  status: UserStatus
  emailVerified: boolean
  createdAt: string
  membership?: UserMembershipStatus | null
}

export interface InviteInfo {
  inviteCode: string
  invitedCount: number
  totalInviterRewardCredits: number
  registerInviterCredits: number
  registerInviteeCredits: number
  invitePaymentCreditsPerYuan: number
  invitees: InviteeInfo[]
}

export interface InviteeInfo {
  id: string
  email: string
  username: string | null
  avatar: string | null
  invitedAt: string | null
  createdAt: string
}

// 更新用户资料 DTO
export interface UpdateProfileDto {
  username?: string
  avatar?: string
}

// 修改密码 DTO
export interface UpdatePasswordDto {
  oldPassword: string
  newPassword: string
}
