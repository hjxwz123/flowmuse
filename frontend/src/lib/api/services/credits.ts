/**
 * 点数 Credits 服务
 * 基于 docs/api/06-credits.md
 */

import { apiClient } from '../client'
import '../interceptors'
import type { CreditBalance, CreditLog, CreditLogsQuery } from '../types/credits'
import type { PaginatedResponse } from '../types/common'

export const creditService = {
  /**
   * 获取点数余额
   * GET /credits/balance
   */
  async getBalance(): Promise<CreditBalance> {
    return apiClient.get('/credits/balance')
  },

  /**
   * 获取点数流水
   * GET /credits/logs
   */
  async getLogs(query?: CreditLogsQuery): Promise<PaginatedResponse<CreditLog>> {
    return apiClient.get('/credits/logs', { params: query })
  },
}
