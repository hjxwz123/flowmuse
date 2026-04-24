/**
 * 管理员 - 公告 API 服务
 * 基于 docs/api/admin/13-announcements.md
 */

import { adminApiClient } from '@/lib/api/adminClient'
import type {
  Announcement,
  AnnouncementsResponse,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
  GetAnnouncementsParams,
} from '@/lib/api/types/admin/announcements'

export const adminAnnouncementsService = {
  /**
   * 获取公告列表
   * GET /admin/announcements
   */
  getList: async (params?: GetAnnouncementsParams): Promise<AnnouncementsResponse> => {
    return adminApiClient.get('/announcements', { params })
  },

  /**
   * 获取单个公告
   * GET /admin/announcements/:id
   */
  getById: async (id: string): Promise<Announcement> => {
    return adminApiClient.get(`/announcements/${id}`)
  },

  /**
   * 创建公告
   * POST /admin/announcements
   */
  create: async (data: CreateAnnouncementRequest): Promise<Announcement> => {
    return adminApiClient.post('/announcements', data)
  },

  /**
   * 更新公告
   * PUT /admin/announcements/:id
   */
  update: async (id: string, data: UpdateAnnouncementRequest): Promise<Announcement> => {
    return adminApiClient.put(`/announcements/${id}`, data)
  },

  /**
   * 删除公告
   * DELETE /admin/announcements/:id
   */
  delete: async (id: string): Promise<{ ok: boolean }> => {
    return adminApiClient.delete(`/announcements/${id}`)
  },
}
