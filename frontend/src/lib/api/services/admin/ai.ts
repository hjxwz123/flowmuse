/**
 * 管理员 - AI 配置 API 服务
 */

import { adminApiClient } from '@/lib/api/adminClient'

export interface ChatModerationAutoBanRule {
  triggerCount: number
  banDays: number
}

export interface AiSettings {
  apiBaseUrl: string
  apiKey: string
  modelName: string
  webSearchTaskModelName: string
  systemPrompt: string
  creditsCost: number
  chatModerationEnabled: boolean
  chatModerationApiBaseUrl: string
  chatModerationApiKey: string
  chatModerationModelName: string
  chatModerationSystemPrompt: string
  chatModerationAutoBanEnabled: boolean
  chatModerationAutoBanRules: ChatModerationAutoBanRule[]
}

export interface ChatModelItem {
  id: string
  name: string
  modelKey: string
  icon: string | null
  description: string | null
  systemPrompt: string | null
  provider: string
  supportsImageInput: boolean | null
  freeUserDailyQuestionLimit: number | null
  maxContextRounds: number | null
  deepResearchCreditsCost: number | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateChatModelPayload {
  name: string
  modelKey: string
  icon?: string
  description?: string
  systemPrompt?: string
  supportsImageInput?: boolean
  freeUserDailyQuestionLimit?: number | null
  maxContextRounds?: number | null
  deepResearchCreditsCost?: number | null
  isActive?: boolean
  sortOrder?: number
}

export interface UpdateChatModelPayload {
  name?: string
  modelKey?: string
  icon?: string
  description?: string
  systemPrompt?: string
  supportsImageInput?: boolean
  freeUserDailyQuestionLimit?: number | null
  maxContextRounds?: number | null
  deepResearchCreditsCost?: number | null
  isActive?: boolean
  sortOrder?: number
}

export const adminAiService = {
  getSettings: async (): Promise<AiSettings> => {
    return adminApiClient.get('/ai/settings')
  },

  updateSettings: async (data: Partial<AiSettings>): Promise<AiSettings> => {
    return adminApiClient.put('/ai/settings', data)
  },

  listChatModels: async (): Promise<ChatModelItem[]> => {
    return adminApiClient.get('/ai/chat-models')
  },

  createChatModel: async (payload: CreateChatModelPayload): Promise<ChatModelItem> => {
    return adminApiClient.post('/ai/chat-models', payload)
  },

  updateChatModel: async (id: string, payload: UpdateChatModelPayload): Promise<ChatModelItem> => {
    return adminApiClient.patch(`/ai/chat-models/${id}`, payload)
  },

  reorderChatModels: async (modelIds: string[]): Promise<{ ok: boolean }> => {
    return adminApiClient.post('/ai/chat-models/reorder', { modelIds })
  },

  removeChatModel: async (id: string): Promise<{ ok: boolean }> => {
    return adminApiClient.delete(`/ai/chat-models/${id}`)
  },
}
