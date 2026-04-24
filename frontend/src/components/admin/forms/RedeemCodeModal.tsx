/**
 * 兑换码创建/编辑模态框
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
  AdminRedeemCode,
  CreateRedeemCodeDto,
  RedeemCodeType,
  RedeemCodeStatus,
  MembershipPeriod,
} from '@/lib/api/types/admin/redeemCodes'
import type { AdminMembershipLevel } from '@/lib/api/types/admin/memberships'

interface RedeemCodeModalProps {
  isOpen: boolean
  onClose: () => void
  redeemCode?: AdminRedeemCode
  onSuccess?: () => void
}

export function RedeemCodeModal({
  isOpen,
  onClose,
  redeemCode,
  onSuccess,
}: RedeemCodeModalProps) {
  const t = useTranslations('admin.redeemCodes')
  const tCommon = useTranslations('admin.common')

  const isEditMode = !!redeemCode

  const [type, setType] = useState<RedeemCodeType>('membership')
  const [code, setCode] = useState('')
  const [membershipLevelId, setMembershipLevelId] = useState('')
  const [membershipPeriod, setMembershipPeriod] = useState<MembershipPeriod>('monthly')
  const [membershipCycles, setMembershipCycles] = useState('1')
  const [credits, setCredits] = useState('')
  const [maxUseCount, setMaxUseCount] = useState('1')
  const [expireDate, setExpireDate] = useState('')
  const [status, setStatus] = useState<RedeemCodeStatus>('active')
  const [description, setDescription] = useState('')

  const [membershipLevels, setMembershipLevels] = useState<AdminMembershipLevel[]>([])
  const [loadingMemberships, setLoadingMemberships] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadMembershipLevels()
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
    if (redeemCode) {
      setType(redeemCode.type)
      setCode(redeemCode.code)
      setMembershipLevelId(redeemCode.membershipLevelId || '')
      setMembershipPeriod(redeemCode.membershipPeriod || 'monthly')
      setMembershipCycles(String(redeemCode.membershipCycles || 1))
      setCredits(redeemCode.credits?.toString() || '')
      setMaxUseCount(redeemCode.maxUseCount.toString())
      setExpireDate(
        redeemCode.expireDate
          ? new Date(redeemCode.expireDate).toISOString().split('T')[0]
          : ''
      )
      setStatus(redeemCode.status)
      setDescription(redeemCode.description || '')
    } else {
      setType('membership')
      setCode('')
      setMembershipLevelId('')
      setMembershipPeriod('monthly')
      setMembershipCycles('1')
      setCredits('')
      setMaxUseCount('1')
      setExpireDate('')
      setStatus('active')
      setDescription('')
    }
    setError('')
  }, [redeemCode, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!code.trim()) {
      setError('请输入兑换码')
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
      const dto: CreateRedeemCodeDto = {
        code: code.trim(),
        type,
        membershipLevelId: type === 'membership' ? membershipLevelId : null,
        membershipPeriod: type === 'membership' ? membershipPeriod : null,
        membershipCycles: type === 'membership' ? parseInt(membershipCycles) : null,
        credits: type === 'credits' ? parseInt(credits) : null,
        maxUseCount: maxUses,
        expireDate: expireDate ? new Date(expireDate).toISOString() : null,
        status,
        description: description.trim() || null,
      }

      if (isEditMode && redeemCode) {
        await adminRedeemCodeService.updateRedeemCode(redeemCode.id, dto)
      } else {
        await adminRedeemCodeService.createRedeemCode(dto)
      }

      onSuccess?.()
      handleClose()
    } catch (err) {
      setError(isEditMode ? '更新失败，请重试' : '创建失败，请重试')
      console.error('Failed to save redeem code:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setError('')
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? '编辑兑换码' : t('create')}
    >
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
                disabled={isEditMode}
                className={cn(
                  'rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all',
                  type === itemType
                    ? 'border-aurora-purple bg-aurora-purple/10 text-aurora-purple'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-aurora-purple/30',
                  isEditMode && 'opacity-50 cursor-not-allowed'
                )}
              >
                {itemType === 'membership' ? '会员' : '点数'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('form.codeLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SPRING2026"
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5',
              'font-mono text-sm text-stone-900',
              'placeholder:text-stone-400',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors'
            )}
            required
          />
          <p className="text-xs text-stone-500 mt-1">{t('form.codeHint')}</p>
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
              {loadingMemberships && (
                <p className="text-xs text-stone-500 mt-1">加载会员等级中...</p>
              )}
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
            {t('fields.description')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="备注信息"
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

        {isEditMode && (
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              {t('fields.status')}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RedeemCodeStatus)}
              className={cn(
                'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                'font-ui text-sm text-stone-900',
                'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                'transition-colors'
              )}
            >
              <option value="active">{t('status.active')}</option>
              <option value="disabled">{t('status.disabled')}</option>
              <option value="expired">{t('status.expired')}</option>
            </select>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            {tCommon('actions.cancel')}
          </Button>
          <Button type="submit" variant="primary" isLoading={loading} disabled={loading}>
            {isEditMode ? tCommon('actions.save') : tCommon('actions.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
