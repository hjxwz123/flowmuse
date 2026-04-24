/**
 * 移动端个人中心内容组件
 * 专为移动端适配的个人中心界面
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store/authStore'
import { creditService } from '@/lib/api/services'
import type { CreditBalance } from '@/lib/api/types/credits'
import {
  User,
  CreditCard,
  UserPlus,
  Image as ImageIcon,
  Heart,
  Settings,
  LogOut,
  ChevronRight,
  Coins,
  Receipt,
} from 'lucide-react'

export function MobileProfileContent() {
  const router = useRouter()
  const locale = useLocale()
  const { user, isAuthenticated, logout, _hasHydrated } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  const [balance, setBalance] = useState<CreditBalance | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && _hasHydrated && !isAuthenticated) {
      router.push(`/${locale}/auth/login`)
    }
  }, [mounted, _hasHydrated, isAuthenticated, router, locale])

  useEffect(() => {
    if (!mounted || !_hasHydrated || !isAuthenticated) return

    let active = true

    const loadBalance = async () => {
      try {
        const data = await creditService.getBalance()
        if (!active) return
        setBalance(data)
      } catch {
        // ignore
      }
    }

    loadBalance()

    const timer = setInterval(loadBalance, 15_000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadBalance()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [mounted, _hasHydrated, isAuthenticated])

  if (!mounted || !_hasHydrated || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aurora-purple" />
      </div>
    )
  }

  const menuItems = [
    {
      icon: User,
      label: '个人信息',
      href: `/${locale}/dashboard/profile`,
      description: '查看和编辑个人资料',
    },
    {
      icon: CreditCard,
      label: '消费记录',
      href: `/${locale}/dashboard/credits`,
      description: '查看积分使用记录',
    },
    {
      icon: UserPlus,
      label: '邀请奖励',
      href: `/${locale}/dashboard/invite`,
      description: '查看邀请码和邀请返利',
    },
    {
      icon: Receipt,
      label: '支付记录',
      href: `/${locale}/dashboard/orders`,
      description: '查看购买订单',
    },
    {
      icon: ImageIcon,
      label: '我的作品',
      href: `/${locale}/dashboard/my-gallery`,
      description: '查看我的图片和视频',
    },
    {
      icon: Heart,
      label: '我的收藏',
      href: `/${locale}/dashboard/favorites`,
      description: '查看收藏的作品',
    },
    {
      icon: Settings,
      label: '设置',
      href: `/${locale}/dashboard/profile`,
      description: '账号和隐私设置',
    },
  ]

  const handleLogout = () => {
    logout()
    router.push(`/${locale}/auth/login`)
  }

  const totalCredits = balance?.total ?? user.permanentCredits ?? 0

  return (
    <div className="min-h-screen pb-24">

      {/* 用户信息区 */}
      <div className="px-5 pt-8 pb-6 flex items-center gap-4">
        {/* 头像 */}
        <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-stone-200 dark:ring-stone-700 flex-shrink-0">
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt={user.username || 'User'}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-aurora-purple/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-aurora-purple">
                {(user.username || user.email || 'U')[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* 名称 + 邮箱 */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 truncate">
            {user.username || '未设置昵称'}
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 truncate">{user.email}</p>
        </div>
      </div>

      {/* 积分行 */}
      <div className="mx-5 mb-6 flex items-center justify-between border-t border-b border-stone-100 dark:border-stone-800 py-3">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-stone-500 dark:text-stone-400">剩余积分</span>
          <span className="text-base font-semibold text-stone-900 dark:text-stone-100">
            {totalCredits.toLocaleString()}
          </span>
        </div>
        <button
          onClick={() => router.push(`/${locale}/packages`)}
          className="text-xs font-medium text-aurora-purple border border-aurora-purple/40 px-3 py-1 rounded-full hover:bg-aurora-purple/5 transition-colors"
        >
          充值
        </button>
      </div>

      {/* 功能列表 */}
      <div className="px-5">
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.label}>
                <button
                  onClick={() => router.push(item.href)}
                  className="w-full flex items-center gap-3 py-3.5 text-left hover:opacity-70 active:opacity-50 transition-opacity"
                >
                  <Icon className="w-5 h-5 text-stone-400 dark:text-stone-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-stone-800 dark:text-stone-200">
                      {item.label}
                    </span>
                    <span className="block text-xs text-stone-400 dark:text-stone-500 truncate">
                      {item.description}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-300 dark:text-stone-600 flex-shrink-0" />
                </button>
              </li>
            )
          })}
        </ul>

        {/* 退出登录 */}
        <div className="mt-6 border-t border-stone-100 dark:border-stone-800 pt-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 py-3.5 text-left hover:opacity-70 active:opacity-50 transition-opacity"
          >
            <LogOut className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-sm font-medium text-red-500">退出登录</span>
          </button>
        </div>

        {/* 使用条款等链接 */}
        <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-center gap-5 pb-2">
          <Link href={`/${locale}/about`} className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            关于我们
          </Link>
          <span className="text-stone-200 dark:text-stone-700">·</span>
          <Link href={`/${locale}/privacy`} className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            隐私政策
          </Link>
          <span className="text-stone-200 dark:text-stone-700">·</span>
          <Link href={`/${locale}/terms`} className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            使用条款
          </Link>
        </div>
      </div>
    </div>
  )
}
