/**
 * 认证状态管理 (Zustand)
 * 管理用户登录状态、token 和用户信息
 */

import { create } from 'zustand'
import { persist, createJSONStorage, type PersistStorage } from 'zustand/middleware'
import type { UserProfile } from '../api/types'

const AUTH_STORAGE_KEY = 'auth-storage'

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

type PersistedAuthState = Pick<
  AuthState,
  'user' | 'accessToken' | 'refreshToken' | 'isAuthenticated'
>

const isCompleteAuthState = (state: PersistedAuthState) => {
  return Boolean(
    state.isAuthenticated &&
      state.user &&
      state.accessToken &&
      state.refreshToken
  )
}

const clearAuthBrowserStorage = () => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // ignore
  }

  try {
    window.sessionStorage.removeItem('dev_verify_email_token')
    window.sessionStorage.removeItem('pending_verification_email')
  } catch {
    // ignore
  }
}

const createAuthStorage = (): PersistStorage<PersistedAuthState> | undefined => {
  const storage = createJSONStorage<PersistedAuthState>(() => localStorage)
  if (!storage) return storage

  return {
    ...storage,
    setItem: (name, value) => {
      if (!isCompleteAuthState(value.state)) {
        return storage.removeItem(name)
      }

      return storage.setItem(name, value)
    },
  }
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
        // 手动清除浏览器存储，确保刷新页面后不会恢复旧状态
        if (typeof window !== 'undefined') {
          clearAuthBrowserStorage()
          window.setTimeout(clearAuthBrowserStorage, 0)
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
      name: AUTH_STORAGE_KEY, // localStorage 键名
      storage: createAuthStorage(),
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
