'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AlertCircle, ArrowRight, BadgeCheck, KeyRound, LockKeyhole } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

import { AuthExperienceField } from '@/components/features/auth/AuthExperienceField'
import { authService } from '@/lib/api/services/auth'
import { cn } from '@/lib/utils/cn'

import styles from './AuthExperience.module.css'

interface ResetPasswordAuthContentProps {
  locale: string
}

export function ResetPasswordAuthContent({
  locale,
}: ResetPasswordAuthContentProps) {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token')?.trim() || ''
  const currentLocale = useLocale()
  const t = useTranslations('auth.resetPassword')
  const tErrors = useTranslations('errors.auth')
  const isZh = currentLocale.toLowerCase().startsWith('zh')

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<{
    newPassword?: string
    confirmPassword?: string
    general?: string
  }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const validateForm = () => {
    const nextErrors: typeof errors = {}

    if (!formData.newPassword) {
      nextErrors.newPassword = tErrors('passwordTooShort')
    } else if (formData.newPassword.length < 6) {
      nextErrors.newPassword = tErrors('passwordTooShort')
    }

    if (formData.newPassword !== formData.confirmPassword) {
      nextErrors.confirmPassword = tErrors('passwordNotMatch')
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setErrors({})

    try {
      await authService.resetPassword({
        token,
        newPassword: formData.newPassword,
      })
      setIsSuccess(true)
    } catch (err) {
      setErrors({
        general: err instanceof Error ? err.message : tErrors('tokenExpired'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.formBoxWide}>
      <h1 className={styles.title}>{token ? t('title') : t('invalidTokenTitle')}</h1>
      <p className={styles.subtitle}>{token ? t('subtitle') : t('invalidTokenMessage')}</p>

      {!token ? (
        <div>
          <div className={cn(styles.banner, styles.bannerError)}>
            <KeyRound className={styles.bannerIcon} />
            <div className={styles.bannerBody}>
              <p className={styles.bannerTitle}>{t('invalidTokenTitle')}</p>
              <p className={styles.bannerText}>{t('invalidTokenMessage')}</p>
            </div>
          </div>

          <Link href={`/${locale}/auth/forgot-password`} className={cn(styles.submitBtn, styles.submitBtnCyan)}>
            <span>{t('requestNewLink')}</span>
            <ArrowRight className="h-5 w-5" />
          </Link>

          <Link href={`/${locale}/auth/login`} className={styles.secondaryLink}>
            <span>{t('backToLogin')}</span>
            <span className={styles.secondaryLinkAccent}>
              {isZh ? '返回入口' : 'Back to access'}
            </span>
          </Link>
        </div>
      ) : isSuccess ? (
        <div>
          <div className={cn(styles.banner, styles.bannerSuccess)}>
            <BadgeCheck className={styles.bannerIcon} />
            <div className={styles.bannerBody}>
              <p className={styles.bannerTitle}>{t('successTitle')}</p>
              <p className={styles.bannerText}>{t('successMessage')}</p>
            </div>
          </div>

          <Link href={`/${locale}/auth/login`} className={cn(styles.submitBtn, styles.submitBtnCyan)}>
            <span>{t('backToLogin')}</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          {errors.general ? (
            <div className={cn(styles.banner, styles.bannerError)}>
              <AlertCircle className={styles.bannerIcon} />
              <div className={styles.bannerBody}>{errors.general}</div>
            </div>
          ) : null}

          <AuthExperienceField
            label={t('newPasswordLabel')}
            type="password"
            value={formData.newPassword}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, newPassword: value }))
              if (errors.newPassword || errors.general) {
                setErrors((prev) => ({ ...prev, newPassword: undefined, general: undefined }))
              }
            }}
            placeholder={t('newPasswordPlaceholder')}
            autoComplete="new-password"
            error={errors.newPassword}
            icon={LockKeyhole}
          />

          <AuthExperienceField
            label={t('confirmPasswordLabel')}
            type="password"
            value={formData.confirmPassword}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, confirmPassword: value }))
              if (errors.confirmPassword || errors.general) {
                setErrors((prev) => ({ ...prev, confirmPassword: undefined, general: undefined }))
              }
            }}
            placeholder={t('confirmPasswordPlaceholder')}
            autoComplete="new-password"
            error={errors.confirmPassword}
            icon={BadgeCheck}
          />

          <button
            type="submit"
            disabled={isLoading}
            className={cn(styles.submitBtn, styles.submitBtnCyan)}
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

          <Link href={`/${locale}/auth/login`} className={styles.secondaryLink}>
            <span>{t('backToLogin')}</span>
            <span className={styles.secondaryLinkAccent}>
              {isZh ? '返回入口' : 'Back to access'}
            </span>
          </Link>
        </form>
      )}
    </div>
  )
}
