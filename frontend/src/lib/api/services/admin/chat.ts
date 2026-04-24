import { adminApiClient } from '@/lib/api/adminClient'
import type {
  AdminChatConversationDetailResponse,
  AdminChatDeleteConversationResult,
  AdminChatConversationListResponse,
  AdminChatConversationQuery,
} from '@/lib/api/types/admin/chat'

export const adminChatService = {
  listConversations: async (
    params?: AdminChatConversationQuery
  ): Promise<AdminChatConversationListResponse> => {
    return adminApiClient.get('/chat/conversations', { params })
  },

  getConversationMessages: async (
    conversationId: string
  ): Promise<AdminChatConversationDetailResponse> => {
    return adminApiClient.get(`/chat/conversations/${conversationId}/messages`)
  },

  deleteConversation: async (
    conversationId: string
  ): Promise<AdminChatDeleteConversationResult> => {
    return adminApiClient.delete(`/chat/conversations/${conversationId}`)
  },
}
