/**
 * 管理后台 - 套餐管理 API 服务
 */

import { adminApiClient } from '@/lib/api/adminClient'
import type {
  AdminPackage,
  CreatePackageDto,
  UpdatePackageDto,
} from '@/lib/api/types/admin/packages'

export const adminPackageService = {
  /**
   * 获取套餐列表
   * GET /admin/packages
   */
  async getPackages(): Promise<AdminPackage[]> {
    return adminApiClient.get('/packages')
  },

  /**
   * 获取套餐详情
   * GET /admin/packages/:id
   */
  async getPackage(id: string): Promise<AdminPackage> {
    return adminApiClient.get(`/packages/${id}`)
  },

  /**
   * 创建套餐
   * POST /admin/packages
   */
  async createPackage(dto: CreatePackageDto): Promise<AdminPackage> {
    return adminApiClient.post('/packages', dto)
  },

  /**
   * 更新套餐
   * PUT /admin/packages/:id
   */
  async updatePackage(id: string, dto: UpdatePackageDto): Promise<AdminPackage> {
    return adminApiClient.put(`/packages/${id}`, dto)
  },

  /**
   * 删除套餐
   * DELETE /admin/packages/:id
   */
  async deletePackage(id: string): Promise<{ ok: boolean }> {
    return adminApiClient.delete(`/packages/${id}`)
  },
}
