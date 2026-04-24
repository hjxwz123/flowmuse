/**
 * 管理员 - 模型提供商类型定义（匹配后端 API）
 */

// 提供商支持类型
export type ProviderSupportType = 'image' | 'video'

// 模型提供商
export interface Provider {
  id: string
  provider: string // 提供商标识（唯一，如 midjourney/flux/qwen 等）
  displayName: string // 展示名称
  adapterClass: string // 适配器类名
  icon: string | null
  supportTypes: ProviderSupportType[] // 支持类型
  defaultParams: Record<string, unknown> | null
  paramSchema: Record<string, unknown> | null
  webhookRequired: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// 创建提供商 DTO
export interface CreateProviderDto {
  provider: string
  displayName: string
  adapterClass: string
  supportTypes: ProviderSupportType[]
  defaultParams?: Record<string, unknown> | null
  paramSchema?: Record<string, unknown> | null
  webhookRequired?: boolean
  isActive?: boolean
  sortOrder?: number
}

// 更新提供商 DTO
export interface UpdateProviderDto {
  provider?: string
  displayName?: string
  adapterClass?: string
  supportTypes?: ProviderSupportType[]
  defaultParams?: Record<string, unknown> | null
  paramSchema?: Record<string, unknown> | null
  webhookRequired?: boolean
  isActive?: boolean
  sortOrder?: number
}
