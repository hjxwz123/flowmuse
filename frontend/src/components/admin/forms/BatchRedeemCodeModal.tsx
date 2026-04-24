/**
 * 批量生成兑换码模态框
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { adminRedeemCodeService } from '@/lib/api/services/admin/redeemCodes'
import { adminMembershipService } from '@/lib/api/services/admin/memberships'
import type {
  BatchCreateRedeemCodeDto,
  RedeemCodeType,
  AdminRedeemCode,
  MembershipPeriod,
} from '@/lib/api/types/admin/redeemCodes'
import type { AdminMembershipLevel } from '@/lib/api/types/admin/memberships'

interface BatchRedeemCodeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function BatchRedeemCodeModal({
  isOpen,
  onClose,
  onSuccess,
}: BatchRedeemCodeModalProps) {
  const t = useTranslations('admin.redeemCodes')
  const tCommon = useTranslations('admin.common')

  const [type, setType] = useState<RedeemCodeType>('membership')
  const [membershipLevelId, setMembershipLevelId] = useState('')
  const [membershipPeriod, setMembershipPeriod] = useState<MembershipPeriod>('monthly')
  const [membershipCycles, setMembershipCycles] = useState('1')
  const [credits, setCredits] = useState('')
  const [count, setCount] = useState('10')
  const [maxUseCount, setMaxUseCount] = useState('1')
  const [expireDate, setExpireDate] = useState('')
  const [description, setDescription] = useState('')

  const [membershipLevels, setMembershipLevels] = useState<AdminMembershipLevel[]>([])
  const [loadingMemberships, setLoadingMemberships] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AdminRedeemCode[] | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadMembershipLevels()
      setResult(null)
    }
  }, [isOpen])

  const loadMembershipLevels = async () => {
    setLoadingMemberships(true)
    try {
      const data = await adminMembershipService.getMembershipLevels()
      setMembershipLevels(data.filter((level) => level.isActive))
    } catch (err) {
      console.error('Failed to load membership levels:', err)
    } finally {
      setLoadingMemberships(false)
    }
  }

  useEffect(() => {
    if (!isOpen) {
      setType('membership')
      setMembershipLevelId('')
      setMembershipPeriod('monthly')
      setMembershipCycles('1')
      setCredits('')
      setCount('10')
      setMaxUseCount('1')
      setExpireDate('')
      setDescription('')
      setError('')
      setResult(null)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const countNum = parseInt(count)
    if (isNaN(countNum) || countNum <= 0 || countNum > 500) {
      setError('生成数量必须在 1-500 之间')
      return
    }

    if (type === 'membership') {
      if (!membershipLevelId) {
        setError('请选择会员等级')
        return
      }
      const cycles = parseInt(membershipCycles)
      if (isNaN(cycles) || cycles <= 0) {
        setError('会员期数必须大于 0')
        return
      }
    }

    if (type === 'credits') {
      const creditsNum = parseInt(credits)
      if (isNaN(creditsNum) || creditsNum <= 0) {
        setError('请输入有效的点数数量')
        return
      }
    }

    const maxUses = parseInt(maxUseCount)
    if (isNaN(maxUses) || maxUses <= 0) {
      setError('最大使用次数必须大于 0')
      return
    }

    setLoading(true)
    try {
      const dto: BatchCreateRedeemCodeDto = {
        count: countNum,
        type,
        membershipLevelId: type === 'membership' ? membershipLevelId : null,
        membershipPeriod: type === 'membership' ? membershipPeriod : null,
        membershipCycles: type === 'membership' ? parseInt(membershipCycles) : null,
        credits: type === 'credits' ? parseInt(credits) : null,
        maxUseCount: maxUses,
        expireDate: expireDate ? new Date(expireDate).toISOString() : null,
        status: 'active',
        description: description.trim() || null,
      }

      const response = await adminRedeemCodeService.batchCreateRedeemCodes(dto)
      setResult(response.codes)
      onSuccess?.()
    } catch (err) {
      setError('批量生成失败，请重试')
      console.error('Failed to batch create redeem codes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setError('')
      setResult(null)
      onClose()
    }
  }

  const handleCopyAll = () => {
    if (!result) return
    const codes = result.map((r) => r.code).join('\n')
    navigator.clipboard.writeText(codes)
    alert('已复制所有兑换码到剪贴板')
  }

  if (result && result.length > 0) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="批量生成成功">
        <div className="space-y-4">
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <p className="font-ui text-sm text-green-700">
              成功生成 <span className="font-bold">{result.length}</span> 个兑换码
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto rounded-lg border border-stone-200 bg-stone-50 p-4">
            <div className="space-y-2">
              {result.map((code) => (
                <div
                  key={code.id}
                  className="font-mono text-sm text-stone-900 bg-white rounded px-3 py-2 border border-stone-200"
                >
                  {code.code}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCopyAll}
              className="flex-1"
            >
              复制全部
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleClose}
              className="flex-1"
            >
              关闭
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('batchCreate')}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('form.typeLabel')} <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(['membership', 'credits'] as RedeemCodeType[]).map((itemType) => (
              <button
                key={itemType}
                type="button"
                onClick={() => setType(itemType)}
                className={cn(
                  'rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all',
                  type === itemType
                    ? 'border-aurora-purple bg-aurora-purple/10 text-aurora-purple'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-aurora-purple/30'
                )}
              >
                {itemType === 'membership' ? '会员' : '点数'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('form.quantityLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max="500"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5',
              'font-ui text-sm text-stone-900',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors'
            )}
            required
          />
          <p className="text-xs text-stone-500 mt-1">最多 500 个</p>
        </div>

        {type === 'membership' && (
          <>
            <div>
              <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                会员等级 <span className="text-red-500">*</span>
              </label>
              <select
                value={membershipLevelId}
                onChange={(e) => setMembershipLevelId(e.target.value)}
                className={cn(
                  'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                  'font-ui text-sm text-stone-900',
                  'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                  'transition-colors'
                )}
                required
                disabled={loadingMemberships}
              >
                <option value="">请选择会员等级</option>
                {membershipLevels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  会员周期 <span className="text-red-500">*</span>
                </label>
                <select
                  value={membershipPeriod}
                  onChange={(e) => setMembershipPeriod(e.target.value as MembershipPeriod)}
                  className={cn(
                    'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                    'font-ui text-sm text-stone-900',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors'
                  )}
                >
                  <option value="monthly">月付</option>
                  <option value="yearly">年付</option>
                </select>
              </div>

              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  会员期数 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={membershipCycles}
                  onChange={(e) => setMembershipCycles(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                    'font-ui text-sm text-stone-900',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors'
                  )}
                  required
                />
              </div>
            </div>
          </>
        )}

        {type === 'credits' && (
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              {t('form.creditsLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              placeholder="100"
              className={cn(
                'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                'font-ui text-sm text-stone-900',
                'placeholder:text-stone-400',
                'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                'transition-colors'
              )}
              required
            />
          </div>
        )}

        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('form.maxUsesLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={maxUseCount}
            onChange={(e) => setMaxUseCount(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5',
              'font-ui text-sm text-stone-900',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors'
            )}
            required
          />
        </div>

        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('form.expiryLabel')}
          </label>
          <input
            type="date"
            value={expireDate}
            onChange={(e) => setExpireDate(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5',
              'font-ui text-sm text-stone-900',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors'
            )}
          />
          <p className="text-xs text-stone-500 mt-1">留空表示永不过期</p>
        </div>

        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            备注
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="批次备注"
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5',
              'font-ui text-sm text-stone-900',
              'placeholder:text-stone-400',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors',
              'resize-none'
            )}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
            {tCommon('actions.cancel')}
          </Button>
          <Button type="submit" variant="primary" isLoading={loading} disabled={loading}>
            {tCommon('actions.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
