/**
 * 公告类型定义
 * 基于 docs/api/13-site.md
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
