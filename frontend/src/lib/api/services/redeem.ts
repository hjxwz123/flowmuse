/**
 * 兑换码 Redeem 服务
 * 基于 docs/api/05-redeem.md
 */

import { apiClient } from '../client'
import '../interceptors'
import type { RedeemDto, RedeemResult, RedeemLog } from '../types/redeem'

export const redeemService = {
  /**
   * 兑换兑换码
   * POST /redeem
   */
  async redeem(data: RedeemDto): Promise<RedeemResult> {
    return apiClient.post('/redeem', data)
  },

  /**
   * 获取兑换历史
   * GET /redeem/history
   */
  async getHistory(): Promise<RedeemLog[]> {
    return apiClient.get('/redeem/history')
  },
}
