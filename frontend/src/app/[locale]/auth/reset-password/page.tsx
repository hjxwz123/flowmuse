/**
 * 重置密码页面
 * 路径: /[locale]/auth/reset-password?token=xxx
 */

'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { motion } from 'framer-motion'
import { BadgeCheck, KeyRound, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'

import { AuthInputField } from '@/components/features/auth/AuthInputField'
import { AuthShell } from '@/components/features/auth/AuthShell'
import { AuthOrbitPanel } from '@/components/features/auth/AuthVisualPanels'
import { authService } from '@/lib/api/services/auth'
import { useSiteStore } from '@/lib/store'
import { cn } from '@/lib/utils/cn'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token')?.trim() || ''

  const locale = useLocale()
  const t = useTranslations('auth.resetPassword')
  const tErrors = useTranslations('errors.auth')
  const siteTitle = useSiteStore((state) => state.settings?.siteTitle?.trim() || 'AI 创作平台')
  const isZh = locale.toLowerCase().startsWith('zh')

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

  const highlights = [
    {
      icon: KeyRound,
      title: isZh ? '重设安全口令' : 'Reset your access',
      description: isZh ? '通过验证链接设置一个新的密码。' : 'Use the verified link to set a fresh password.',
    },
    {
      icon: ShieldCheck,
      title: isZh ? '安全校验通过' : 'Verified recovery route',
      description: isZh ? '整个流程仍然保持在认证安全域中。' : 'The whole reset flow stays inside the secure auth boundary.',
    },
  ]

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
    <AuthShell
      locale={locale}
      siteTitle={siteTitle}
      tone="register"
      badge={isZh ? '重置密码' : 'Reset password'}
      title={token ? t('title') : t('invalidTokenTitle')}
      subtitle={token ? t('subtitle') : t('invalidTokenMessage')}
      panelLabel={isZh ? '账户恢复' : 'Account recovery'}
      panelTitle={isZh ? '设置新的密码，重新接回你的工作台' : 'Set a new password and reconnect your workspace'}
      panelDescription={isZh ? '验证通过后，新的密码会立即替换旧密码，你可以继续使用原有账户。' : 'Once verified, your new password replaces the old one immediately so you can return to the same account.'}
      highlights={highlights}
      sidePanel={<AuthOrbitPanel variant="reset" />}
    >
      {!token ? (
        <div className="space-y-5">
          <div className="rounded-[28px] border border-red-200/70 bg-red-50/80 p-5 shadow-[0_18px_45px_-28px_rgba(239,68,68,0.42)] dark:border-red-500/25 dark:bg-red-950/25">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500 text-white shadow-lg shadow-red-500/30">
              <KeyRound className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-2xl font-semibold text-stone-950 dark:text-white">
              {t('invalidTokenTitle')}
            </h3>
            <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
              {t('invalidTokenMessage')}
            </p>
          </div>

          <Link
            href={`/${locale}/auth/forgot-password`}
            className="flex items-center justify-center rounded-2xl border border-white/60 bg-white/70 px-5 py-3.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-white/90 dark:border-white/10 dark:bg-stone-900/55 dark:text-stone-200 dark:hover:bg-stone-900/75"
          >
            {t('requestNewLink')}
          </Link>
        </div>
      ) : isSuccess ? (
        <div className="space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-emerald-200/70 bg-emerald-50/75 p-5 shadow-[0_18px_45px_-28px_rgba(16,185,129,0.45)] dark:border-emerald-500/25 dark:bg-emerald-950/25"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-2xl font-semibold text-stone-950 dark:text-white">
              {t('successTitle')}
            </h3>
            <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
              {t('successMessage')}
            </p>
          </motion.div>

          <Link
            href={`/${locale}/auth/login`}
            className="flex items-center justify-center rounded-2xl bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue px-5 py-3.5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(124,58,237,0.28)] transition-all duration-300 hover:shadow-[0_20px_48px_rgba(124,58,237,0.34)]"
          >
            {t('backToLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {errors.general ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-red-200 bg-red-50/85 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300"
            >
              {errors.general}
            </motion.div>
          ) : null}

          <AuthInputField
            label={t('newPasswordLabel')}
            type="password"
            value={formData.newPassword}
            onChange={(value) => setFormData((prev) => ({ ...prev, newPassword: value }))}
            placeholder={t('newPasswordPlaceholder')}
            autoComplete="new-password"
            error={errors.newPassword}
            icon={LockKeyhole}
          />

          <AuthInputField
            label={t('confirmPasswordLabel')}
            type="password"
            value={formData.confirmPassword}
            onChange={(value) => setFormData((prev) => ({ ...prev, confirmPassword: value }))}
            placeholder={t('confirmPasswordPlaceholder')}
            autoComplete="new-password"
            error={errors.confirmPassword}
            icon={BadgeCheck}
          />

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            type="submit"
            disabled={isLoading}
            className={cn(
              'group relative w-full overflow-hidden rounded-2xl px-5 py-3.5 font-ui text-sm font-semibold text-white',
              'bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue',
              'shadow-[0_16px_40px_rgba(124,58,237,0.28)] transition-all duration-300',
              'hover:shadow-[0_20px_48px_rgba(124,58,237,0.34)]',
              'disabled:cursor-not-allowed disabled:opacity-60'
            )}
          >
            <span className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.28),transparent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin" />
                  <span>{t('submitting') || (isZh ? '重置中...' : 'Resetting...')}</span>
                </>
              ) : (
                <>
                  <span>{t('submitButton')}</span>
                  <Sparkles className="h-4 w-4" />
                </>
              )}
            </span>
          </motion.button>
        </form>
      )}
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="h-16 w-16 rounded-full border-4 border-aurora-purple/25 border-t-aurora-purple animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
