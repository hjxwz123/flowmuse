'use client'

import { useState, useEffect } from 'react'
import { FadeIn } from '@/components/shared/FadeIn'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { adminApiClient } from '@/lib/api/adminClient'

type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired'

interface PaymentOrder {
  id: string
  orderNo: string
  userId: string
  userEmail: string
  username: string | null
  packageId: string | null
  packageName: string
  packagePrice: number | null
  amount: number  // 分
  status: OrderStatus
  transactionId: string | null
  expireAt: string
  paidAt: string | null
  createdAt: string
}

interface Stats {
  total: number
  paid: number
  pending: number
  expired: number
  totalRevenueYuan: string
}

const STATUS_LABEL: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: '待支付', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  paid:    { label: '已支付', cls: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/60' },
  failed:  { label: '失败',   cls: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/60' },
  expired: { label: '已过期', cls: 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-800' },
}

export default function AdminPaymentsPage() {
  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const load = async (p = page, s = statusFilter) => {
    setLoading(true)
    try {
      const [ordersRes, statsRes] = (await Promise.all([
        adminApiClient.get('/payments/orders', { params: { page: p, limit: 20, ...(s ? { status: s } : {}) } }),
        adminApiClient.get('/payments/stats'),
      ])) as unknown as [{ data: PaymentOrder[]; pagination: { total: number; totalPages: number } }, Stats]
      setOrders(ordersRes.data)
      setTotal(ordersRes.pagination.total)
      setTotalPages(ordersRes.pagination.totalPages)
      setStats(statsRes)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1, statusFilter) }, [statusFilter])

  return (
    <AdminPageShell title="支付记录">
      {/* 统计卡片 */}
      {stats && (
        <FadeIn variant="fade" delay={0.05}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: '总订单', value: stats.total, cls: 'text-stone-900 dark:text-stone-100' },
                { label: '已支付', value: stats.paid, cls: 'text-green-600 dark:text-green-300' },
                { label: '待支付', value: stats.pending, cls: 'text-amber-600' },
                { label: '已过期', value: stats.expired, cls: 'text-stone-400 dark:text-stone-500' },
                { label: '总收入', value: `¥${stats.totalRevenueYuan}`, cls: 'text-aurora-purple' },
              ].map(item => (
                <div key={item.label} className="rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 text-center">
                  <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">{item.label}</p>
                  <p className={`text-2xl font-bold ${item.cls}`}>{item.value}</p>
                </div>
              ))}
            </div>
        </FadeIn>
      )}

      {/* 筛选 + 表格 */}
      <FadeIn variant="fade" delay={0.1}>
          <div className="rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
            {/* 筛选栏 */}
            <div className="flex items-center gap-3 p-4 border-b border-stone-100 dark:border-stone-800">
              <span className="text-sm text-stone-600 dark:text-stone-400">状态筛选：</span>
              {[['', '全部'], ['pending', '待支付'], ['paid', '已支付'], ['expired', '已过期']].map(([val, lab]) => (
                <button
                  key={val}
                  onClick={() => { setStatusFilter(val); setPage(1) }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === val
                      ? 'bg-aurora-purple text-stone-50'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  {lab}
                </button>
              ))}
              <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">共 {total} 条</span>
            </div>

            {/* 表格 */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin w-8 h-8 border-4 border-stone-200 dark:border-stone-800 border-t-aurora-purple rounded-full" />
              </div>
            ) : orders.length === 0 ? (
              <p className="text-center text-stone-400 dark:text-stone-500 py-16 text-sm">暂无支付记录</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 dark:bg-stone-900 text-left text-xs text-stone-500 dark:text-stone-400">
                      <th className="px-4 py-3 font-medium">订单号</th>
                      <th className="px-4 py-3 font-medium">用户</th>
                      <th className="px-4 py-3 font-medium">套餐</th>
                      <th className="px-4 py-3 font-medium text-right">金额</th>
                      <th className="px-4 py-3 font-medium text-center">状态</th>
                      <th className="px-4 py-3 font-medium">微信交易号</th>
                      <th className="px-4 py-3 font-medium">创建时间</th>
                      <th className="px-4 py-3 font-medium">支付时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {orders.map(order => {
                      const s = STATUS_LABEL[order.status] ?? STATUS_LABEL.expired
                      return (
                        <tr key={order.id} className="hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-stone-600 dark:text-stone-400">{order.orderNo}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-stone-900 dark:text-stone-100">{order.username || '—'}</p>
                            <p className="text-xs text-stone-400 dark:text-stone-500">{order.userEmail}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-stone-800 dark:text-stone-200">{order.packageName}</p>
                            {order.packagePrice != null && (
                              <p className="text-xs text-stone-400 dark:text-stone-500">¥{order.packagePrice.toFixed(2)}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-aurora-purple">
                            ¥{(order.amount / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>
                              {s.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-400 dark:text-stone-500 max-w-[140px] truncate">
                            {order.transactionId || '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-stone-500 dark:text-stone-400">
                            {new Date(order.createdAt).toLocaleString('zh-CN')}
                          </td>
                          <td className="px-4 py-3 text-xs text-stone-500 dark:text-stone-400">
                            {order.paidAt ? new Date(order.paidAt).toLocaleString('zh-CN') : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-stone-100 dark:border-stone-800">
                <button
                  onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p) }}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-40 transition-colors"
                >
                  上一页
                </button>
                <span className="text-xs text-stone-500 dark:text-stone-400">{page} / {totalPages}</span>
                <button
                  onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); load(p) }}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-40 transition-colors"
                >
                  下一页
                </button>
              </div>
            )}
          </div>
      </FadeIn>
    </AdminPageShell>
  )
}
