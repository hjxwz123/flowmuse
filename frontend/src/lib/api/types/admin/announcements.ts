/**
 * 管理员 - 公告类型定义
 * 基于 docs/api/admin/13-announcements.md
 */

// 公告
export interface Announcement {
  id: string
  title: string
  content: string
  isActive: boolean
  isPinned: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// 公告列表响应
export interface AnnouncementsResponse {
  data: Announcement[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

// 创建公告请求
export interface CreateAnnouncementRequest {
  title: string
  content: string
  isActive: boolean
  isPinned: boolean
  sortOrder: number
}

// 更新公告请求（所有字段可选）
export interface UpdateAnnouncementRequest {
  title?: string
  content?: string
  isActive?: boolean
  isPinned?: boolean
  sortOrder?: number
}

// 公告列表查询参数
export interface GetAnnouncementsParams {
  page?: number
  limit?: number
  isActive?: boolean
  q?: string
}
