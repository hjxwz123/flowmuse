'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AlertCircle, ArrowRight, Mail, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

import { AuthExperienceField } from '@/components/features/auth/AuthExperienceField'
import { authService } from '@/lib/api/services/auth'
import { cn } from '@/lib/utils/cn'

import styles from './AuthExperience.module.css'

interface ForgotPasswordAuthContentProps {
  locale: string
}

export function ForgotPasswordAuthContent({
  locale,
}: ForgotPasswordAuthContentProps) {
  const router = useRouter()
  const currentLocale = useLocale()
  const t = useTranslations('auth.forgotPassword')
  const tErrors = useTranslations('errors.auth')
  const tNetwork = useTranslations('errors.network')
  const isZh = currentLocale.toLowerCase().startsWith('zh')

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [resetToken, setResetToken] = useState<string | null>(null)

  const validateEmail = () => {
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      setError(tErrors('invalidEmail'))
      return false
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError(tErrors('invalidEmail'))
      return false
    }

    return true
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateEmail()) return

    setIsLoading(true)
    setError('')

    try {
      const response = await authService.forgotPassword(email.trim())
      setIsSuccess(true)
      if (response.resetToken) {
        setResetToken(response.resetToken)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tNetwork('unknownError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.formBoxWide}>
      <h1 className={styles.title}>{t('title')}</h1>
      <p className={styles.subtitle}>{t('subtitle')}</p>

      {isSuccess ? (
        <div>
          <div className={cn(styles.banner, styles.bannerSuccess)}>
            <Send className={styles.bannerIcon} />
            <div className={styles.bannerBody}>
              <p className={styles.bannerTitle}>{t('successTitle')}</p>
              <p className={styles.bannerText}>{t('successMessage')}</p>
            </div>
          </div>

          <div className={styles.successActions}>
            {resetToken ? (
              <button
                type="button"
                onClick={() => router.push(`/${locale}/auth/reset-password?token=${resetToken}`)}
                className={cn(styles.submitBtn, styles.submitBtnCyan)}
              >
                <span>{t('useTokenButton')}</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            ) : null}

            <Link href={`/${locale}/auth/login`} className={styles.secondaryLink}>
              <span>{t('backToLogin')}</span>
              <span className={styles.secondaryLinkAccent}>
                {isZh ? '返回入口' : 'Back to access'}
              </span>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          {error ? (
            <div className={cn(styles.banner, styles.bannerError)}>
              <AlertCircle className={styles.bannerIcon} />
              <div className={styles.bannerBody}>{error}</div>
            </div>
          ) : null}

          <AuthExperienceField
            label={t('emailLabel')}
            type="email"
            value={email}
            onChange={(value) => {
              setEmail(value)
              if (error) setError('')
            }}
            placeholder={t('emailPlaceholder')}
            autoComplete="email"
            autoCapitalize="off"
            icon={Mail}
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
