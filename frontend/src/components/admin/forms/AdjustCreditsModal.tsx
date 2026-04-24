/**
 * 调整用户点数模态框
 */

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { adminUserService } from '@/lib/api/services/admin/users'
import type { AdjustCreditsDto } from '@/lib/api/types/admin/users'

interface AdjustCreditsModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  currentCredits: number
  onSuccess?: () => void
}

export function AdjustCreditsModal({
  isOpen,
  onClose,
  userId,
  currentCredits,
  onSuccess,
}: AdjustCreditsModalProps) {
  const t = useTranslations('admin.users.adjustCreditsModal')
  const tCommon = useTranslations('admin.common')

  const [type, setType] = useState<'add' | 'deduct'>('add')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    const amountNum = parseInt(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError('请输入有效的点数')
      return
    }

    if (!reason.trim()) {
      setError('请输入调整原因')
      return
    }

    // Check if deducting more than available
    if (type === 'deduct' && amountNum > currentCredits) {
      setError(`扣除点数不能超过当前剩余点数 (${currentCredits})`)
      return
    }

    setLoading(true)
    try {
      const dto: AdjustCreditsDto = {
        amount: amountNum,
        type,
        reason: reason.trim(),
      }

      await adminUserService.adjustCredits(userId, dto)

      // Success
      onSuccess?.()
      handleClose()
    } catch (err) {
      setError('操作失败，请重试')
      console.error('Failed to adjust credits:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setAmount('')
    setReason('')
    setError('')
    setType('add')
    onClose()
  }

  const previewNewBalance =
    type === 'add'
      ? currentCredits + (parseInt(amount) || 0)
      : currentCredits - (parseInt(amount) || 0)

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('title')}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Current Credits */}
        <div className="rounded-lg bg-stone-50 p-4">
          <p className="font-ui text-sm text-stone-600 mb-1">当前剩余点数</p>
          <p className="font-display text-2xl font-bold text-stone-900">
            {(currentCredits || 0).toLocaleString()}
          </p>
        </div>

        {/* Type Selection */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-3">
            {t('type')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('add')}
              className={cn(
                'rounded-lg border-2 px-4 py-3 font-ui text-sm font-medium transition-all',
                type === 'add'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-green-200'
              )}
            >
              ✓ {t('add')}
            </button>
            <button
              type="button"
              onClick={() => setType('deduct')}
              className={cn(
                'rounded-lg border-2 px-4 py-3 font-ui text-sm font-medium transition-all',
                type === 'deduct'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-red-200'
              )}
            >
              − {t('deduct')}
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('amount')}
          </label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="请输入点数"
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-3',
              'font-ui text-base text-stone-900',
              'placeholder:text-stone-400',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors'
            )}
            required
          />
        </div>

        {/* Reason Input */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('reason')}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="请说明调整原因"
            rows={3}
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-3',
              'font-ui text-base text-stone-900',
              'placeholder:text-stone-400',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors resize-none'
            )}
            required
          />
        </div>

        {/* Preview */}
        {amount && !isNaN(parseInt(amount)) && (
          <div className="rounded-lg bg-aurora-purple/5 border border-aurora-purple/20 p-4">
            <p className="font-ui text-sm text-stone-600 mb-1">预览调整后余额</p>
            <div className="flex items-center gap-3">
              <span className="font-display text-xl text-stone-900">
                {currentCredits.toLocaleString()}
              </span>
              <svg
                className="h-5 w-5 text-stone-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
              <span
                className={cn(
                  'font-display text-2xl font-bold',
                  type === 'add' ? 'text-green-600' : 'text-red-600'
                )}
              >
                {previewNewBalance.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="font-ui text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
            className="flex-1"
          >
            {tCommon('actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={loading}
            disabled={loading}
            className="flex-1"
          >
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
