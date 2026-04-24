/**
 * 管理员 - 站点设置 API 服务
 * 基于 docs/api/admin/12-site.md
 */

import { adminApiClient } from '@/lib/api/adminClient'
import type {
  SiteSettings,
  UpdateSiteSettingsRequest,
  EmailWhitelistSettings,
  UpdateEmailWhitelistRequest,
} from '@/lib/api/types/admin/site'

export const adminSiteService = {
  /**
   * 获取站点设置
   * GET /admin/site/settings
   */
  getSettings: async (): Promise<SiteSettings> => {
    return adminApiClient.get('/site/settings')
  },

  /**
   * 更新站点设置
   * PUT /admin/site/settings
   */
  updateSettings: async (data: UpdateSiteSettingsRequest): Promise<SiteSettings> => {
    return adminApiClient.put('/site/settings', data)
  },

  /**
   * 获取邮箱域名白名单设置
   * GET /admin/site/email-whitelist
   */
  getEmailWhitelist: async (): Promise<EmailWhitelistSettings> => {
    return adminApiClient.get('/site/email-whitelist')
  },

  /**
   * 更新邮箱域名白名单设置
   * PUT /admin/site/email-whitelist
   */
  updateEmailWhitelist: async (data: UpdateEmailWhitelistRequest): Promise<EmailWhitelistSettings> => {
    return adminApiClient.put('/site/email-whitelist', data)
  },
}
