export type AdminModerationLogSource = 'chat' | 'image_generate' | 'prompt_optimize'

export interface AdminChatModerationUser {
  id: string
  email: string
  username: string | null
}

export interface AdminChatModerationConversation {
  id: string
  title: string
}

export interface AdminChatModerationTask {
  id: string | null
  taskNo: string | null
}

export interface AdminChatModerationModel {
  id: string
  name: string
  modelKey: string
  provider: string
}

export interface AdminChatModerationLogItem {
  id: string
  source: AdminModerationLogSource
  scene: string
  content: string
  reason: string | null
  providerModel: string | null
  providerResponse: string | null
  createdAt: string
  user: AdminChatModerationUser
  conversation: AdminChatModerationConversation | null
  task: AdminChatModerationTask | null
  model: AdminChatModerationModel | null
}

export interface AdminChatModerationListResponse {
  page: number
  pageSize: number
  total: number
  items: AdminChatModerationLogItem[]
}

export interface AdminChatModerationQuery {
  page?: number
  limit?: number
  q?: string
  source?: 'all' | AdminModerationLogSource
}
