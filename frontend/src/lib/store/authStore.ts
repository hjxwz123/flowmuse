/**
 * 认证状态管理 (Zustand)
 * 管理用户登录状态、token 和用户信息
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UserProfile } from '../api/types'

interface AuthState {
  // 状态
  user: UserProfile | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  _hasHydrated: boolean

  // 操作
  login: (data: {
    user: UserProfile
    accessToken: string
    refreshToken: string
  }) => void
  logout: () => void
  updateUser: (user: Partial<UserProfile>) => void
  updateToken: (accessToken: string) => void
  setHasHydrated: (state: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // 初始状态
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      _hasHydrated: false,

      // 登录
      login: ({ user, accessToken, refreshToken }) => {
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        })
      },

      // 退出登录
      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
        // 手动清除 localStorage，确保刷新页面后不会恢复旧状态
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-storage')
          // 同时清除可能的开发环境 token
          try {
            sessionStorage.removeItem('dev_verify_email_token')
            sessionStorage.removeItem('pending_verification_email')
          } catch {
            // ignore
          }
        }
      },

      // 更新用户信息
      updateUser: (userData) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        }))
      },

      // 更新 accessToken（刷新后）
      updateToken: (accessToken) => {
        set({ accessToken })
      },

      // 设置水合状态
      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },
    }),
    {
      name: 'auth-storage', // localStorage 键名
      storage: createJSONStorage(() => localStorage),
      // 只持久化这些字段
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
