/**
 * 管理员模板 API 服务
 */

import { apiClient } from '../../client'
import '../../interceptors'
import type { Template, TemplateQueryParams, CreateTemplateRequest } from '../../types/templates'

export const adminTemplateService = {
  /**
   * 获取所有系统模板
   * GET /admin/templates
   */
  getTemplates: async (params?: TemplateQueryParams): Promise<Template[]> => {
    return apiClient.get('/admin/templates', { params })
  },

  /**
   * 获取单个模板
   * GET /admin/templates/:id
   */
  getOne: async (id: string): Promise<Template> => {
    return apiClient.get(`/admin/templates/${id}`)
  },

  /**
   * 创建系统模板
   * POST /admin/templates
   */
  createTemplate: async (data: CreateTemplateRequest): Promise<Template> => {
    return apiClient.post('/admin/templates', data)
  },

  /**
   * 更新系统模板
   * PUT /admin/templates/:id
   */
  updateTemplate: async (id: string, data: Partial<CreateTemplateRequest>): Promise<Template> => {
    return apiClient.put(`/admin/templates/${id}`, data)
  },

  /**
   * 删除系统模板
   * DELETE /admin/templates/:id
   */
  deleteTemplate: async (id: string): Promise<{ ok: boolean }> => {
    return apiClient.delete(`/admin/templates/${id}`)
  },
}
