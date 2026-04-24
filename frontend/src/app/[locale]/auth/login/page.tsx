/**
 * 登录页面
 * 路径: /[locale]/auth/login
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

import { AuthImmersiveShell } from '@/components/features/auth/AuthImmersiveShell'
import { LoginAuthContent } from '@/components/features/auth/LoginAuthContent'
import { AuthShowcaseGallery } from '@/components/features/auth/AuthShowcaseGallery'
import { useSiteStore } from '@/lib/store'
import { useAuthStore } from '@/lib/store/authStore'

export default function LoginPage() {
  const router = useRouter()
  const locale = useLocale()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasHydrated = useAuthStore((state) => state._hasHydrated)
  const siteTitle = useSiteStore((state) => state.settings?.siteTitle?.trim() || 'AI Studio')

  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      router.replace(`/${locale}`)
    }
  }, [hasHydrated, isAuthenticated, locale, router])

  if (hasHydrated && isAuthenticated) {
    return null
  }

  return (
    <AuthImmersiveShell
      locale={locale}
      siteTitle={siteTitle}
      variant="login"
      showBrand={false}
      showcase={<AuthShowcaseGallery />}
    >
      <LoginAuthContent locale={locale} />
    </AuthImmersiveShell>
  )
}
