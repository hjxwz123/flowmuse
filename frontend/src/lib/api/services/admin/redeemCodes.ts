/**
 * 管理后台 - 兑换码管理 API 服务
 */

import { adminApiClient } from '@/lib/api/adminClient'
import type {
  AdminRedeemCode,
  CreateRedeemCodeDto,
  BatchCreateRedeemCodeDto,
  BatchCreateResult,
  UpdateRedeemCodeDto,
  RedeemLog,
} from '@/lib/api/types/admin/redeemCodes'

export const adminRedeemCodeService = {
  /**
   * 获取兑换码列表
   * GET /admin/redeem-codes
   */
  async getRedeemCodes(): Promise<AdminRedeemCode[]> {
    return adminApiClient.get('/redeem-codes')
  },

  /**
   * 创建单个兑换码
   * POST /admin/redeem-codes
   */
  async createRedeemCode(dto: CreateRedeemCodeDto): Promise<AdminRedeemCode> {
    return adminApiClient.post('/redeem-codes', dto)
  },

  /**
   * 批量生成兑换码
   * POST /admin/redeem-codes/batch
   */
  async batchCreateRedeemCodes(
    dto: BatchCreateRedeemCodeDto
  ): Promise<BatchCreateResult> {
    return adminApiClient.post('/redeem-codes/batch', dto)
  },

  /**
   * 更新兑换码
   * PUT /admin/redeem-codes/:id
   */
  async updateRedeemCode(
    id: string,
    dto: UpdateRedeemCodeDto
  ): Promise<AdminRedeemCode> {
    return adminApiClient.put(`/redeem-codes/${id}`, dto)
  },

  /**
   * 删除兑换码
   * DELETE /admin/redeem-codes/:id
   */
  async deleteRedeemCode(id: string): Promise<{ ok: boolean }> {
    return adminApiClient.delete(`/redeem-codes/${id}`)
  },

  /**
   * 获取兑换码使用记录
   * GET /admin/redeem-codes/:id/logs
   */
  async getRedeemLogs(id: string): Promise<RedeemLog[]> {
    return adminApiClient.get(`/redeem-codes/${id}/logs`)
  },

  /**
   * 导出所有兑换码
   * GET /admin/redeem-codes/export
   */
  async exportRedeemCodes(): Promise<AdminRedeemCode[]> {
    return adminApiClient.get('/redeem-codes/export')
  },
}
