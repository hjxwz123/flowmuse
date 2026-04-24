/**
 * 管理员 - 统计仪表板 API 服务
 */

import { adminApiClient } from '@/lib/api/adminClient'
import type {
  DashboardData,
  DashboardFilterParams,
} from '@/lib/api/types/admin/dashboard'

export const adminDashboardService = {
  /**
   * 获取仪表板数据
   */
  getDashboardData: async (
    params?: DashboardFilterParams
  ): Promise<DashboardData> => {
    return adminApiClient.get('/dashboard', { params })
  },
}
