/**
 * 管理员 - 用户管理类型定义
 */

// 用户角色
export type UserRole = 'user' | 'admin'

// 用户状态
export type UserStatus = 'active' | 'banned' | 'unverified'

// 用户基本信息
export interface AdminUser {
  id: string
  email: string
  username: string | null
  avatar: string | null
  role: UserRole
  status: UserStatus
  banReason: string | null
  banExpireAt: string | null
  permanentCredits: number // 后端返回 permanentCredits
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export interface AdminUserAuthEvent {
  id: string
  type: 'register' | 'login'
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface AdminUserInviter {
  id: string
  email: string
  username: string | null
  avatar: string | null
  invitedAt: string | null
}

export interface AdminUserInvitee {
  id: string
  email: string
  username: string | null
  avatar: string | null
  invitedAt: string | null
  createdAt: string
}

// 用户列表项
export interface AdminUserListItem {
  id: string
  email: string
  username: string | null
  avatar: string | null
  role: UserRole
  status: UserStatus
  banReason: string | null
  banExpireAt: string | null
  permanentCredits: number // 后端返回 permanentCredits
  createdAt: string
  lastLoginAt: string | null
}

// 用户详情（包含额外信息）
export interface AdminUserDetail extends AdminUser {
  emailVerified: boolean
  inviteCode: string | null
  invitedAt: string | null
  invitedBy: AdminUserInviter | null
  inviteesCount: number
  invitees: AdminUserInvitee[]
  membership?: {
    isActive: boolean
    levelId: string
    levelName: string
    color: string
    expireAt: string
    daysLeft: number
  } | null
  authEvents: AdminUserAuthEvent[]
  // 注意：后端暂不返回以下字段，前端显示时使用 permanentCredits
  // creditsTotal, creditsUsed, imagesCount, videosCount, tasksCount
}

// 用户列表筛选参数
export interface UserFilterParams {
  page?: number
  pageSize?: number
  search?: string // 搜索邮箱或用户名
  role?: UserRole // 筛选角色
  status?: UserStatus // 筛选状态
  sortBy?: 'createdAt' | 'lastLoginAt' | 'credits'
  sortOrder?: 'asc' | 'desc'
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 用户列表响应
export type AdminUserListResponse = PaginatedResponse<AdminUserListItem>

// 用户详情响应
export interface AdminUserDetailResponse {
  user: AdminUserDetail
}

// 更新用户状态 DTO
export interface UpdateUserStatusDto {
  status: 'active' | 'banned'
  reason?: string
  banDays?: number
}

// 调整用户点数 DTO
export interface AdjustCreditsDto {
  amount: number // 正数为增加，负数为扣除
  type: 'add' | 'deduct'
  reason: string // 调整原因
}

export interface GrantMembershipDto {
  levelId: string
  period: 'monthly' | 'yearly'
  cycles?: number
  grantBonusCredits?: boolean
}

export interface GrantMembershipResult {
  ok: boolean
  expireAt: string
  durationDays: number
  grantedPermanentCredits: number
  membership: {
    isActive: boolean
    levelId: string
    levelName: string
    color: string
    expireAt: string
    daysLeft: number
  } | null
}

export interface SendUserMessageDto {
  title: string
  content: string
  level?: 'info' | 'success' | 'error'
  allowHtml?: boolean
}

export interface DeleteAdminUserResult {
  ok: boolean
  id: string
}

// 点数调整记录
export interface CreditTransaction {
  id: string
  userId: string
  amount: number
  type: 'add' | 'deduct' | 'purchase' | 'consume'
  reason: string
  balanceBefore: number
  balanceAfter: number
  createdAt: string
  createdBy?: string // 操作管理员ID
}

// 用户创作历史项
export interface UserCreationItem {
  id: string
  type: 'image' | 'video'
  prompt: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  url: string | null
  thumbnailUrl: string | null
  creditsUsed: number
  createdAt: string
}

// 用户创作历史响应
export type UserCreationListResponse = PaginatedResponse<UserCreationItem>
