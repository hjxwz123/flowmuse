'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useAuthStore } from '@/lib/store/authStore'
import { paymentService } from '@/lib/api/services/payment'
import type { UserPaymentOrder } from '@/lib/api/types/payment'
import { PageTransition } from '@/components/shared/PageTransition'
import { FadeIn } from '@/components/shared/FadeIn'
import { Card } from '@/components/ui'

type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired'

export function OrdersContent() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('dashboard.orders')
  const { isAuthenticated, _hasHydrated } = useAuthStore()
  const [orders, setOrders] = useState<UserPaymentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const formatDateTime = (value: string) => new Date(value).toLocaleString(locale)

  const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
    pending: { label: t('status.pending'), cls: 'bg-amber-100 text-amber-700' },
    paid: { label: t('status.paid'), cls: 'bg-green-100 text-green-700' },
    failed: { label: t('status.failed'), cls: 'bg-red-100 text-red-700' },
    expired: { label: t('status.expired'), cls: 'bg-stone-100 text-stone-500' },
  }

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.push(`/${locale}/auth/login`)
  }, [_hasHydrated, isAuthenticated, router, locale])

  useEffect(() => {
    if (!isAuthenticated) return
    load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, isAuthenticated])

  const load = async (p: number) => {
    setLoading(true)
    try {
      const res = await paymentService.listOrders({ page: p, limit: 20 })
      setOrders(res.data ?? [])
      setTotalPages(res.pagination?.totalPages ?? 1)
    } catch (error) {
      console.error('Failed to load payment orders:', error)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition className="min-h-screen bg-canvas px-4 py-8 dark:bg-canvas-dark">
      <div className="mx-auto max-w-5xl">
        <FadeIn variant="slide">
          <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100 mb-6">{t('title')}</h1>
        </FadeIn>

        <FadeIn variant="fade" delay={0.1}>
          <Card variant="glass" className="overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-stone-200 border-t-aurora-purple rounded-full" />
              </div>
            ) : orders.length === 0 ? (
              <p className="text-center text-stone-400 py-12 text-sm">{t('empty')}</p>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {orders.map(order => {
                  const s = STATUS[order.status] ?? STATUS.expired
                  return (
                    <li key={order.orderNo} className="flex items-center justify-between px-5 py-4 gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-stone-900 dark:text-stone-100 text-sm truncate">{order.packageName}</p>
                          {order.credits && <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">{t('credits', { value: order.credits.toLocaleString(locale) })}</span>}
                        </div>
                        <p className="text-xs text-stone-400 font-mono">{order.orderNo}</p>
                        <p className="text-xs text-stone-400 mt-0.5">{formatDateTime(order.createdAt)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-aurora-purple text-sm mb-1">¥{(order.amount / 100).toFixed(2)}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
                        {order.paidAt && (
                          <p className="text-xs text-stone-400 mt-1">{formatDateTime(order.paidAt)}</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 px-5 py-4 border-t border-stone-100 dark:border-stone-800">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 disabled:opacity-40 transition-colors hover:bg-stone-200">
                  {t('pagination.previous')}
                </button>
                <span className="text-xs text-stone-500">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 disabled:opacity-40 transition-colors hover:bg-stone-200">
                  {t('pagination.next')}
                </button>
              </div>
            )}
          </Card>
        </FadeIn>
      </div>
    </PageTransition>
  )
}
