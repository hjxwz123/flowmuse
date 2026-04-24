/**
 * 收件箱 Inbox 服务
 * 基于 docs/api/14-inbox.md
 */

import { apiClient } from '../client'
import '../interceptors'
import type { PaginatedResult, PaginationParams } from '../types/pagination'
import type { InboxMessage } from '../types/inbox'

export const inboxService = {
  /**
   * 获取收件箱消息列表
   * GET /inbox/messages
   */
  async getMessages(
    params?: { isRead?: 'true' | 'false' } & PaginationParams
  ): Promise<PaginatedResult<InboxMessage>> {
    return apiClient.get('/inbox/messages', { params })
  },

  /**
   * 获取未读数量
   * GET /inbox/unread-count
   */
  async getUnreadCount(): Promise<{ count: number }> {
    return apiClient.get('/inbox/unread-count')
  },

  /**
   * 标记单条为已读
   * PUT /inbox/messages/:id/read
   */
  async markRead(id: string): Promise<InboxMessage> {
    return apiClient.put(`/inbox/messages/${id}/read`)
  },

  /**
   * 标记全部为已读
   * PUT /inbox/messages/read-all
   */
  async markAllRead(): Promise<{ ok: boolean; updated: number }> {
    return apiClient.put('/inbox/messages/read-all')
  },

  /**
   * 删除消息
   * DELETE /inbox/messages/:id
   */
  async deleteMessage(id: string): Promise<{ ok: boolean }> {
    return apiClient.delete(`/inbox/messages/${id}`)
  },
}

