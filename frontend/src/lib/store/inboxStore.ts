/**
 * 收件箱状态管理 (Zustand)
 * 主要用于未读数量展示与 SSE 事件同步
 */

import { create } from 'zustand'
import type { InboxStreamEvent } from '@/lib/api/types/inbox'

interface InboxState {
  unreadCount: number
  latestEvent: InboxStreamEvent | null
  setUnreadCount: (count: number) => void
  setLatestEvent: (event: InboxStreamEvent | null) => void
}

export const useInboxStore = create<InboxState>((set) => ({
  unreadCount: 0,
  latestEvent: null,
  setUnreadCount: (count) => set({ unreadCount: count }),
  setLatestEvent: (event) => set({ latestEvent: event }),
}))
