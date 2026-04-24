/**
 * 公告 API 服务
 * 基于 docs/api/13-site.md
 */

import { apiClient } from '../client'
import '../interceptors'
import type { Announcement, AnnouncementsResponse } from '../types/announcements'

export const announcementsService = {
  /**
   * 获取当前生效的公告列表
   * GET /announcements/current
   */
  getCurrent: async (): Promise<Announcement[]> => {
    return apiClient.get('/announcements/current')
  },

  /**
   * 获取公告列表（历史公告）
   * GET /announcements
   */
  getList: async (params?: {
    page?: number
    limit?: number
  }): Promise<AnnouncementsResponse> => {
    return apiClient.get('/announcements', { params })
  },
}
