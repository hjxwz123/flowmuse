/**
 * 模板 API 类型定义
 */

export interface Template {
  id: string
  title: string
  description?: string
  coverUrl?: string
  prompt: string
  type: 'image' | 'video'
  modelId?: string
  parameters?: Record<string, unknown>
  category?: string
  isPublic: boolean
  sortOrder: number
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface TemplateQueryParams {
  type?: 'image' | 'video'
  category?: string
}

export interface CreateTemplateRequest {
  title: string
  description?: string
  coverUrl?: string
  prompt: string
  type: 'image' | 'video'
  modelId?: string
  parameters?: Record<string, unknown>
  category?: string
  isPublic?: boolean
  sortOrder?: number
}
