/**
 * 管理员权限检查 Hook
 * 用于保护管理员后台页面
 */

'use client'

import { useAuth } from './useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export const useAdminAuth = () => {
  const { user, isAuthenticated, isAdmin, isReady, logout } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    // 等待 Zustand 水合完成
    if (!isReady) return

    // 检查是否已登录
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/admin')
      return
    }

    // 检查是否为管理员
    if (!isAdmin) {
      router.push('/')
      return
    }

    // 通过所有检查
    setIsAuthorized(true)
  }, [isReady, isAuthenticated, isAdmin, router])

  return {
    isAuthorized,
    user,
    logout,
  }
}
