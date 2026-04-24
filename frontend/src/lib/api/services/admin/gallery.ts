/**
 * 管理员 - 画廊审核 API 服务（匹配后端实际实现）
 */

import { adminApiClient } from '@/lib/api/adminClient'
import type { ImageTask } from '@/lib/api/types/images'
import type { VideoTask } from '@/lib/api/types/videos'

export const adminGalleryService = {
  /**
   * 获取图片列表（支持用户名和公开状态筛选）
   */
  getImages: async (params?: { username?: string; isPublic?: string; moderationStatus?: string }): Promise<ImageTask[]> => {
    return adminApiClient.get('/gallery/images', { params })
  },

  /**
   * 获取视频列表（支持用户名和公开状态筛选）
   */
  getVideos: async (params?: { username?: string; isPublic?: string; moderationStatus?: string }): Promise<VideoTask[]> => {
    return adminApiClient.get('/gallery/videos', { params })
  },

  /**
   * 审核作品公开申请
   */
  moderateItem: async (
    type: 'image' | 'video',
    id: string,
    payload: { status: 'approved' | 'rejected'; title?: string; message?: string }
  ): Promise<ImageTask | VideoTask> => {
    return adminApiClient.put(`/gallery/${type}/${id}/moderate`, payload)
  },

  /**
   * 隐藏内容
   */
  hideItem: async (
    type: 'image' | 'video',
    id: string,
    payload?: { title?: string; message?: string }
  ): Promise<ImageTask | VideoTask> => {
    return adminApiClient.put(`/gallery/${type}/${id}/hide`, payload ?? {})
  },

  /**
   * 删除内容
   */
  deleteItem: async (
    type: 'image' | 'video',
    id: string,
    payload?: { title?: string; message?: string }
  ): Promise<{ ok: boolean }> => {
    return adminApiClient.delete(`/gallery/${type}/${id}`, { data: payload ?? {} })
  },
}
