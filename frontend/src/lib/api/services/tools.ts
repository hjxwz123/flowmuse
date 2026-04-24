/**
 * 工具 API 服务（用户端）
 */

import { apiClient } from '../client'
import '../interceptors'
import type { Tool, ToolQueryParams } from '../types/tools'

export const toolService = {
  getActiveTools: async (params?: ToolQueryParams): Promise<Tool[]> => {
    return apiClient.get('/tools', { params })
  },

  getOne: async (id: string): Promise<Tool> => {
    return apiClient.get(`/tools/${id}`)
  },
}
