/**
 * 移动端底部导航栏组件
 * 仅在移动端显示，主入口为创作/聊天/任务/商城/我的
 */

'use client'

import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { Compass, Sparkles, MessageSquare, ClipboardList, User } from 'lucide-react'

export function MobileTabBar() {
  const pathname = usePathname()
  const locale = useLocale()
  const tMenu = useTranslations('nav.menu')
  const tUser = useTranslations('nav.user')

  const tabs = [
    {
      label: tMenu('gallery'),
      icon: Compass,
      href: `/${locale}/gallery`,
      matcher: (path: string) =>
        path.startsWith(`/${locale}/gallery`),
    },
    {
      label: tMenu('create'),
      icon: Sparkles,
      href: `/${locale}/create`,
      matcher: (path: string) =>
        path.startsWith(`/${locale}/create`) ||
        path.startsWith(`/${locale}/canvas`) ||
        path.startsWith(`/${locale}/templates`) ||
        path.startsWith(`/${locale}/tools`),
    },
    {
      label: tMenu('chat'),
      icon: MessageSquare,
      href: `/${locale}/chat`,
      matcher: (path: string) => path.startsWith(`/${locale}/chat`),
    },
    {
      label: tMenu('tasks'),
      icon: ClipboardList,
      href: `/${locale}/tasks`,
      matcher: (path: string) => path.startsWith(`/${locale}/tasks`),
    },
    {
      label: tUser('profile'),
      icon: User,
      href: `/${locale}/profile/mobile`,
      matcher: (path: string) => path.startsWith(`/${locale}/profile/mobile`),
    },
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-stone-200 safe-area-bottom dark:bg-stone-900/95 dark:border-stone-700/50">
      <div className="flex items-center justify-around px-1 py-1.5">
        {tabs.map((tab) => {
          const isActive = tab.matcher(pathname)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-300',
                'min-w-[56px] gap-0.5',
                isActive
                  ? 'text-aurora-purple'
                  : 'text-stone-500 dark:text-stone-400 active:text-aurora-purple'
              )}
            >
              <Icon className={cn('w-5 h-5 transition-transform duration-300', isActive && 'scale-110')} />
              <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
