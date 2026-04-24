/**
 * 任务相关类型定义
 * 基于 docs/api/00-common.md 5.1 ApiTask
 */

import type { TaskStatus, TaskType, CreditSource } from './common'

// Re-export types needed by other modules
export type { TaskStatus, TaskType, CreditSource }

// API 任务（图片/视频统一结构）
export interface ApiTask {
  type: Extract<TaskType, 'image' | 'video'>
  id: string
  userId: string
  modelId: string
  channelId: string
  projectId?: string | null
  taskNo: string
  provider: string
  modelName?: string | null
  providerTaskId: string | null
  prompt: string
  negativePrompt: string | null
  parameters: Record<string, unknown> | null
  providerData?: Record<string, unknown> | null
  status: TaskStatus
  resultUrl: string | null
  thumbnailUrl: string | null
  ossKey: string | null
  creditsCost: number | null
  creditSource: CreditSource | null
  isPublic: boolean
  publicModerationStatus: 'private' | 'pending' | 'approved' | 'rejected'
  publicRequestedAt: string | null
  publicModeratedAt: string | null
  publicModeratedBy: string | null
  publicModerationNote: string | null
  errorMessage: string | null
  retryCount: number
  startedAt: string | null
  completedAt: string | null
  deletedAt: string | null
  createdAt: string
  toolId: string | null
  toolTitle: string | null
  canCancel?: boolean
  cancelSupported?: boolean
}

// 生成图片 DTO
export interface GenerateImageDto {
  modelId: string
  prompt: string
  negativePrompt?: string
  parameters?: Record<string, unknown>
  toolId?: string
  projectId?: string
}

// 生成视频 DTO
export interface GenerateVideoDto {
  modelId: string
  prompt: string
  negativePrompt?: string
  parameters?: Record<string, unknown>
  toolId?: string
  projectId?: string
}

// Midjourney 操作 DTO
export interface MidjourneyActionDto {
  customId: string
}

// Midjourney Modal DTO
export interface MidjourneyModalDto {
  prompt?: string
  maskBase64?: string
}

// 设置公开状态 DTO
export interface SetPublicDto {
  isPublic: boolean
}
