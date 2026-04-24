/**
 * 管理员 - 画廊审核类型定义
 */

// 内容类型
export type ContentType = 'image' | 'video'

// 审核状态
export type ModerationStatus = 'pending' | 'approved' | 'rejected'

// 可见性
export type Visibility = 'public' | 'private'

// 画廊内容项
export interface GalleryItem {
  id: string
  taskId: string
  userId: string
  userEmail: string
  username: string | null
  type: ContentType
  modelName: string
  prompt: string
  url: string
  thumbnailUrl: string
  visibility: Visibility
  moderationStatus: ModerationStatus
  moderationNote: string | null
  moderatedBy: string | null
  moderatedAt: string | null
  likeCount: number
  viewCount: number
  featured: boolean
  createdAt: string
  updatedAt: string
}

// 画廊列表筛选参数
export interface GalleryFilterParams {
  page?: number
  pageSize?: number
  type?: ContentType
  visibility?: Visibility
  moderationStatus?: ModerationStatus
  userId?: string
  search?: string // 搜索用户邮箱或prompt
  featured?: boolean
  sortBy?: 'createdAt' | 'likeCount' | 'viewCount'
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

// 画廊列表响应
export type GalleryListResponse = PaginatedResponse<GalleryItem>

// 画廊统计
export interface GalleryStats {
  total: number
  pending: number
  approved: number
  rejected: number
  public: number
  private: number
  featured: number
  todayCount: number
}

// 审核内容 DTO
export interface ModerateContentDto {
  status: ModerationStatus
  note?: string
}

// 批量审核 DTO
export interface BatchModerateDto {
  itemIds: string[]
  status: ModerationStatus
  note?: string
}

// 更新可见性 DTO
export interface UpdateVisibilityDto {
  visibility: Visibility
}

// 设置精选 DTO
export interface SetFeaturedDto {
  featured: boolean
}
