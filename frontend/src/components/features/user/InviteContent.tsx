'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui'
import { userService } from '@/lib/api/services'
import { useAuthStore } from '@/lib/store/authStore'
import type { InviteInfo } from '@/lib/api/types/user'
import { PageTransition } from '@/components/shared/PageTransition'
import { FadeIn } from '@/components/shared/FadeIn'
import { toast } from 'sonner'

export function InviteContent() {
  const t = useTranslations('dashboard.invite')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const { isAuthenticated, updateUser } = useAuthStore()

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/${locale}/auth/login`)
    }
  }, [isAuthenticated, locale, router])

  useEffect(() => {
    if (!isAuthenticated) return

    const loadInviteInfo = async () => {
      setIsLoading(true)
      try {
        const [data, profile] = await Promise.all([
          userService.getInviteInfo(),
          userService.getProfile().catch(() => null),
        ])
        setInviteInfo(data)
        if (profile) {
          updateUser(profile)
        }
      } catch (error) {
        console.error('Failed to load invite info:', error)
        toast.error(t('loadFailed'))
      } finally {
        setIsLoading(false)
      }
    }

    loadInviteInfo()
  }, [isAuthenticated, t, updateUser])

  const invitePath = useMemo(() => {
    if (!inviteInfo) return ''
    return `/${locale}/auth/register?invite=${encodeURIComponent(inviteInfo.inviteCode)}`
  }, [inviteInfo, locale])

  const inviteLink = useMemo(() => {
    if (!invitePath) return ''
    if (typeof window === 'undefined') return invitePath
    return `${window.location.origin}${invitePath}`
  }, [invitePath])

  const formattedRate = useMemo(() => {
    const rate = inviteInfo?.invitePaymentCreditsPerYuan ?? 0
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 4,
    }).format(rate)
  }, [inviteInfo?.invitePaymentCreditsPerYuan, locale])

  const copyText = async (value: string, target: 'code' | 'link') => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      toast.success(t(target === 'code' ? 'copyCodeSuccess' : 'copyLinkSuccess'))
    } catch (error) {
      console.error('Failed to copy invite data:', error)
      toast.error(t('copyFailed'))
    }
  }

  if (!isAuthenticated) return null

  return (
    <PageTransition className="min-h-screen bg-canvas px-4 py-12 dark:bg-canvas-dark">
      <div className="mx-auto max-w-[82rem]">
        <FadeIn variant="slide">
          <div className="mb-8">
            <h1 className="mb-3 font-display text-4xl font-bold text-stone-900 dark:text-stone-100">
              {t('title')}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-stone-600 dark:text-stone-400">
              {t('subtitle')}
            </p>
          </div>
        </FadeIn>

        {isLoading ? (
          <FadeIn variant="fade" delay={0.1}>
            <Card variant="glass" className="p-6 text-center text-stone-500 dark:text-stone-400">
              {tCommon('loading')}
            </Card>
          </FadeIn>
        ) : inviteInfo ? (
          <>
            <FadeIn variant="fade" delay={0.1}>
              <Card variant="glass" className="mb-8 p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-sm leading-7 text-stone-600 dark:text-stone-400">
                      {t('description', {
                        inviter: inviteInfo.registerInviterCredits,
                        invitee: inviteInfo.registerInviteeCredits,
                      })}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[560px]">
                    <div className="rounded-2xl bg-white/70 p-4 dark:bg-stone-700/50">
                      <p className="text-xs text-stone-500 dark:text-stone-400">{t('invitedCount')}</p>
                      <p className="mt-2 text-2xl font-semibold text-stone-900 dark:text-stone-100">
                        {inviteInfo.invitedCount}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/70 p-4 dark:bg-stone-700/50">
                      <p className="text-xs text-stone-500 dark:text-stone-400">{t('totalReward')}</p>
                      <p className="mt-2 text-2xl font-semibold text-stone-900 dark:text-stone-100">
                        {inviteInfo.totalInviterRewardCredits}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-aurora p-4 text-white">
                      <p className="text-xs text-white/80">{t('rewardRate')}</p>
                      <p className="mt-2 text-lg font-semibold">
                        {t('rewardRateValue', { rate: formattedRate })}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </FadeIn>

            <FadeIn variant="fade" delay={0.15}>
              <div className="grid gap-4 md:grid-cols-2">
                <Card variant="glass" className="p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
                    {t('code')}
                  </p>
                  <p className="mt-4 break-all font-mono text-2xl font-semibold text-stone-900 dark:text-stone-100">
                    {inviteInfo.inviteCode}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyText(inviteInfo.inviteCode, 'code')}
                    className="mt-5 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                  >
                    {t('copyCode')}
                  </button>
                </Card>

                <Card variant="glass" className="p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
                    {t('link')}
                  </p>
                  <p className="mt-4 break-all text-sm leading-7 text-stone-700 dark:text-stone-300">
                    {inviteLink}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyText(inviteLink, 'link')}
                    className="mt-5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-900 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
                  >
                    {t('copyLink')}
                  </button>
                </Card>
              </div>
            </FadeIn>

            <FadeIn variant="fade" delay={0.2}>
              <Card variant="glass" className="mt-4 p-5">
                <p className="text-sm leading-7 text-stone-600 dark:text-stone-400">
                  {t('paymentRewardHint', { rate: formattedRate })}
                </p>
              </Card>
            </FadeIn>

            <FadeIn variant="fade" delay={0.25}>
              <Card variant="glass" className="mt-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                      {t('inviteesTitle')}
                    </p>
                    <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                      {t('invitedCount')}: {inviteInfo.invitedCount}
                    </p>
                  </div>
                </div>

                {inviteInfo.invitees.length === 0 ? (
                  <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
                    {t('noInvitees')}
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {inviteInfo.invitees.map((invitee) => (
                      <div
                        key={invitee.id}
                        className="rounded-2xl border border-stone-200 bg-white/75 p-4 dark:border-stone-700 dark:bg-stone-800/70"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                              {invitee.username || invitee.email}
                            </p>
                            <p className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">
                              {invitee.email}
                            </p>
                          </div>
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] text-stone-500 dark:bg-stone-700 dark:text-stone-300">
                            ID {invitee.id}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-stone-500 dark:text-stone-400">
                          <p>
                            {t('invitedAt')}: {invitee.invitedAt ? new Date(invitee.invitedAt).toLocaleString(locale) : '-'}
                          </p>
                          <p>
                            {t('registeredAt')}: {new Date(invitee.createdAt).toLocaleString(locale)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </FadeIn>
          </>
        ) : null}
      </div>
    </PageTransition>
  )
}
