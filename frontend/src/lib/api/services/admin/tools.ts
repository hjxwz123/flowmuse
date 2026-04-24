/**
 * 工具 API 服务（管理员端）
 */

import { apiClient } from '../../client'
import '../../interceptors'
import type { Tool, CreateToolRequest, ToolQueryParams } from '../../types/tools'

export const adminToolService = {
  getTools: async (params?: ToolQueryParams): Promise<Tool[]> => {
    return apiClient.get('/admin/tools', { params })
  },

  getOne: async (id: string): Promise<Tool> => {
    return apiClient.get(`/admin/tools/${id}`)
  },

  createTool: async (data: CreateToolRequest): Promise<Tool> => {
    return apiClient.post('/admin/tools', data)
  },

  updateTool: async (id: string, data: Partial<CreateToolRequest>): Promise<Tool> => {
    return apiClient.put(`/admin/tools/${id}`, data)
  },

  deleteTool: async (id: string): Promise<{ ok: boolean }> => {
    return apiClient.delete(`/admin/tools/${id}`)
  },
}
