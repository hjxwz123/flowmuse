import { adminApiClient } from '@/lib/api/adminClient'
import type {
  AdminChatModerationListResponse,
  AdminChatModerationQuery,
} from '@/lib/api/types/admin/chat-moderation'

export const adminChatModerationService = {
  listLogs: async (params?: AdminChatModerationQuery): Promise<AdminChatModerationListResponse> => {
    return adminApiClient.get('/chat-moderation/logs', { params })
  },
}
