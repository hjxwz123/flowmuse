/**
 * 管理员 - 任务管理类型定义（匹配后端统一任务 API）
 */

// 任务类型
export type TaskType = 'image' | 'video' | 'research'

// 任务状态
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed'

// 提供商类型
export type TaskProvider = string

// 点数来源
export type CreditSource = 'permanent' | 'membership'

// 用户信息
export interface TaskUser {
  id: string
  email: string
  username: string | null
}

// ApiTask - 匹配后端 serializer 的任务结构
export interface ApiTask {
  type: TaskType
  id: string
  userId: string
  modelId: string
  channelId: string
  taskNo: string
  provider: string
  providerTaskId: string | null
  prompt: string
  negativePrompt: string | null
  topic?: string | null
  stage?: string
  progress?: number
  report?: string | null
  parameters?: Record<string, unknown> | null  // 仅在详情接口返回
  providerData?: unknown | null  // 仅在详情接口返回
  status: TaskStatus
  resultUrl: string | null
  thumbnailUrl: string | null
  ossKey: string | null
  creditsCost: number | null
  creditSource: CreditSource | null
  isPublic: boolean
  errorMessage: string | null
  retryCount: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  user?: TaskUser // 列表接口会包含用户信息
}

// 任务列表筛选参数 - 匹配后端 UnifiedTasksQueryDto
export interface TaskFilterParams {
  page?: number
  pageSize?: number
  type?: TaskType
  status?: TaskStatus
  provider?: string
  userId?: string
  modelId?: string
  channelId?: string
  isPublic?: 'true' | 'false'
  q?: string // prompt 模糊搜索
  from?: string // ISO 时间
  to?: string // ISO 时间
}

// 任务列表响应
export interface TaskListResponse {
  page: number
  pageSize: number
  total: number
  items: ApiTask[]
}

// 任务统计
export interface TaskStats {
  totals: {
    all: number
    image: number
    video: number
    research: number
  }
  byStatus: {
    all: {
      pending: number
      processing: number
      completed: number
      failed: number
    }
    image: {
      pending: number
      processing: number
      completed: number
      failed: number
    }
    video: {
      pending: number
      processing: number
      completed: number
      failed: number
    }
    research: {
      pending: number
      processing: number
      completed: number
      failed: number
    }
  }
}

// 任务详情响应
export interface TaskDetailResponse {
  task: ApiTask
  user: TaskUser
  model: {
    id: string
    name: string
    modelKey: string
    provider: string
  } | null
  channel: {
    id: string
    name: string
    provider: string
    baseUrl: string
  } | null
}

// 重试任务 DTO
export interface RetryTaskDto {
  type?: 'image' | 'video'
}

// 取消任务 DTO
export interface CancelTaskDto {
  type?: 'image' | 'video'
}

// 批量更新任务状态 DTO
export interface BatchUpdateTaskStatusDto {
  type?: 'image' | 'video' | 'auto'
  ids: string[]
  status: TaskStatus
  errorMessage?: string
}

// 批量删除任务 DTO
export interface BatchDeleteTaskDto {
  type?: 'image' | 'video' | 'auto'
  ids: string[]
}

// 批量操作响应
export interface BatchOperationResponse {
  ok: boolean
  updatedCount?: number
  deletedCount?: number
  notFoundIds: string[]
  ambiguousIds: string[]
}
