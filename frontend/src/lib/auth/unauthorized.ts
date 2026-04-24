import { defaultLocale, locales, type Locale } from '@/i18n/locales'
import { useAuthStore } from '@/lib/store/authStore'
import { useInboxStore } from '@/lib/store/inboxStore'

let isRedirectingForUnauthorized = false

function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale)
}

function resolveLocaleFromPath(pathname: string): Locale {
  const firstSegment = pathname.split('/').filter(Boolean)[0]
  return firstSegment && isLocale(firstSegment) ? firstSegment : defaultLocale
}

export function getLoginPath(pathname: string): string {
  return `/${resolveLocaleFromPath(pathname)}/auth/login`
}

export function clearUserSessionStores() {
  useAuthStore.getState().logout()
  useInboxStore.setState({
    unreadCount: 0,
    latestEvent: null,
  })
}

export function handleUnauthorizedRedirect(): boolean {
  if (typeof window === 'undefined') return false

  const { isAuthenticated, accessToken } = useAuthStore.getState()
  if (!isAuthenticated && !accessToken) {
    return false
  }

  const currentPath = window.location.pathname
  const loginPath = getLoginPath(currentPath)

  clearUserSessionStores()

  if (isRedirectingForUnauthorized) {
    return true
  }

  isRedirectingForUnauthorized = true

  if (currentPath === loginPath) {
    window.location.reload()
    return true
  }

  window.location.replace(loginPath)
  return true
}

export function handleUnauthorizedStatus(status?: number): boolean {
  if (status !== 401) return false
  return handleUnauthorizedRedirect()
}
