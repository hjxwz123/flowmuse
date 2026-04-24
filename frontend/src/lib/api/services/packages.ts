/**
 * 套餐 Packages 服务
 * 基于 docs/api/04-packages.md
 */

import { apiClient } from '../client'
import '../interceptors'
import type { Package, PackagesQuery } from '../types/packages'

export const packageService = {
  /**
   * 获取套餐列表
   * GET /packages
   */
  async getPackages(query?: PackagesQuery): Promise<Package[]> {
    return apiClient.get('/packages', {
      params: query,
    })
  },

  /**
   * 获取套餐详情
   * GET /packages/:id
   */
  async getPackage(id: string): Promise<Package> {
    return apiClient.get(`/packages/${id}`)
  },
}
