'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AlertCircle, ArrowRight, LockKeyhole, Mail, MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

import { AuthExperienceField } from '@/components/features/auth/AuthExperienceField'
import { AuthTurnstileField } from '@/components/features/auth/AuthTurnstileField'
import { Modal } from '@/components/ui/Modal'
import { ApiClientError } from '@/lib/api/error'
import { authService } from '@/lib/api/services/auth'
import { useAuthStore } from '@/lib/store/authStore'
import { useSiteStore } from '@/lib/store/siteStore'
import { trimSafeString } from '@/lib/utils/siteSettings'
import { cn } from '@/lib/utils/cn'

import styles from './AuthExperience.module.css'

type BanErrorData = {
  banReason?: string
  banExpireAt?: string | null
}

interface LoginAuthContentProps {
  locale: string
  redirectOnSuccess?: boolean
  onSuccess?: () => void
  onRequestRegister?: () => void
  showTag?: boolean
  switchCtaVariant?: 'button' | 'text'
  compact?: boolean
}

export function LoginAuthContent({
  locale,
  redirectOnSuccess = true,
  onSuccess,
  onRequestRegister,
  showTag = true,
  switchCtaVariant = 'button',
  compact = false,
}: LoginAuthContentProps) {
  const router = useRouter()
  const currentLocale = useLocale()
  const t = useTranslations('auth.login')
  const tErrors = useTranslations('errors.auth')

  const login = useAuthStore((state) => state.login)
  const siteSettings = useSiteStore((state) => state.settings)
  const isZh = currentLocale.toLowerCase().startsWith('zh')
  const turnstileEnabled = siteSettings?.turnstileEnabled === true
  const turnstileSiteKey = trimSafeString(siteSettings?.turnstileSiteKey)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState<{
    email?: string
    password?: string
    general?: string
  }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [banReason, setBanReason] = useState<string | null>(null)
  const [banExpireAt, setBanExpireAt] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0)

  const formatBanExpireAt = (value: string | null) => {
    if (!value) return null

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null

    return date.toLocaleString(isZh ? 'zh-CN' : 'en-US')
  }

  const validateForm = () => {
    const nextErrors: typeof errors = {}
    const email = formData.email.trim()

    if (!email) {
      nextErrors.email = tErrors('invalidEmail')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = tErrors('invalidEmail')
    }

    if (!formData.password) {
      nextErrors.password = tErrors('passwordTooShort')
    } else if (formData.password.length < 6) {
      nextErrors.password = tErrors('passwordTooShort')
    }

    if (turnstileEnabled && !turnstileToken) {
      nextErrors.general = tErrors('humanVerificationRequired')
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setErrors({})
    let shouldResetTurnstile = turnstileEnabled

    try {
      const response = await authService.login({
        email: formData.email.trim(),
        password: formData.password,
        turnstileToken: turnstileEnabled ? turnstileToken : undefined,
      })
      login(response)
      shouldResetTurnstile = false
      onSuccess?.()
      if (redirectOnSuccess) {
        router.push(`/${locale}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : tErrors('invalidCredentials')
      const apiError = error instanceof ApiClientError ? error : null
      const apiErrorData =
        apiError && apiError.data && typeof apiError.data === 'object'
          ? (apiError.data as BanErrorData)
          : null

      if (errorMessage.includes('verify your email') || errorMessage.includes('验证邮箱')) {
        try {
          sessionStorage.setItem('pending_verification_email', formData.email.trim())
        } catch {
          // ignore
        }
        router.push(`/${locale}/auth/verify-email`)
        return
      }

      if (errorMessage.includes('banned') || errorMessage.includes('封禁')) {
        const normalizedBanReason = trimSafeString(apiErrorData?.banReason)
        setErrors({ general: tErrors('userBanned') })
        setBanReason(normalizedBanReason || t('bannedDefaultReason'))
        setBanExpireAt(typeof apiErrorData?.banExpireAt === 'string' ? apiErrorData.banExpireAt : null)
        return
      }

      if (errorMessage.includes('domain not allowed') || errorMessage.includes('域名')) {
        setErrors({ general: tErrors('emailDomainNotAllowed') })
        return
      }

      if (errorMessage.includes('Human verification required')) {
        setErrors({ general: tErrors('humanVerificationRequired') })
        return
      }

      if (errorMessage.includes('Human verification is temporarily unavailable')) {
        setErrors({ general: tErrors('humanVerificationUnavailable') })
        return
      }

      if (errorMessage.includes('Human verification failed')) {
        setErrors({ general: tErrors('humanVerificationFailed') })
        return
      }

      setErrors({ general: errorMessage })
    } finally {
      setIsLoading(false)
      if (shouldResetTurnstile) {
        setTurnstileToken('')
        setTurnstileResetSignal((prev) => prev + 1)
      }
    }
  }

  const submitDisabled =
    isLoading ||
    (turnstileEnabled && (!turnstileSiteKey || !turnstileToken))
  const turnstileError =
    errors.general === tErrors('humanVerificationRequired') ||
    errors.general === tErrors('humanVerificationFailed') ||
    errors.general === tErrors('humanVerificationUnavailable')
      ? errors.general
      : undefined

  return (
    <>
      <div className={cn(styles.loginBox, compact && styles.compactMode)}>
        {showTag ? (
          <div className={styles.tag}>
            <MessageSquare className={styles.tagIcon} />
            <span>{isZh ? '引擎入口' : 'Engine access'}</span>
          </div>
        ) : null}

        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.subtitle}>{t('subtitle')}</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {errors.general ? (
            <div className={cn(styles.banner, styles.bannerError)}>
              <AlertCircle className={styles.bannerIcon} />
              <div className={styles.bannerBody}>{errors.general}</div>
            </div>
          ) : null}

          <AuthExperienceField
            label={t('emailLabel')}
            type="email"
            value={formData.email}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, email: value }))
              if (errors.email || errors.general) {
                setErrors((prev) => ({ ...prev, email: undefined, general: undefined }))
              }
            }}
            placeholder={t('emailPlaceholder')}
            autoComplete="email"
            autoCapitalize="off"
            error={errors.email}
            icon={Mail}
          />

          <AuthExperienceField
            label={t('passwordLabel')}
            type="password"
            value={formData.password}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, password: value }))
              if (errors.password || errors.general) {
                setErrors((prev) => ({ ...prev, password: undefined, general: undefined }))
              }
            }}
            placeholder={t('passwordPlaceholder')}
            autoComplete="current-password"
            error={errors.password}
            icon={LockKeyhole}
          />

          <div className={styles.options}>
            <Link href={`/${locale}/auth/forgot-password`} className={styles.forgotLink}>
              {t('forgotPassword')}
            </Link>
          </div>

          {turnstileEnabled ? (
            <AuthTurnstileField
              siteKey={turnstileSiteKey}
              locale={currentLocale}
              label={t('humanVerificationLabel')}
              hint={t('humanVerificationHint')}
              loadingLabel={t('humanVerificationLoading')}
              unavailableLabel={tErrors('humanVerificationUnavailable')}
              error={turnstileError}
              onTokenChange={(token) => {
                setTurnstileToken(token)
                if (errors.general && (
                  errors.general === tErrors('humanVerificationRequired') ||
                  errors.general === tErrors('humanVerificationFailed') ||
                  errors.general === tErrors('humanVerificationUnavailable')
                )) {
                  setErrors((prev) => ({ ...prev, general: undefined }))
                }
              }}
              resetSignal={turnstileResetSignal}
            />
          ) : null}

          <button
            type="submit"
            disabled={submitDisabled}
            className={cn(styles.submitBtn, styles.submitBtnPrimary)}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner} />
                <span>{t('submitting')}</span>
              </>
            ) : (
              <>
                <span>{t('submitButton')}</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>

          {switchCtaVariant === 'text' ? (
            onRequestRegister ? (
              <button
                type="button"
                onClick={onRequestRegister}
                className={cn(styles.switchLink, styles.switchLinkButton)}
              >
                <span>{t('noAccount')}</span>
                <span className={styles.switchLinkAccent}>{t('registerLink')}</span>
              </button>
            ) : (
              <Link href={`/${locale}/auth/register`} className={styles.switchLink}>
                <span>{t('noAccount')}</span>
                <span className={styles.switchLinkAccent}>{t('registerLink')}</span>
              </Link>
            )
          ) : onRequestRegister ? (
            <button
              type="button"
              onClick={onRequestRegister}
              className={cn(styles.secondaryLink, styles.secondaryButton)}
            >
              <span>{t('noAccount')}</span>
              <span className={styles.secondaryLinkAccent}>{t('registerLink')}</span>
            </button>
          ) : (
            <Link href={`/${locale}/auth/register`} className={styles.secondaryLink}>
              <span>{t('noAccount')}</span>
              <span className={styles.secondaryLinkAccent}>{t('registerLink')}</span>
            </Link>
          )}
        </form>
      </div>

      <Modal
        isOpen={banReason !== null}
        onClose={() => {
          setBanReason(null)
          setBanExpireAt(null)
        }}
        title={t('bannedModalTitle')}
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
            <p className="font-medium">{t('bannedModalDescription')}</p>
            <p className="mt-3 whitespace-pre-wrap break-words">{banReason}</p>
            {formatBanExpireAt(banExpireAt) ? (
              <p className="mt-3 font-medium">
                {isZh
                  ? `解封时间：${formatBanExpireAt(banExpireAt)}`
                  : `Ban expires at: ${formatBanExpireAt(banExpireAt)}`}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setBanReason(null)
                setBanExpireAt(null)
              }}
              className="inline-flex items-center rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
            >
              {t('bannedModalConfirm')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
