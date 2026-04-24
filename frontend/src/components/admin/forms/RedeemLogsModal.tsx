/**
 * 兑换码使用记录查看模态框
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Loading } from '@/components/ui/Loading'
import { adminRedeemCodeService } from '@/lib/api/services/admin/redeemCodes'
import type { RedeemLog } from '@/lib/api/types/admin/redeemCodes'

interface RedeemLogsModalProps {
  isOpen: boolean
  onClose: () => void
  redeemCodeId: string | null
  redeemCodeValue: string
}

export function RedeemLogsModal({
  isOpen,
  onClose,
  redeemCodeId,
  redeemCodeValue,
}: RedeemLogsModalProps) {
  const t = useTranslations('admin.redeemCodes')
  const tCommon = useTranslations('admin.common')

  const [logs, setLogs] = useState<RedeemLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && redeemCodeId) {
      loadLogs()
    }
  }, [isOpen, redeemCodeId])

  const loadLogs = async () => {
    if (!redeemCodeId) return

    setLoading(true)
    setError('')
    try {
      const data = await adminRedeemCodeService.getRedeemLogs(redeemCodeId)
      setLogs(data)
    } catch (err) {
      setError('加载使用记录失败')
      console.error('Failed to load redeem logs:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('logs.title')}>
      <div className="space-y-4">
        {/* Redeem Code Display */}
        <div className="rounded-lg bg-stone-50 border border-stone-200 p-3">
          <p className="font-ui text-xs text-stone-500 mb-1">兑换码</p>
          <p className="font-mono text-sm text-stone-900">{redeemCodeValue}</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-8">
            <Loading size="md" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="font-ui text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && logs.length === 0 && (
          <div className="text-center py-8">
            <svg
              className="w-16 h-16 mx-auto text-stone-300 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="font-ui text-stone-500">{t('logs.empty')}</p>
          </div>
        )}

        {/* Logs Table */}
        {!loading && logs.length > 0 && (
          <div className="rounded-lg border border-stone-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3 text-left font-ui text-xs font-medium text-stone-700">
                    {t('logs.user')}
                  </th>
                  <th className="px-4 py-3 text-left font-ui text-xs font-medium text-stone-700">
                    类型
                  </th>
                  <th className="px-4 py-3 text-left font-ui text-xs font-medium text-stone-700">
                    价值
                  </th>
                  <th className="px-4 py-3 text-right font-ui text-xs font-medium text-stone-700">
                    {t('logs.time')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-stone-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-ui text-sm text-stone-900">
                      User {log.userId}
                    </td>
                    <td className="px-4 py-3 font-ui text-sm text-stone-600">
                      {log.type === 'membership' ? '会员' : '点数'}
                    </td>
                    <td className="px-4 py-3 font-ui text-sm text-stone-600">
                      {log.type === 'membership'
                        ? `${log.membershipLevel?.name ?? log.membershipLevelId ?? '会员'}（${log.membershipPeriod === 'yearly' ? '年付' : '月付'} x ${log.membershipCycles ?? 1}期）`
                        : `${log.credits} 点`}
                    </td>
                    <td className="px-4 py-3 font-ui text-sm text-stone-600 text-right">
                      {new Date(log.redeemedAt).toLocaleString('zh-CN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {tCommon('actions.close')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
