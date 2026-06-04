/**
 * 重置密码页面
 * 路径: /[locale]/auth/reset-password?token=xxx
 */

'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

import { AuthImmersiveShell } from '@/components/features/auth/AuthImmersiveShell'
import { ResetPasswordAuthContent } from '@/components/features/auth/ResetPasswordAuthContent'
import { AuthShowcaseScenes } from '@/components/features/auth/AuthShowcaseScenes'
import { useSiteStore } from '@/lib/store'
import { useAuthStore } from '@/lib/store/authStore'

export default function ResetPasswordPage() {
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
      <Suspense
        fallback={
          <div className="flex min-h-40 items-center justify-center">
            <div className="h-12 w-12 rounded-full border-4 border-sky-500/25 border-t-sky-500 animate-spin" />
          </div>
        }
      >
        <ResetPasswordAuthContent locale={locale} />
      </Suspense>
    </AuthImmersiveShell>
  )
}
