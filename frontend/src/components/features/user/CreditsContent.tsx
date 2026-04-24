/**
 * 点数明细内容组件
 * 显示点数余额和流水记录
 */

'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui'
import { creditService } from '@/lib/api/services'
import { useAuthStore } from '@/lib/store/authStore'
import type {
  CreditBalance,
  CreditLog,
  CreditLogsQuery,
} from '@/lib/api/types/credits'
import { cn } from '@/lib/utils/cn'
import { PageTransition } from '@/components/shared/PageTransition'
import { FadeIn } from '@/components/shared/FadeIn'

export function CreditsContent() {
  const t = useTranslations('dashboard.credits')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [logs, setLogs] = useState<CreditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/${locale}/auth/login`)
    }
  }, [isAuthenticated, locale, router])

  useEffect(() => {
    if (!isAuthenticated) return

    const loadBalance = async () => {
      try {
        const balanceData = await creditService.getBalance()
        setBalance(balanceData)
      } catch (err) {
        console.error('Failed to load balance:', err)
      }
    }

    loadBalance()
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return

    const loadLogs = async () => {
      setIsLoading(true)
      try {
        const query: CreditLogsQuery = {
          page,
          pageSize: 20,
        }
        const response = await creditService.getLogs(query)
        if (page === 1) {
          setLogs(response.items)
        } else {
          setLogs((prev) => [...prev, ...response.items])
        }
        setHasMore(response.items.length === 20)
      } catch (err) {
        console.error('Failed to load logs:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadLogs()
  }, [isAuthenticated, page])

  if (!isAuthenticated) return null

  return (
    <PageTransition className="min-h-screen bg-canvas px-4 py-12 dark:bg-canvas-dark">
      <div className="mx-auto max-w-6xl">
        <FadeIn variant="slide">
          <h1 className="mb-8 font-display text-4xl font-bold text-stone-900 dark:text-stone-100">
            {t('title')}
          </h1>
        </FadeIn>

        {balance && (
          <FadeIn variant="scale" delay={0.1}>
            <Card variant="glass" className="mb-8 p-6">
              <h2 className="mb-4 font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                {t('balance')}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl bg-white/50 p-4 dark:bg-stone-700/50">
                  <p className="mb-1 font-ui text-sm text-stone-600 dark:text-stone-400">
                    {t('permanent')}
                  </p>
                  <p className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100">
                    {balance.permanentCredits}
                  </p>
                </div>
                <div className="rounded-xl bg-white/50 p-4 dark:bg-stone-700/50">
                  <p className="mb-1 font-ui text-sm text-stone-600 dark:text-stone-400">
                    会员当日积分
                  </p>
                  <p className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100">
                    {balance.membershipCredits.remaining}
                  </p>
                  <p className="mt-1 font-ui text-xs text-stone-500 dark:text-stone-400">
                    每日额度 {balance.membershipCredits.dailyLimit}
                  </p>
                </div>
                <div className="rounded-xl bg-aurora p-4 text-white">
                  <p className="mb-1 font-ui text-sm">{t('total')}</p>
                  <p className="font-display text-3xl font-bold">{balance.total}</p>
                </div>
              </div>
            </Card>
          </FadeIn>
        )}

        <FadeIn variant="fade" delay={0.2}>
          <Card variant="glass" className="p-6">
            <h2 className="mb-4 font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
              {t('history')}
            </h2>

            {logs.length === 0 && !isLoading ? (
              <div className="py-12 text-center text-stone-500 dark:text-stone-400">
                {t('noLogs')}
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const isClickable = log.type === 'consume' && log.relatedId

                  return (
                    <div
                      key={log.id}
                      onClick={() => {
                        if (isClickable) {
                          router.push(`/${locale}/gallery/image/${log.relatedId}`)
                        }
                      }}
                      className={cn(
                        'flex items-center justify-between rounded-xl bg-white/50 p-4 transition-colors dark:bg-stone-700/50',
                        isClickable
                          ? 'cursor-pointer hover:bg-white/70 hover:shadow-md dark:hover:bg-stone-600/50'
                          : 'hover:bg-white/70 dark:hover:bg-stone-600/50'
                      )}
                    >
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                              log.type === 'consume'
                                ? 'bg-red-100 text-red-800'
                                : log.type === 'redeem'
                                  ? 'bg-green-100 text-green-800'
                                  : log.type === 'refund'
                                    ? 'bg-blue-100 text-blue-800'
                                    : log.type === 'expire'
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-gray-100 text-gray-800'
                            )}
                          >
                            {t(`type.${log.type}`)}
                          </span>

                          <span className="text-xs text-stone-500 dark:text-stone-400">
                            {log.source === 'membership' ? '会员积分' : '永久积分'}
                          </span>

                          {isClickable && (
                            <span className="flex items-center gap-1 text-xs text-aurora-purple">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              查看作品
                            </span>
                          )}
                        </div>

                        {log.description && (
                          <p className="mb-1 font-ui text-sm text-stone-700 dark:text-stone-300">
                            {log.description}
                          </p>
                        )}

                        <p className="font-ui text-xs text-stone-500 dark:text-stone-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="ml-4 text-right">
                        <p
                          className={cn(
                            'mb-1 font-display text-lg font-bold',
                            log.amount > 0 ? 'text-green-600' : 'text-red-600'
                          )}
                        >
                          {log.amount > 0 ? '+' : ''}
                          {log.amount}
                        </p>
                        <p className="font-ui text-xs text-stone-500 dark:text-stone-400">
                          {t('balanceAfter')}: {log.balanceAfter ?? log.balance ?? '-'}
                        </p>
                      </div>
                    </div>
                  )
                })}

                {hasMore && !isLoading && (
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="w-full py-3 text-center font-ui text-sm text-stone-600 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                  >
                    {tCommon('loadMore')}
                  </button>
                )}

                {isLoading && (
                  <div className="py-4 text-center text-stone-500 dark:text-stone-400">
                    {tCommon('loading')}
                  </div>
                )}
              </div>
            )}
          </Card>
        </FadeIn>
      </div>
    </PageTransition>
  )
}
