/**
 * 认证 Hook
 * 简化认证状态访问
 */

'use client'

import { useAuthStore } from '@/lib/store/authStore'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

export const useAuth = () => {
  const router = useRouter()
  const {
    user,
    isAuthenticated,
    _hasHydrated,
    logout: storeLogout,
  } = useAuthStore()
  const [isReady, setIsReady] = useState(false)

  // 检查是否为管理员
  const isAdmin = useMemo(() => {
    return user?.role === 'admin'
  }, [user])

  // 等待 Zustand 水合完成
  useEffect(() => {
    if (_hasHydrated) {
      setIsReady(true)
    }
  }, [_hasHydrated])

  const logout = useCallback(() => {
    storeLogout()
    router.push('/')
  }, [storeLogout, router])

  const requireAuth = useCallback(
    (redirectTo?: string) => {
      // 如果还没有水合完成，不要重定向
      if (!isReady) {
        return false
      }

      if (!isAuthenticated) {
        router.push(redirectTo || '/auth/login')
        return false
      }
      return true
    },
    [isAuthenticated, isReady, router]
  )

  return {
    user,
    isAuthenticated,
    isAdmin,
    isReady,
    logout,
    requireAuth,
  }
}
