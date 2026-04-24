/**
 * 管理员 - 提供商管理 API 服务（匹配后端 API）
 */

import { adminApiClient } from '@/lib/api/adminClient'
import type {
  Provider,
  CreateProviderDto,
  UpdateProviderDto,
} from '@/lib/api/types/admin/providers'

export const adminProviderService = {
  /**
   * 获取提供商列表
   */
  getProviders: async (): Promise<Provider[]> => {
    return adminApiClient.get('/providers')
  },

  /**
   * 获取提供商详情
   */
  getProvider: async (id: string): Promise<Provider> => {
    return adminApiClient.get(`/providers/${id}`)
  },

  /**
   * 创建提供商
   */
  createProvider: async (dto: CreateProviderDto): Promise<Provider> => {
    return adminApiClient.post('/providers', dto)
  },

  /**
   * 更新提供商
   */
  updateProvider: async (
    id: string,
    dto: UpdateProviderDto
  ): Promise<Provider> => {
    return adminApiClient.put(`/providers/${id}`, dto)
  },

  /**
   * 删除提供商
   */
  deleteProvider: async (id: string): Promise<{ ok: boolean }> => {
    return adminApiClient.delete(`/providers/${id}`)
  },
}
