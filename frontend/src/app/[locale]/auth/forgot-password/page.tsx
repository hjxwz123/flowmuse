/**
 * 忘记密码页面
 * 路径: /[locale]/auth/forgot-password
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

import { AuthImmersiveShell } from '@/components/features/auth/AuthImmersiveShell'
import { ForgotPasswordAuthContent } from '@/components/features/auth/ForgotPasswordAuthContent'
import { AuthShowcaseScenes } from '@/components/features/auth/AuthShowcaseScenes'
import { useSiteStore } from '@/lib/store'
import { useAuthStore } from '@/lib/store/authStore'

export default function ForgotPasswordPage() {
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
      variant="wide"
      showBrand={false}
      showcase={<AuthShowcaseScenes />}
    >
      <ForgotPasswordAuthContent locale={locale} />
    </AuthImmersiveShell>
  )
}
