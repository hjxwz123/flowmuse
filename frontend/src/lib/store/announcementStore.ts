/**
 * 公告状态管理 (Zustand)
 * 管理公告的显示和已读状态
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Announcement } from '../api/types/announcements'

interface AnnouncementState {
  // 状态
  announcements: Announcement[] // 当前生效的公告列表
  readAnnouncementIds: string[] // 已读公告 ID 列表
  showModal: boolean // 是否显示公告弹窗
  _hasHydrated: boolean

  // 操作
  setAnnouncements: (announcements: Announcement[]) => void
  markAsRead: (announcementId: string) => void
  markAllAsRead: () => void
  setShowModal: (show: boolean) => void
  hasUnreadAnnouncements: () => boolean
  getUnreadAnnouncements: () => Announcement[]
  setHasHydrated: (state: boolean) => void
}

export const useAnnouncementStore = create<AnnouncementState>()(
  persist(
    (set, get) => ({
      // 初始状态
      announcements: [],
      readAnnouncementIds: [],
      showModal: false,
      _hasHydrated: false,

      // 设置公告列表
      setAnnouncements: (announcements) => {
        set({ announcements })
      },

      // 标记单个公告为已读
      markAsRead: (announcementId) => {
        set((state) => ({
          readAnnouncementIds: state.readAnnouncementIds.includes(announcementId)
            ? state.readAnnouncementIds
            : [...state.readAnnouncementIds, announcementId],
        }))
      },

      // 标记所有当前公告为已读
      markAllAsRead: () => {
        const allIds = get().announcements.map((a) => a.id)
        set({ readAnnouncementIds: allIds })
      },

      // 设置弹窗显示状态
      setShowModal: (show) => {
        set({ showModal: show })
      },

      // 检查是否有未读公告
      hasUnreadAnnouncements: () => {
        const { announcements, readAnnouncementIds } = get()
        return announcements.some((a) => !readAnnouncementIds.includes(a.id))
      },

      // 获取未读公告列表
      getUnreadAnnouncements: () => {
        const { announcements, readAnnouncementIds } = get()
        return announcements.filter((a) => !readAnnouncementIds.includes(a.id))
      },

      // 设置水合状态
      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },
    }),
    {
      name: 'announcement-storage', // localStorage 键名
      storage: createJSONStorage(() => localStorage),
      // 只持久化已读 ID
      partialize: (state) => ({
        readAnnouncementIds: state.readAnnouncementIds,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
