/**
 * 条件布局组件
 * 根据路由决定是否显示不同页面壳层
 */

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { MobileTabBar } from './MobileTabBar'
import { SiteTopNoticeBar } from './SiteTopNoticeBar'
import { RouteLoadingBar } from '@/components/shared/RouteLoadingBar'
import { ToastProvider } from '@/components/shared/ToastProvider'
import { AnnouncementModal } from '@/components/features/announcements/AnnouncementModal'
import { StartupPopupOverlay } from './StartupPopupOverlay'
import { useInboxStream } from '@/lib/hooks/useInboxStream'
import { buildThemeCssPalette } from '@/lib/utils/themeColor'
import { useSiteStore, useAnnouncementStore } from '@/lib/store'
import { siteService, announcementsService } from '@/lib/api/services'

interface ConditionalLayoutProps {
  children: React.ReactNode
}

const STARTUP_POPUP_DISMISS_MS = 30 * 60 * 1000

function hashPopupSignature(input: string) {
  let hash = 5381

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index)
  }

  return (hash >>> 0).toString(36)
}

function buildStartupPopupDismissKey(signature: string) {
  return `site-startup-popup:dismissed-until:${hashPopupSignature(signature)}`
}

declare global {
  interface Window {
    __siteStartupPopupHandled?: boolean
  }
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()
  const isAdminRoute = pathname?.includes('/admin') ?? false
  const isChatRoute = !isAdminRoute && (pathname?.includes('/chat') ?? false)
  const isCanvasRoute = !isAdminRoute && (pathname?.includes('/canvas') ?? false)
  const pathSegments = pathname?.split('/').filter(Boolean) ?? []
  const isAuthRoute = !isAdminRoute && pathSegments[1] === 'auth'
  const isLandingRoute = !isAdminRoute && pathSegments.length === 1
  const useSideNav = !isAdminRoute && !isLandingRoute && !isAuthRoute
  const [siteReady, setSiteReady] = useState(false)
  const [showStartupPopup, setShowStartupPopup] = useState(false)
  const [showTopNotice, setShowTopNotice] = useState(true)

  const { setSettings, setLoading, settings } = useSiteStore()
  const {
    setAnnouncements,
    announcements,
    readAnnouncementIds,
    showModal,
    setShowModal,
    _hasHydrated,
  } = useAnnouncementStore()

  const unreadAnnouncementCount = useMemo(
    () => announcements.filter((announcement) => !readAnnouncementIds.includes(announcement.id)).length,
    [announcements, readAnnouncementIds]
  )
  const unreadAnnouncementKey = useMemo(
    () =>
      announcements
        .filter((announcement) => !readAnnouncementIds.includes(announcement.id))
        .map((announcement) => `${announcement.id}:${announcement.updatedAt || announcement.createdAt}`)
        .join('|'),
    [announcements, readAnnouncementIds]
  )
  const autoOpenedAnnouncementKeyRef = useRef('')
  const startupPopupSignature = useMemo(() => {
    const popupType = settings?.startupPopupType === 'html' ? 'html' : 'image'
    const imageUrl = settings?.startupPopupImageUrl?.trim() || ''
    const htmlContent = settings?.startupPopupHtml?.trim() || ''
    const targetUrl = settings?.startupPopupTargetUrl?.trim() || ''
    const widthPx = String(settings?.startupPopupWidthPx ?? '')
    const heightPx = String(settings?.startupPopupHeightPx ?? '')
    const content = popupType === 'html' ? htmlContent : imageUrl

    if (!content) return ''

    return [popupType, content, targetUrl, widthPx, heightPx].join('|')
  }, [
    settings?.startupPopupType,
    settings?.startupPopupImageUrl,
    settings?.startupPopupHtml,
    settings?.startupPopupTargetUrl,
    settings?.startupPopupWidthPx,
    settings?.startupPopupHeightPx,
  ])
  const startupPopupDismissKey = useMemo(() => {
    if (!startupPopupSignature) return ''
    return buildStartupPopupDismissKey(startupPopupSignature)
  }, [startupPopupSignature])
  const topNoticeText = settings?.homeTopMarqueeText?.trim() || ''
  const shouldShowTopNotice =
    !isAdminRoute &&
    !isAuthRoute &&
    !isLandingRoute &&
    !isChatRoute &&
    !isCanvasRoute &&
    topNoticeText.length > 0 &&
    showTopNotice

  useInboxStream(!isAdminRoute && !isAuthRoute)

  useEffect(() => {
    setShowTopNotice(true)
  }, [pathname, topNoticeText])

  // 当主题色变更时，动态注入明暗两套主题变量，避免浅色/深色模式下对比度不足。
  useEffect(() => {
    const root = document.documentElement

    if (!settings?.themeColor?.trim()) {
      root.style.removeProperty('--aurora-purple-light')
      root.style.removeProperty('--aurora-purple-hover-light')
      root.style.removeProperty('--aurora-on-primary-light')
      root.style.removeProperty('--aurora-shadow-light')
      root.style.removeProperty('--aurora-purple-dark')
      root.style.removeProperty('--aurora-purple-hover-dark')
      root.style.removeProperty('--aurora-on-primary-dark')
      root.style.removeProperty('--aurora-shadow-dark')
      return
    }

    const palette = buildThemeCssPalette(settings.themeColor)
    root.style.setProperty('--aurora-purple-light', palette.light.solid)
    root.style.setProperty('--aurora-purple-hover-light', palette.light.hover)
    root.style.setProperty('--aurora-on-primary-light', palette.light.onSolid)
    root.style.setProperty('--aurora-shadow-light', palette.light.shadow)
    root.style.setProperty('--aurora-purple-dark', palette.dark.solid)
    root.style.setProperty('--aurora-purple-hover-dark', palette.dark.hover)
    root.style.setProperty('--aurora-on-primary-dark', palette.dark.onSolid)
    root.style.setProperty('--aurora-shadow-dark', palette.dark.shadow)
  }, [settings?.themeColor])

  // 初始化站点配置和公告
  useEffect(() => {
    const initSiteData = async () => {
      try {
        // 加载站点配置
        setLoading(true)
        const settings = await siteService.getSettings()
        setSettings(settings)
      } catch (error) {
        console.error('Failed to load site settings:', error)
      } finally {
        setLoading(false)
        setSiteReady(true)
      }

      try {
        // 加载当前生效的公告
        const announcements = await announcementsService.getCurrent()
        setAnnouncements(announcements)
      } catch (error) {
        console.error('Failed to load announcements:', error)
      }
    }

    initSiteData()
  }, [setSettings, setLoading, setAnnouncements])

  // 自动弹出未读公告（首页不自动弹出）
  useEffect(() => {
    // 确保 store 已经 hydrated，避免服务端渲染问题
    if (!_hasHydrated || isAdminRoute || isAuthRoute || isLandingRoute || showModal) return
    if (!unreadAnnouncementKey) return
    if (autoOpenedAnnouncementKeyRef.current === unreadAnnouncementKey) return

    // 检查是否有未读公告
    if (unreadAnnouncementCount > 0) {
      // 延迟 500ms 弹出，避免太突兀
      const timer = setTimeout(() => {
        autoOpenedAnnouncementKeyRef.current = unreadAnnouncementKey
        setShowModal(true)
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [_hasHydrated, isAdminRoute, isAuthRoute, isLandingRoute, showModal, unreadAnnouncementCount, unreadAnnouncementKey, setShowModal])

  useEffect(() => {
    if (isAdminRoute || isAuthRoute) return
    if (!siteReady || typeof window === 'undefined') return
    if (window.__siteStartupPopupHandled) return
    const popupType = settings?.startupPopupType === 'html' ? 'html' : 'image'
    const imageUrl = settings?.startupPopupImageUrl?.trim() || ''
    const htmlContent = settings?.startupPopupHtml?.trim() || ''
    const hasPopupContent = popupType === 'html' ? Boolean(htmlContent) : Boolean(imageUrl)
    window.__siteStartupPopupHandled = true

    if (!hasPopupContent) return

    if (startupPopupDismissKey) {
      try {
        const dismissedUntil = Number(window.localStorage.getItem(startupPopupDismissKey) || '0')
        if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) {
          return
        }
      } catch (error) {
        console.warn('Failed to read startup popup dismissal state:', error)
      }
    }

    const timer = window.setTimeout(() => {
      setShowStartupPopup(true)
    }, 280)

    return () => window.clearTimeout(timer)
  }, [
    isAdminRoute,
    isAuthRoute,
    siteReady,
    settings?.startupPopupType,
    settings?.startupPopupImageUrl,
    settings?.startupPopupHtml,
    startupPopupDismissKey,
  ])

  const handleCloseStartupPopup = () => {
    setShowStartupPopup(false)

    if (typeof window === 'undefined' || !startupPopupDismissKey) return

    try {
      window.localStorage.setItem(
        startupPopupDismissKey,
        String(Date.now() + STARTUP_POPUP_DISMISS_MS)
      )
    } catch (error) {
      console.warn('Failed to persist startup popup dismissal state:', error)
    }
  }

  return (
    <div className={isChatRoute ? 'flex min-w-0 h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-canvas dark:bg-canvas-dark' : 'flex min-w-0 min-h-screen flex-col overflow-x-clip bg-canvas dark:bg-canvas-dark'}>
      {/* 全局路由加载进度条 */}
      <RouteLoadingBar />
      <ToastProvider />

      <div className={useSideNav ? 'flex min-w-0 flex-1 min-h-0 overflow-x-clip bg-canvas dark:bg-canvas-dark' : 'flex min-w-0 flex-1 min-h-0 flex-col overflow-x-clip bg-canvas dark:bg-canvas-dark'}>
        {!isAdminRoute && useSideNav && <Sidebar forceCollapsed={isChatRoute} />}
        {useSideNav ? (
          <div className={isChatRoute ? 'flex min-w-0 min-h-0 w-full flex-1 flex-col overflow-hidden' : 'flex min-w-0 min-h-0 w-full flex-1 flex-col overflow-x-clip'}>
            {shouldShowTopNotice ? (
              <SiteTopNoticeBar
                text={topNoticeText}
                onClose={() => setShowTopNotice(false)}
              />
            ) : null}
            <main className={isChatRoute ? 'flex min-w-0 min-h-0 w-full flex-1 overflow-hidden' : 'min-w-0 w-full flex-1 min-h-0 overflow-x-clip pb-16 md:pb-0'}>
              {children}
            </main>
          </div>
        ) : (
          <>
            {shouldShowTopNotice ? (
              <SiteTopNoticeBar
                text={topNoticeText}
                onClose={() => setShowTopNotice(false)}
              />
            ) : null}
          <main
            className={
              isChatRoute
                ? 'flex min-w-0 min-h-0 w-full flex-1 overflow-hidden'
                : isAuthRoute
                  ? 'min-w-0 w-full flex-1 min-h-0 overflow-x-clip'
                  : 'min-w-0 w-full flex-1 min-h-0 overflow-x-clip pb-16 md:pb-0'
            }
          >
            {children}
          </main>
          </>
        )}
      </div>
      {/* 移动端底部导航栏（仅主站页面） */}
      {!isAdminRoute && !isAuthRoute && !isChatRoute && !isLandingRoute && <MobileTabBar />}

      {/* 全局公告弹窗（自动弹出未读公告） */}
      {!isAuthRoute && !isLandingRoute && <AnnouncementModal isOpen={showModal} onClose={() => setShowModal(false)} />}
      {!isAdminRoute && !isAuthRoute && (
        <StartupPopupOverlay
          isOpen={showStartupPopup}
          type={settings?.startupPopupType === 'html' ? 'html' : 'image'}
          imageUrl={settings?.startupPopupImageUrl || ''}
          htmlContent={settings?.startupPopupHtml || ''}
          targetUrl={settings?.startupPopupTargetUrl || ''}
          widthPx={settings?.startupPopupWidthPx || 720}
          heightPx={settings?.startupPopupHeightPx || 0}
          onClose={handleCloseStartupPopup}
        />
      )}
    </div>
  )
}
