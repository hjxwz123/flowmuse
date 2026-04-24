/**
 * 收件箱消息
 * 基于 docs/api/14-inbox.md
 */

import type { ApiResearchTask } from './research'
import type { ApiTask } from './task'

export type InboxMessageType = 'task_completed' | 'task_failed' | string
export type InboxMessageLevel = 'success' | 'error' | 'info' | string
export type InboxRelatedType = 'image' | 'video' | 'research' | string

export interface InboxTaskMeta {
  taskType?: 'image' | 'video' | 'research'
  taskId?: string
  taskNo?: string
  retryCount?: number
  status?: 'completed' | 'failed'
  provider?: string | null
  modelId?: string | null
  channelId?: string | null
  resultUrl?: string | null
  thumbnailUrl?: string | null
  errorMessage?: string | null
  // moderation/system extensions
  action?: string
  prompt?: string | null
  contentFormat?: 'text' | 'html'
  senderName?: string | null
  senderId?: string | null
  actorName?: string | null
  comment?: string | null
}

export interface InboxMessage {
  id: string
  userId: string
  type: InboxMessageType
  level: InboxMessageLevel | null
  title: string
  content: string | null
  relatedType: InboxRelatedType | null
  relatedId: string | null
  dedupKey: string | null
  meta: InboxTaskMeta | Record<string, unknown> | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}

export type InboxStreamEvent =
  | {
      type: 'snapshot'
      unreadCount: number
    }
  | {
      type: 'message_created'
      unreadCount: number
      message: InboxMessage
    }
  | {
      type: 'message_read'
      unreadCount: number
      message: InboxMessage
    }
  | {
      type: 'messages_read_all'
      unreadCount: number
      readAt: string
    }
  | {
      type: 'message_deleted'
      unreadCount: number
      messageId: string
    }
  | {
      type: 'task_updated'
      task: ApiTask
    }
  | {
      type: 'research_updated'
      task: ApiResearchTask
    }
