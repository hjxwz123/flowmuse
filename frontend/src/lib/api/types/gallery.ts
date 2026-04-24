/**
 * 画廊 Gallery 相关类型定义
 * 基于 docs/api/10-gallery.md
 */

import type { ApiTask } from './task'
import type { PaginatedResult } from './pagination'

// 创作者信息
export interface GalleryCreator {
  id: string
  username: string | null
  email: string
  avatar: string | null
}

// 评论
export interface GalleryComment {
  id: string
  userId: string
  username: string | null
  email: string
  avatar: string | null
  content: string
  createdAt: string
}

// 画廊作品详情（包含点赞数/收藏数）
export interface GalleryItemDetail {
  item: ApiTask & { creator?: GalleryCreator | null }
  likeCount: number
  favoriteCount: number
}

// 搜索结果
export interface GallerySearchResult {
  images: ApiTask[]
  videos: ApiTask[]
}

// 收藏记录
export interface FavoriteRecord {
  targetType: 'image' | 'video'
  targetId: string
  createdAt: string
  item: ApiTask
}

export type GalleryCommentPage = PaginatedResult<GalleryComment>
