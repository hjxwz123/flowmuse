/**
 * 管理员后台导航栏
 * 按业务功能分组展示，减少页面查找成本
 */

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, LayoutGrid } from 'lucide-react'

import { Logo } from '@/components/shared/Logo'
import { UserMenu } from '@/components/layouts/UserMenu'
import { cn } from '@/lib/utils/cn'

import { buildAdminNavGroups } from './adminNavConfig'

export const AdminHeader = () => {
  const tNav = useTranslations('admin.nav')
  const tPortal = useTranslations('admin.portal')
  const locale = useLocale()
  const pathname = usePathname()
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const navGroups = useMemo(() => buildAdminNavGroups(locale), [locale])

  const isActive = (href: string) => {
    if (href.endsWith('/admin')) {
      return pathname === href
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const openGroup = (groupId: string) => {
    clearCloseTimer()
    setOpenGroupId(groupId)
  }

  const scheduleCloseGroup = (groupId: string) => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setOpenGroupId((current) => (current === groupId ? null : current))
      closeTimerRef.current = null
    }, 180)
  }

  useEffect(() => {
    setOpenGroupId(null)
  }, [pathname])

  useEffect(() => {
    return () => {
      clearCloseTimer()
    }
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-stone-200/70 bg-white/90 backdrop-blur-md',
        'shadow-[0_8px_30px_rgba(0,0,0,0.04)]'
      )}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 xl:gap-8">
          <div className="flex items-center gap-3">
            <Logo className="scale-[0.88]" />
            <span className="cursor-default rounded-full border border-aurora-purple/30 bg-aurora-purple/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-aurora-purple">
              {tNav('entrance')}
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {navGroups.map((group) => {
              const groupActive = group.items.some((item) => isActive(item.href))
              const isOpen = openGroupId === group.id

              return (
                <div
                  key={group.id}
                  className="relative"
                  onMouseEnter={() => openGroup(group.id)}
                  onMouseLeave={() => scheduleCloseGroup(group.id)}
                  onFocusCapture={() => openGroup(group.id)}
                  onBlurCapture={(event) => {
                    const nextFocused = event.relatedTarget
                    if (!(nextFocused instanceof Node) || !event.currentTarget.contains(nextFocused)) {
                      scheduleCloseGroup(group.id)
                    }
                  }}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    className={cn(
                      'flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
                      groupActive
                        ? 'bg-aurora-purple/10 text-aurora-purple'
                        : 'text-stone-600 hover:bg-stone-100/80 hover:text-stone-900'
                    )}
                    onClick={() => {
                      clearCloseTimer()
                      setOpenGroupId((current) => (current === group.id ? null : group.id))
                    }}
                  >
                    {tPortal(`groups.${group.id}.title`)}
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-200',
                        isOpen && '-rotate-180',
                        groupActive ? 'text-aurora-purple/70' : 'text-stone-400'
                      )}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  <div
                    className={cn(
                      'absolute left-0 top-full z-50 pt-1 transition-all duration-200',
                      isOpen
                        ? 'pointer-events-auto opacity-100 translate-y-1'
                        : 'pointer-events-none opacity-0'
                    )}
                  >
                    <div className="w-56 rounded-xl border border-stone-200/80 bg-white/95 p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.15)] backdrop-blur-xl">
                      {group.items.map((item) => {
                        const active = isActive(item.href)
                        return (
                          <Link
                            key={item.key}
                            href={item.href}
                            onClick={() => {
                              clearCloseTimer()
                              setOpenGroupId(null)
                            }}
                            className={cn(
                              'block rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all',
                              active
                                ? 'bg-aurora-purple/10 text-aurora-purple'
                                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                            )}
                          >
                            {tNav(item.key)}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition-colors hover:bg-stone-100 md:hidden"
            onClick={() => setMobileExpanded((prev) => !prev)}
            title={tPortal('mobileToggle')}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>

          <Link
            href={`/${locale}`}
            className={cn(
              'hidden h-9 items-center rounded-full border border-stone-200 bg-white px-4 text-[13px] font-medium text-stone-600 sm:inline-flex',
              'transition-colors hover:border-aurora-purple/40 hover:bg-aurora-purple/5 hover:text-aurora-purple'
            )}
          >
            {tNav('backToFrontend')}
          </Link>
          <UserMenu forceLight />
        </div>
      </div>

      {/* Mobile Navigation */}
      <div
        className={cn(
          'border-t border-stone-200/70 bg-stone-50/90 px-4 py-4 backdrop-blur-md md:hidden transition-all duration-300 overflow-hidden',
          mobileExpanded ? 'block' : 'hidden'
        )}
      >
        <div className="space-y-4">
          {navGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                {tPortal(`groups.${group.id}.title`)}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.items.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMobileExpanded(false)}
                    className={cn(
                      'inline-flex items-center justify-center rounded-lg border px-3 py-2 text-[13px] font-medium',
                      isActive(item.href)
                        ? 'border-aurora-purple/30 bg-aurora-purple/10 text-aurora-purple'
                        : 'border-stone-200/60 bg-white text-stone-600 shadow-sm'
                    )}
                  >
                    {tNav(item.key)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setMobileExpanded(false)}
          className="mx-auto mt-6 flex h-8 w-24 items-center justify-center rounded-full bg-stone-200/50 text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-700"
        >
          <ChevronDown className="h-4 w-4 shrink-0" />
        </button>
      </div>
    </header>
  )
}
