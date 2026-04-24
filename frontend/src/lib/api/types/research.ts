import type { CreditSource, TaskStatus } from './common'

export interface ApiResearchTask {
  type: 'research'
  id: string
  userId: string
  modelId: string
  modelName: string | null
  channelId: string
  taskNo: string
  topic: string
  reportTitle: string | null
  status: TaskStatus
  stage: string
  progress: number
  plan: Record<string, unknown> | null
  queries: unknown
  findings: unknown
  report: string | null
  providerData: Record<string, unknown> | null
  creditsCost: number | null
  creditSource: CreditSource | null
  errorMessage: string | null
  retryCount: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateResearchTaskDto {
  modelId: string
  topic?: string
  fileIds?: string[]
}
