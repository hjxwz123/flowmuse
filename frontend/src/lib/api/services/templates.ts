/**
 * 模板 API 服务（用户端）
 */

import { apiClient } from '../client'
import '../interceptors'
import type { Template, TemplateQueryParams, CreateTemplateRequest } from '../types/templates'

export const templateService = {
  /**
   * 获取系统公开模板列表
   * GET /templates
   */
  getPublicTemplates: async (params?: TemplateQueryParams): Promise<Template[]> => {
    return apiClient.get('/templates', { params })
  },

  /**
   * 获取单个模板
   * GET /templates/:id
   */
  getOne: async (id: string): Promise<Template> => {
    return apiClient.get(`/templates/${id}`)
  },

  /**
   * 获取当前用户的个人预设
   * GET /templates/presets
   */
  getMyPresets: async (params?: TemplateQueryParams): Promise<Template[]> => {
    return apiClient.get('/templates/presets', { params })
  },

  /**
   * 保存个人预设
   * POST /templates/presets
   */
  savePreset: async (data: CreateTemplateRequest): Promise<Template> => {
    return apiClient.post('/templates/presets', data)
  },

  /**
   * 更新个人预设
   * PUT /templates/presets/:id
   */
  updatePreset: async (id: string, data: Partial<CreateTemplateRequest>): Promise<Template> => {
    return apiClient.put(`/templates/presets/${id}`, data)
  },

  /**
   * 删除个人预设
   * DELETE /templates/presets/:id
   */
  deletePreset: async (id: string): Promise<{ ok: boolean }> => {
    return apiClient.delete(`/templates/presets/${id}`)
  },
}
