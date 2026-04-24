/**
 * 管理员 - AI 模型管理类型定义（匹配后端 API）
 */

import type { Channel } from './channels'
import type { ExtraCreditsConfig } from '@/lib/types/extraCredits'
export type {
  ExtraCreditsConfig,
  ExtraCreditsLegacyConfig,
  ExtraCreditsRule,
  ExtraCreditsRuleCondition,
  ExtraCreditsRuleGroup,
  ExtraCreditsRuleGroupItem,
  ExtraCreditsRuleSet,
} from '@/lib/types/extraCredits'

// 模型类型
export type ModelType = 'image' | 'video' | 'chat'

// AI 模型
export interface Model {
  id: string
  name: string // 模型展示名称
  modelKey: string // 模型标识（唯一）
  icon: string | null
  type: ModelType
  provider: string // 提供商标识
  channelId: string
  creditsPerUse: number // 每次调用扣点（基础积分）
  specialCreditsPerUse?: number | null // 特价点数（可选）
  extraCreditsConfig: ExtraCreditsConfig | null // 额外积分配置
  defaultParams: Record<string, unknown> | null
  paramConstraints: Record<string, unknown> | null
  isActive: boolean
  sortOrder: number
  description: string | null
  supportsImageInput: boolean | null
  supportsResolutionSelect: boolean | null
  supportsSizeSelect: boolean | null
  supportsQuickMode: boolean | null
  supportsAgentMode: boolean | null
  supportsAutoMode: boolean | null
  freeUserDailyQuestionLimit: number | null
  memberDailyQuestionLimit: number | null
  maxContextRounds: number | null
  deepResearchCreditsCost: number | null
  createdAt: string
  updatedAt: string
  // 关联数据
  channel?: Channel
}

// 模型列表筛选参数
export interface ModelFilterParams {
  type?: ModelType
  provider?: string
  isActive?: boolean
}

// 创建模型 DTO
export interface CreateModelDto {
  name: string
  modelKey: string
  icon?: string | null
  type: ModelType
  provider: string
  channelId: string
  creditsPerUse: number
  specialCreditsPerUse?: number | null
  extraCreditsConfig?: ExtraCreditsConfig | null
  defaultParams?: Record<string, unknown> | null
  paramConstraints?: Record<string, unknown> | null
  isActive?: boolean
  sortOrder?: number
  description?: string | null
  supportsImageInput?: boolean | null
  supportsResolutionSelect?: boolean | null
  supportsSizeSelect?: boolean | null
  supportsQuickMode?: boolean | null
  supportsAgentMode?: boolean | null
  supportsAutoMode?: boolean | null
  freeUserDailyQuestionLimit?: number | null
  memberDailyQuestionLimit?: number | null
  maxContextRounds?: number | null
  deepResearchCreditsCost?: number | null
}

// 更新模型 DTO
export interface UpdateModelDto {
  name?: string
  modelKey?: string
  icon?: string | null
  type?: ModelType
  provider?: string
  channelId?: string
  creditsPerUse?: number
  specialCreditsPerUse?: number | null
  extraCreditsConfig?: ExtraCreditsConfig | null
  defaultParams?: Record<string, unknown> | null
  paramConstraints?: Record<string, unknown> | null
  isActive?: boolean
  sortOrder?: number
  description?: string | null
  supportsImageInput?: boolean | null
  supportsResolutionSelect?: boolean | null
  supportsSizeSelect?: boolean | null
  supportsQuickMode?: boolean | null
  supportsAgentMode?: boolean | null
  supportsAutoMode?: boolean | null
  freeUserDailyQuestionLimit?: number | null
  memberDailyQuestionLimit?: number | null
  maxContextRounds?: number | null
  deepResearchCreditsCost?: number | null
}
