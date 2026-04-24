'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertCircle, ArrowRight, BadgeCheck, LockKeyhole, Mail, Ticket, User } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

import { AuthExperienceField } from '@/components/features/auth/AuthExperienceField'
import { AuthTurnstileField } from '@/components/features/auth/AuthTurnstileField'
import { authService } from '@/lib/api/services/auth'
import { useSiteStore } from '@/lib/store/siteStore'
import { trimSafeString } from '@/lib/utils/siteSettings'
import { cn } from '@/lib/utils/cn'

import styles from './AuthExperience.module.css'

interface RegisterAuthContentProps {
  locale: string
  inviteOnlyRegistration: boolean
  onRequestLogin?: () => void
  switchCtaVariant?: 'button' | 'text'
  compact?: boolean
}

export function RegisterAuthContent({
  locale,
  inviteOnlyRegistration,
  onRequestLogin,
  switchCtaVariant = 'button',
  compact = false,
}: RegisterAuthContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentLocale = useLocale()
  const t = useTranslations('auth.register')
  const tErrors = useTranslations('errors.auth')
  const isZh = currentLocale.toLowerCase().startsWith('zh')
  const siteSettings = useSiteStore((state) => state.settings)
  const turnstileEnabled = siteSettings?.turnstileEnabled === true
  const turnstileSiteKey = trimSafeString(siteSettings?.turnstileSiteKey)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    inviteCode: '',
  })
  const [errors, setErrors] = useState<{
    email?: string
    password?: string
    confirmPassword?: string
    username?: string
    inviteCode?: string
    general?: string
  }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0)

  useEffect(() => {
    const inviteCode = searchParams.get('invite')?.trim().toUpperCase() ?? ''
    if (!inviteCode) return

    setFormData((prev) =>
      prev.inviteCode === inviteCode ? prev : { ...prev, inviteCode }
    )
  }, [searchParams])

  const validateForm = () => {
    const nextErrors: typeof errors = {}
    const email = formData.email.trim()
    const inviteCode = formData.inviteCode.trim()

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

    if (inviteOnlyRegistration && !inviteCode) {
      nextErrors.inviteCode = tErrors('inviteCodeRequired')
    }

    if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = tErrors('passwordNotMatch')
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
      const response = await authService.register({
        email: formData.email.trim(),
        password: formData.password,
        username: formData.username.trim() || undefined,
        inviteCode: formData.inviteCode.trim() || undefined,
        turnstileToken: turnstileEnabled ? turnstileToken : undefined,
      })

      if (response.verifyEmailToken) {
        try {
          sessionStorage.setItem('dev_verify_email_token', response.verifyEmailToken)
        } catch {
          // ignore
        }
      }

      try {
        sessionStorage.setItem('pending_verification_email', formData.email.trim())
      } catch {
        // ignore
      }

      shouldResetTurnstile = false
      router.push(`/${locale}/auth/verify-email`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : tErrors('emailExists')

      if (errorMessage.includes('domain not allowed') || errorMessage.includes('域名')) {
        setErrors({ general: tErrors('emailDomainNotAllowed') })
        return
      }

      if (errorMessage.includes('already registered') || errorMessage.includes('已被注册')) {
        setErrors({ general: tErrors('emailExists') })
        return
      }

      if (errorMessage.includes('invite-only') || errorMessage.includes('仅允许通过邀请码注册')) {
        setErrors({
          general: tErrors('inviteCodeRequired'),
          inviteCode: tErrors('inviteCodeRequired'),
        })
        return
      }

      if (errorMessage.includes('invite code') || errorMessage.includes('邀请码')) {
        setErrors({
          general: tErrors('invalidInviteCode'),
          inviteCode: tErrors('invalidInviteCode'),
        })
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
    <div className={cn(styles.formBoxWide, compact && styles.compactMode)}>
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

        <div className={cn(styles.formRow, styles.formRowCompact)}>
          <AuthExperienceField
            label={t('usernameLabel')}
            optionalLabel={isZh ? '(可选)' : '(Optional)'}
            type="text"
            value={formData.username}
            onChange={(value) => setFormData((prev) => ({ ...prev, username: value }))}
            placeholder={t('usernamePlaceholder')}
            autoComplete="username"
            error={errors.username}
            icon={User}
          />

          <AuthExperienceField
            label={t('inviteCodeLabel')}
            required={inviteOnlyRegistration}
            warning={inviteOnlyRegistration}
            type="text"
            value={formData.inviteCode}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, inviteCode: value.toUpperCase() }))
              if (errors.inviteCode || errors.general) {
                setErrors((prev) => ({ ...prev, inviteCode: undefined, general: undefined }))
              }
            }}
            placeholder={
              inviteOnlyRegistration
                ? t('inviteCodePlaceholderRequired')
                : t('inviteCodePlaceholder')
            }
            autoComplete="off"
            error={errors.inviteCode}
            helperText={inviteOnlyRegistration ? t('inviteCodeHintInviteOnly') : t('inviteCodeHint')}
            icon={Ticket}
          />
        </div>

        <div className={styles.formRow}>
          <AuthExperienceField
            label={t('passwordLabel')}
            type="password"
            value={formData.password}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, password: value }))
              if (errors.password) {
                setErrors((prev) => ({ ...prev, password: undefined }))
              }
            }}
            placeholder={t('passwordPlaceholder')}
            autoComplete="new-password"
            error={errors.password}
            icon={LockKeyhole}
          />

          <AuthExperienceField
            label={t('confirmPasswordLabel')}
            type="password"
            value={formData.confirmPassword}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, confirmPassword: value }))
              if (errors.confirmPassword) {
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
              }
            }}
            placeholder={t('confirmPasswordPlaceholder')}
            autoComplete="new-password"
            error={errors.confirmPassword}
            icon={BadgeCheck}
          />
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
          className={cn(styles.submitBtn, styles.submitBtnSecondary)}
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
          onRequestLogin ? (
            <button
              type="button"
              onClick={onRequestLogin}
              className={cn(styles.switchLink, styles.switchLinkButton)}
            >
              <span>{t('hasAccount')}</span>
              <span className={styles.switchLinkAccent}>{t('loginLink')}</span>
            </button>
          ) : (
            <Link href={`/${locale}/auth/login`} className={styles.switchLink}>
              <span>{t('hasAccount')}</span>
              <span className={styles.switchLinkAccent}>{t('loginLink')}</span>
            </Link>
          )
        ) : onRequestLogin ? (
          <button
            type="button"
            onClick={onRequestLogin}
            className={cn(styles.secondaryLink, styles.secondaryButton)}
          >
            <span>{t('hasAccount')}</span>
            <span className={styles.secondaryLinkAccent}>{t('loginLink')}</span>
          </button>
        ) : (
          <Link href={`/${locale}/auth/login`} className={styles.secondaryLink}>
            <span>{t('hasAccount')}</span>
            <span className={styles.secondaryLinkAccent}>{t('loginLink')}</span>
          </Link>
        )}
      </form>
    </div>
  )
}
