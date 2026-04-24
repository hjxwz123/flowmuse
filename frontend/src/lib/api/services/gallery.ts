/**
 * 画廊 Gallery API 服务
 * 基于 docs/api/10-gallery.md
 */

import { apiClient } from '../client'
import '../interceptors'
import type {
  ApiTask,
  GalleryItemDetail,
  GallerySearchResult,
  FavoriteRecord,
  OkResponse,
} from '../types'
import type { GalleryComment, GalleryCommentPage } from '../types/gallery'
import type { PaginationParams, PaginatedResult, SlicePaginatedResult } from '../types/pagination'

export const galleryService = {
  /**
   * 获取公开图片列表
   * GET /gallery/public/images?q=xxx
   */
  getPublicImages: async (params?: { q?: string } & PaginationParams): Promise<PaginatedResult<ApiTask>> => {
    return apiClient.get('/gallery/public/images', { params })
  },

  /**
   * 获取公开视频列表
   * GET /gallery/public/videos?q=xxx
   */
  getPublicVideos: async (params?: { q?: string } & PaginationParams): Promise<PaginatedResult<ApiTask>> => {
    return apiClient.get('/gallery/public/videos', { params })
  },

  getPublicFeed: async (params?: { q?: string } & PaginationParams): Promise<SlicePaginatedResult<ApiTask>> => {
    return apiClient.get('/gallery/public/feed', { params })
  },

  /**
   * 跨类型搜索（同时搜索图片+视频）
   * GET /gallery/search?q=xxx
   */
  search: async (query: string): Promise<GallerySearchResult> => {
    return apiClient.get('/gallery/search', {
      params: { q: query },
    })
  },

  /**
   * 获取作品详情（包含点赞数/收藏数）
   * GET /gallery/:type/:id
   */
  getItemDetail: async (
    type: 'image' | 'video',
    id: string
  ): Promise<GalleryItemDetail> => {
    return apiClient.get(`/gallery/${type}/${id}`)
  },

  /**
   * 点赞作品
   * POST /gallery/:type/:id/like
   */
  likeItem: async (type: 'image' | 'video', id: string): Promise<OkResponse> => {
    return apiClient.post(`/gallery/${type}/${id}/like`)
  },

  /**
   * 取消点赞
   * DELETE /gallery/:type/:id/like
   */
  unlikeItem: async (
    type: 'image' | 'video',
    id: string
  ): Promise<OkResponse> => {
    return apiClient.delete(`/gallery/${type}/${id}/like`)
  },

  /**
   * 收藏作品
   * POST /gallery/:type/:id/favorite
   */
  favoriteItem: async (
    type: 'image' | 'video',
    id: string
  ): Promise<OkResponse> => {
    return apiClient.post(`/gallery/${type}/${id}/favorite`)
  },

  /**
   * 取消收藏
   * DELETE /gallery/:type/:id/favorite
   */
  unfavoriteItem: async (
    type: 'image' | 'video',
    id: string
  ): Promise<OkResponse> => {
    return apiClient.delete(`/gallery/${type}/${id}/favorite`)
  },

  /**
   * 获取我的收藏列表
   * GET /gallery/my/favorites
   */
  getMyFavorites: async (params?: PaginationParams): Promise<PaginatedResult<FavoriteRecord>> => {
    return apiClient.get('/gallery/my/favorites', { params })
  },

  /**
   * 获取我的图片作品
   * GET /gallery/my/images
   */
  getMyImages: async (params?: PaginationParams): Promise<PaginatedResult<ApiTask>> => {
    return apiClient.get('/gallery/my/images', { params })
  },

  /**
   * 获取我的视频作品
   * GET /gallery/my/videos
   */
  getMyVideos: async (params?: PaginationParams): Promise<PaginatedResult<ApiTask>> => {
    return apiClient.get('/gallery/my/videos', { params })
  },

  // ─── 评论 ──────────────────────────────────────────────────────────────────

  getComments: async (type: 'image' | 'video', id: string, params?: PaginationParams): Promise<GalleryCommentPage> => {
    return apiClient.get(`/gallery/${type}/${id}/comments`, { params })
  },

  createComment: async (type: 'image' | 'video', id: string, content: string): Promise<GalleryComment> => {
    return apiClient.post(`/gallery/${type}/${id}/comments`, { content })
  },

  deleteComment: async (type: 'image' | 'video', id: string, commentId: string): Promise<OkResponse> => {
    return apiClient.delete(`/gallery/${type}/${id}/comments/${commentId}`)
  },
}
