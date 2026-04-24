/**
 * 站点 API 服务
 * 基于 docs/api/13-site.md
 */

import { apiClient } from '../client'
import '../interceptors'
import type { SiteSettings } from '../types/site'
import { normalizeSiteSettings } from '@/lib/utils/siteSettings'

export const siteService = {
  /**
   * 获取站点公开设置
   * GET /site/settings
   */
  getSettings: async (): Promise<SiteSettings> => {
    const settings = await apiClient.get('/site/settings')
    return normalizeSiteSettings(settings)
  },
}
