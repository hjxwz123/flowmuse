/**
 * 管理员 - AI 模型管理 API 服务（匹配后端 API）
 */

import { adminApiClient } from '@/lib/api/adminClient'
import type {
  Model,
  ModelFilterParams,
  CreateModelDto,
  UpdateModelDto,
} from '@/lib/api/types/admin/models'

const ARCHIVED_MODEL_NAME_PREFIX = '[DELETED#'
const ARCHIVED_MODEL_DESCRIPTION_PREFIX = 'Archived placeholder for deleted model'

function isArchivedModel(model: Model): boolean {
  return (
    model.name.startsWith(ARCHIVED_MODEL_NAME_PREFIX) ||
    (model.description?.startsWith(ARCHIVED_MODEL_DESCRIPTION_PREFIX) ?? false)
  )
}

function isIconWhitelistError(error: unknown): boolean {
  const message = (error as { response?: { data?: { message?: unknown } }; message?: unknown })
    ?.response?.data?.message ?? (error as { message?: unknown })?.message

  const asText = Array.isArray(message)
    ? message.join(' ')
    : typeof message === 'string'
      ? message
      : ''

  return asText.toLowerCase().includes('property icon should not exist')
}

function stripIconField<T extends { icon?: unknown }>(dto: T): Omit<T, 'icon'> {
  const { icon: _icon, ...rest } = dto
  return rest
}

export const adminModelService = {
  /**
   * 获取模型列表（包含关联的 channel）
   */
  getModels: async (params?: ModelFilterParams): Promise<Model[]> => {
    const models = (await adminApiClient.get('/models', { params })) as Model[]
    return models.filter((model) => !isArchivedModel(model))
  },

  /**
   * 获取模型详情（包含关联的 channel）
   */
  getModel: async (id: string): Promise<Model> => {
    return adminApiClient.get(`/models/${id}`)
  },

  /**
   * 创建模型
   */
  createModel: async (dto: CreateModelDto): Promise<Model> => {
    try {
      return await adminApiClient.post('/models', dto)
    } catch (error) {
      // 兼容旧后端：若 DTO 还未支持 icon 字段，则自动降级重试
      if (isIconWhitelistError(error)) {
        return adminApiClient.post('/models', stripIconField(dto))
      }
      throw error
    }
  },

  /**
   * 更新模型
   */
  updateModel: async (id: string, dto: UpdateModelDto): Promise<Model> => {
    try {
      return await adminApiClient.put(`/models/${id}`, dto)
    } catch (error) {
      // 兼容旧后端：若 DTO 还未支持 icon 字段，则自动降级重试
      if (isIconWhitelistError(error)) {
        return adminApiClient.put(`/models/${id}`, stripIconField(dto))
      }
      throw error
    }
  },

  /**
   * 按当前拖拽顺序批量更新模型排序
   */
  reorderModels: async (modelIds: string[]): Promise<{ ok: boolean }> => {
    return adminApiClient.post('/models/reorder', { modelIds })
  },

  /**
   * 删除模型
   */
  deleteModel: async (id: string): Promise<{ ok: boolean }> => {
    return adminApiClient.delete(`/models/${id}`)
  },
}
