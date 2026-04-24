export interface AdminChatConversationUser {
  id: string
  email: string
  username: string | null
}

export interface AdminChatConversationModel {
  id: string
  name: string
  provider: string
  modelKey: string
  icon: string | null
  type: 'chat'
  isActive: boolean
}

export interface AdminChatConversationItem {
  id: string
  title: string
  isPinned: boolean
  user: AdminChatConversationUser
  model: AdminChatConversationModel
  messageCount: number
  lastMessagePreview: string
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

export interface AdminChatConversationListResponse {
  page: number
  pageSize: number
  total: number
  items: AdminChatConversationItem[]
}

export interface AdminChatMessage {
  id: string
  conversationId: string
  userId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  images: string[]
  createdAt: string
}

export interface AdminChatConversationDetail {
  id: string
  title: string
  isPinned: boolean
  user: AdminChatConversationUser
  model: AdminChatConversationModel
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

export interface AdminChatConversationDetailResponse {
  conversation: AdminChatConversationDetail
  messages: AdminChatMessage[]
}

export interface AdminChatDeleteConversationResult {
  ok: boolean
  id: string
  title: string
}

export interface AdminChatConversationQuery {
  page?: number
  pageSize?: number
  q?: string
  userId?: string
  modelId?: string
}
