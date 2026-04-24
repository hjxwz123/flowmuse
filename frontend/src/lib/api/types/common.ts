/**
 * API 通用类型定义
 * 基于 docs/api/00-common.md
 */

// 统一响应封装
export interface ApiResponse<T = unknown> {
  code: number // 0表示成功，非0表示失败
  msg: string
  data: T
}

// 分页响应
export interface PaginatedResponse<T> {
  page: number
  pageSize: number
  total: number
  items: T[]
}

// 任务状态
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed'

// 任务类型
export type TaskType = 'image' | 'video' | 'research'

// 点数来源
export type CreditSource = 'permanent' | 'membership'

// 流水类型
export type CreditLogType = 'redeem' | 'consume' | 'refund' | 'admin_adjust'

// 兑换类型
export type RedeemType = 'membership' | 'credits'

// 用户角色
export type UserRole = 'user' | 'admin'

// 用户状态
export type UserStatus = 'active' | 'banned'

// 套餐状态
export type PackageStatus = 'active' | 'expired' | 'exhausted'
