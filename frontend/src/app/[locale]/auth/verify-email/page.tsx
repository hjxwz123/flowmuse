'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, CircleCheck, CircleX, MailCheck } from 'lucide-react'

import { AuthImmersiveShell } from '@/components/features/auth/AuthImmersiveShell'
import { AuthShowcaseScenes } from '@/components/features/auth/AuthShowcaseScenes'
import { AuthStatusContent } from '@/components/features/auth/AuthStatusContent'
import { authService } from '@/lib/api/services/auth'
import { useSiteStore } from '@/lib/store'

function VerifyEmailShell({ children }: { children: ReactNode }) {
  const locale = useLocale()
  const siteTitle = useSiteStore((state) => state.settings?.siteTitle?.trim() || 'AI Studio')

  return (
    <AuthImmersiveShell
      locale={locale}
      siteTitle={siteTitle}
      variant="wide"
      showBrand={false}
      showcase={<AuthShowcaseScenes />}
    >
      {children}
    </AuthImmersiveShell>
  )
}

function VerifyEmailFallback() {
  const t = useTranslations('auth.verifyEmail')

  return (
    <VerifyEmailShell>
      <AuthStatusContent
        icon={MailCheck}
        tone="loading"
        title={t('verifying')}
        message={t('verifyingMessage')}
      />
    </VerifyEmailShell>
  )
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token')
  const locale = useLocale()
  const t = useTranslations('auth.verifyEmail')
  const tErrors = useTranslations('errors.auth')

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('pending')
  const [error, setError] = useState('')
  const [devToken, setDevToken] = useState('')

  const verifyEmail = useCallback(
    async (verifyToken: string) => {
      setStatus('loading')
      setError('')

      try {
        await authService.verifyEmail(verifyToken)
        try {
          sessionStorage.removeItem('dev_verify_email_token')
        } catch {
          // ignore
        }
        setStatus('success')
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : tErrors('tokenExpired'))
      }
    },
    [tErrors],
  )

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('dev_verify_email_token') || ''
      if (stored) setDevToken(stored)
    } catch {
      // ignore
    }

    if (token) {
      void verifyEmail(token)
    }
  }, [token, verifyEmail])

  const loginHref = `/${locale}/auth/login`

  return (
    <VerifyEmailShell>
      {status === 'loading' ? (
        <AuthStatusContent
          icon={MailCheck}
          tone="loading"
          title={t('verifying')}
          message={t('verifyingMessage')}
        />
      ) : null}

      {status === 'success' ? (
        <AuthStatusContent
          icon={CircleCheck}
          tone="success"
          title={t('successTitle')}
          message={t('successMessage')}
          actions={[
            {
              label: t('backToLogin'),
              href: loginHref,
              icon: ArrowRight,
              variant: 'cyan',
            },
          ]}
        />
      ) : null}

      {status === 'error' ? (
        <AuthStatusContent
          icon={CircleX}
          tone="error"
          title={t('errorTitle')}
          message={error}
          actions={[
            {
              label: t('backToLogin'),
              href: loginHref,
              variant: 'secondary',
            },
          ]}
        />
      ) : null}

      {status === 'pending' ? (
        <AuthStatusContent
          icon={MailCheck}
          tone="info"
          title={t('pendingTitle')}
          message={t('pendingMessage')}
          meta={devToken ? t('devTokenHint') : undefined}
          actions={[
            ...(devToken
              ? [
                  {
                    label: t('useTokenButton'),
                    onClick: () => {
                      void verifyEmail(devToken)
                    },
                    icon: ArrowRight,
                    variant: 'cyan' as const,
                  },
                ]
              : []),
            {
              label: t('backToLogin'),
              href: loginHref,
              variant: 'secondary' as const,
            },
          ]}
        />
      ) : null}
    </VerifyEmailShell>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  )
}
