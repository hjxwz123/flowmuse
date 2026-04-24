/**
 * 用户菜单下拉组件
 * 显示登录/注册按钮或用户头像菜单
 */

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import {
  BarChart3,
  Bookmark,
  ChevronDown,
  Coins,
  Gift,
  Image as ImageIcon,
  LogOut,
  Mail,
  Package,
  Receipt,
  User,
  type LucideIcon,
} from 'lucide-react'

import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils/cn'

import styles from './UserMenu.module.css'

interface UserMenuProps {
  variant?: 'full' | 'compact'
  dropdownSide?: 'bottom' | 'right'
  unreadCount?: number
  onInboxClick?: () => void
  forceLight?: boolean
  className?: string
  showNativeTitle?: boolean
}

type MenuItemConfig = {
  key: string
  label: string
  icon: LucideIcon
  badge?: string | null
  variant?: 'default' | 'admin' | 'logout'
} & (
  | {
      href: string
      action?: never
    }
  | {
      href?: never
      action: () => void
    }
)

function isLinkMenuItem(item: MenuItemConfig): item is MenuItemConfig & { href: string } {
  return typeof (item as { href?: string }).href === 'string'
}

export const UserMenu = ({
  variant = 'full',
  dropdownSide = 'bottom',
  unreadCount = 0,
  onInboxClick,
  forceLight = false,
  className,
  showNativeTitle = true,
}: UserMenuProps) => {
  const t = useTranslations('nav.user')
  const tMenu = useTranslations('nav.menu')
  const tAdmin = useTranslations('admin.nav')
  const locale = useLocale()
  const isZh = locale.toLowerCase().startsWith('zh')
  const { user, isAuthenticated, isAdmin, logout } = useAuth()

  const [isOpen, setIsOpen] = useState(false)
  const [clickedItem, setClickedItem] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isCompact = variant === 'compact'
  const openToRight = dropdownSide === 'right'
  const isMembershipActive = Boolean(user?.membership?.isActive)
  const displayName = (user?.username || user?.email?.split('@')[0] || 'U').trim()

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(isZh ? 'zh-CN' : 'en-US', {
        maximumFractionDigits: 0,
      }),
    [isZh],
  )

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [isZh],
  )

  const copy = isZh
    ? {
        memberFallback: '超级会员',
        noMembership: '未开通会员',
        membershipInactive: '尚未开通',
        availableCredits: '当前可用积分',
        expiresSuffix: '到期',
      }
    : {
        memberFallback: 'Premium',
        noMembership: 'No Membership',
        membershipInactive: 'Inactive',
        availableCredits: 'Available credits',
        expiresSuffix: 'expires',
      }

  const formatMembershipDate = (value?: string | null) => {
    if (!value) return copy.membershipInactive

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return copy.membershipInactive

    return `${dateFormatter.format(date)} ${copy.expiresSuffix}`
  }

  const membershipLabel = isMembershipActive
    ? user?.membership?.levelName || copy.memberFallback
    : copy.noMembership
  const membershipDetail = isMembershipActive
    ? formatMembershipDate(user?.membership?.expireAt)
    : copy.membershipInactive
  const formattedCredits = numberFormatter.format(user?.permanentCredits ?? 0)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    setAvatarError(false)
  }, [user?.avatar])

  const handleMenuClick = (itemKey: string) => {
    setClickedItem(itemKey)
    setIsOpen(false)
    window.setTimeout(() => setClickedItem(null), 240)
  }

  const handleActionClick = (itemKey: string, action: () => void) => {
    setClickedItem(itemKey)
    setIsOpen(false)
    action()
    window.setTimeout(() => setClickedItem(null), 240)
  }

  if (!isAuthenticated) {
    if (variant === 'compact') {
      return (
        <Link
          href={`/${locale}/auth/login`}
          prefetch={true}
          className={cn(
            'inline-flex h-10 w-10 items-center justify-center rounded-full',
            'bg-white/80 backdrop-blur-sm border border-stone-200 text-stone-700 shadow-canvas',
            'transition-all duration-300 ease-out hover:scale-105 hover:shadow-canvas-lg hover:border-aurora-purple/30 active:scale-95',
            !forceLight && 'dark:bg-stone-800/80 dark:border-stone-700 dark:text-stone-200',
          )}
          aria-label={t('login')}
          title={showNativeTitle ? t('login') : undefined}
        >
          <User className="h-5 w-5" />
        </Link>
      )
    }

    return (
      <div className="flex items-center gap-3">
        <Link
          href={`/${locale}/auth/login`}
          prefetch={true}
          className={cn(
            'rounded-full px-5 py-2 font-ui text-sm font-medium',
            'bg-white/80 backdrop-blur-sm border border-stone-200 text-stone-700 shadow-canvas',
            'transition-all duration-300 ease-out hover:scale-105 hover:shadow-canvas-lg hover:border-aurora-purple/30 active:scale-95',
            !forceLight && 'dark:bg-stone-800/80 dark:border-stone-700 dark:text-stone-200',
          )}
        >
          {t('login')}
        </Link>
        <Link
          href={`/${locale}/auth/register`}
          prefetch={true}
          className={cn(
            'rounded-full px-5 py-2 font-ui text-sm font-medium',
            'bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue text-white shadow-aurora',
            'transition-all duration-300 ease-out hover:scale-105 hover:shadow-canvas-lg active:scale-95',
          )}
        >
          {t('register')}
        </Link>
      </div>
    )
  }

  const unreadBadge = unreadCount > 99 ? '99+' : String(unreadCount)

  const menuItems: MenuItemConfig[] = [
    onInboxClick
      ? {
          key: 'inbox',
          label: tMenu('inbox'),
          icon: Mail,
          action: onInboxClick,
          badge: unreadCount > 0 ? unreadBadge : null,
        }
      : {
          key: 'inbox',
          label: tMenu('inbox'),
          icon: Mail,
          href: `/${locale}/inbox`,
          badge: unreadCount > 0 ? unreadBadge : null,
        },
    {
      key: 'profile',
      label: t('profile'),
      icon: User,
      href: `/${locale}/dashboard/profile`,
    },
    {
      key: 'myWorks',
      label: t('myWorks'),
      icon: ImageIcon,
      href: `/${locale}/dashboard/my-gallery`,
    },
    {
      key: 'favorites',
      label: t('favorites'),
      icon: Bookmark,
      href: `/${locale}/dashboard/favorites`,
    },
    {
      key: 'credits',
      label: t('credits'),
      icon: Coins,
      href: `/${locale}/dashboard/credits`,
    },
    {
      key: 'invite',
      label: t('invite'),
      icon: Gift,
      href: `/${locale}/dashboard/invite`,
    },
    {
      key: 'orders',
      label: t('orders'),
      icon: Receipt,
      href: `/${locale}/dashboard/orders`,
    },
    {
      key: 'packages',
      label: tMenu('packages'),
      icon: Package,
      href: `/${locale}/packages`,
    },
  ]

  const getItemClassName = (item: MenuItemConfig) =>
    cn(
      styles.menuItem,
      clickedItem === item.key && styles.itemPressed,
      item.variant === 'admin' && styles.adminItem,
      item.variant === 'logout' && styles.logoutItem,
    )

  const renderMenuItem = (item: MenuItemConfig) => {
    const Icon = item.icon
    const content = (
      <>
        <Icon strokeWidth={2} />
        <span className={styles.itemLabel}>{item.label}</span>
        {item.badge ? <span className={styles.badgeDanger}>{item.badge}</span> : null}
      </>
    )

    if (isLinkMenuItem(item)) {
      return (
        <Link
          key={item.key}
          href={item.href}
          prefetch={true}
          onClick={() => handleMenuClick(item.key)}
          className={getItemClassName(item)}
        >
          {content}
        </Link>
      )
    }

    return (
      <button
        key={item.key}
        type="button"
        onClick={() => handleActionClick(item.key, item.action)}
        className={getItemClassName(item)}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={cn('relative', styles.root, forceLight && styles.forceLight, className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          isCompact
            ? 'flex h-10 w-10 items-center justify-center rounded-full'
            : 'flex items-center gap-3 rounded-full py-2 pl-2 pr-4',
          'relative border backdrop-blur-sm shadow-canvas transition-all duration-300 ease-out hover:border-aurora-purple/30 active:scale-[0.985]',
          'bg-white/80 border-stone-200 text-stone-700',
          !forceLight && 'dark:bg-stone-800/80 dark:border-stone-700 dark:text-stone-200',
          styles.triggerButton,
          isOpen && styles.triggerOpen,
        )}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={displayName}
      >
        <div className="relative h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-aurora-pink via-aurora-purple to-aurora-blue">
          {user?.avatar && user.avatar.trim() !== '' && !avatarError ? (
            <Image
              src={user.avatar}
              alt={displayName}
              fill
              className="object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
              {displayName[0]?.toUpperCase() || 'U'}
            </div>
          )}
        </div>

        {unreadCount > 0 ? (
          <span
            className={cn(
              'absolute inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-[18px] text-white shadow-sm',
              isCompact ? '-right-1 -top-1' : 'right-1 top-1',
            )}
          >
            {unreadBadge}
          </span>
        ) : null}

        {!isCompact ? (
          <>
            <span
              className={cn(
                'font-ui text-sm font-medium',
                'text-stone-700',
                !forceLight && 'dark:text-stone-200',
                styles.triggerName,
              )}
            >
              {displayName}
            </span>

            {isMembershipActive ? (
              <span
                className={cn('hidden rounded-full px-2 py-0.5 text-[11px] font-medium text-white md:inline-flex', styles.triggerPill)}
                style={{ backgroundColor: user?.membership?.color || '#a855f7' }}
                title={membershipDetail}
              >
                {membershipLabel}
              </span>
            ) : null}

            <ChevronDown
              className={cn(
                'h-4 w-4 text-stone-500 transition-transform duration-300',
                !forceLight && 'dark:text-stone-400',
                isOpen && 'rotate-180',
                styles.triggerChevron,
              )}
              strokeWidth={2}
            />
          </>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className={cn(
            styles.popover,
            openToRight ? styles.popoverRight : styles.popoverBottom,
          )}
          role="menu"
        >
          <div className={styles.assetCard}>
            <div className={styles.vipRow}>
              <div className={styles.vipBadge}>{membershipLabel}</div>
              <div className={styles.expiryDate}>{membershipDetail}</div>
            </div>

            <div className={styles.pointsRow}>
              <div className={styles.pointsLabel}>{copy.availableCredits}</div>
              <div className={styles.pointsValue}>
                <Coins strokeWidth={2} />
                {formattedCredits}
              </div>
            </div>
          </div>

          <div className={styles.menuList}>
            {menuItems.slice(0, 4).map(renderMenuItem)}

            <div className={styles.divider} />

            {menuItems.slice(4).map(renderMenuItem)}

            {isAdmin ? (
              <>
                <div className={styles.divider} />
                {renderMenuItem({
                  key: 'admin',
                  label: tAdmin('entrance'),
                  icon: BarChart3,
                  href: `/${locale}/admin`,
                  variant: 'admin',
                })}
              </>
            ) : null}

            <div className={styles.divider} />

            {renderMenuItem({
              key: 'logout',
              label: t('logout'),
              icon: LogOut,
              action: logout,
              variant: 'logout',
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
