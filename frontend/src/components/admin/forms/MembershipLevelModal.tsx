'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { adminMembershipService } from '@/lib/api/services/admin/memberships'
import type {
  AdminMembershipLevel,
  CreateMembershipLevelDto,
} from '@/lib/api/types/admin/memberships'
import { cn } from '@/lib/utils/cn'

interface MembershipLevelModalProps {
  isOpen: boolean
  onClose: () => void
  level?: AdminMembershipLevel
  onSuccess?: () => void
}

function normalizeBenefitsInput(input: string): string[] {
  return input
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeColorForPicker(input: string): string {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(input) ? input : '#F59E0B'
}

export function MembershipLevelModal({
  isOpen,
  onClose,
  level,
  onSuccess,
}: MembershipLevelModalProps) {
  const t = useTranslations('admin.memberships')
  const tCommon = useTranslations('admin.common')

  const isEditMode = Boolean(level)
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [color, setColor] = useState('#F59E0B')
  const [monthlyPrice, setMonthlyPrice] = useState('')
  const [yearlyPrice, setYearlyPrice] = useState('')
  const [dailyCredits, setDailyCredits] = useState('0')
  const [bonusPermanentCredits, setBonusPermanentCredits] = useState('0')
  const [sortOrder, setSortOrder] = useState('0')
  const [benefitsText, setBenefitsText] = useState('')
  const [benefitsEnText, setBenefitsEnText] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (level) {
      setName(level.name)
      setNameEn(level.nameEn || '')
      setColor(level.color || '#F59E0B')
      setMonthlyPrice(level.monthlyPrice)
      setYearlyPrice(level.yearlyPrice)
      setDailyCredits(String(level.dailyCredits ?? 0))
      setBonusPermanentCredits(String(level.bonusPermanentCredits ?? 0))
      setSortOrder(String(level.sortOrder ?? 0))
      setBenefitsText(Array.isArray(level.benefits) ? level.benefits.join('\n') : '')
      setBenefitsEnText(Array.isArray(level.benefitsEn) ? level.benefitsEn.join('\n') : '')
      setIsActive(level.isActive)
    } else {
      setName('')
      setNameEn('')
      setColor('#F59E0B')
      setMonthlyPrice('')
      setYearlyPrice('')
      setDailyCredits('0')
      setBonusPermanentCredits('0')
      setSortOrder('0')
      setBenefitsText('')
      setBenefitsEnText('')
      setIsActive(true)
    }
    setError('')
  }, [level, isOpen])

  const handleClose = (force = false) => {
    if (loading && !force) return
    setError('')
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError(t('form.nameRequired'))
      return
    }

    const normalizedColor = color.trim()
    if (!normalizedColor) {
      setError(t('form.colorRequired'))
      return
    }

    const monthly = Number(monthlyPrice)
    if (!Number.isFinite(monthly) || monthly < 0) {
      setError(t('form.monthlyPriceRequired'))
      return
    }

    const yearly = Number(yearlyPrice)
    if (!Number.isFinite(yearly) || yearly < 0) {
      setError(t('form.yearlyPriceRequired'))
      return
    }

    const bonusCredits = Number(bonusPermanentCredits)
    if (!Number.isInteger(bonusCredits) || bonusCredits < 0) {
      setError(t('form.bonusPermanentCreditsInvalid'))
      return
    }

    const parsedDailyCredits = Number(dailyCredits)
    if (!Number.isInteger(parsedDailyCredits) || parsedDailyCredits < 0) {
      setError('每日赠送积分必须是大于等于 0 的整数')
      return
    }

    const sort = Number(sortOrder)
    if (!Number.isFinite(sort) || sort < 0) {
      setError(t('form.sortOrderInvalid'))
      return
    }

    const dto: CreateMembershipLevelDto = {
      name: trimmedName,
      nameEn: nameEn.trim() || null,
      color: normalizedColor,
      monthlyPrice: monthly,
      yearlyPrice: yearly,
      dailyCredits: parsedDailyCredits,
      bonusPermanentCredits: bonusCredits,
      benefits: normalizeBenefitsInput(benefitsText),
      benefitsEn: normalizeBenefitsInput(benefitsEnText),
      sortOrder: Math.floor(sort),
      isActive,
    }

    try {
      setLoading(true)
      if (isEditMode && level) {
        await adminMembershipService.updateMembershipLevel(level.id, dto)
      } else {
        await adminMembershipService.createMembershipLevel(dto)
      }
      onSuccess?.()
      handleClose(true)
    } catch (err) {
      const maybeMessage = (
        err as { response?: { data?: { message?: string | string[] } } }
      )?.response?.data?.message
      const message = Array.isArray(maybeMessage) ? maybeMessage.join('；') : maybeMessage
      setError(message || t('error.save'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isEditMode ? t('edit') : t('add')}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-stone-700">
            {t('fields.name')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-900',
              'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
            )}
            placeholder={t('form.namePlaceholder')}
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-stone-700">
            {t('fields.nameEn')}
          </label>
          <input
            type="text"
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
            maxLength={100}
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-900',
              'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
            )}
            placeholder={t('form.nameEnPlaceholder')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              {t('fields.color')} <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={normalizeColorForPicker(color)}
                onChange={(event) => setColor(event.target.value.toUpperCase())}
                className="h-10 w-16 cursor-pointer rounded-lg border border-stone-200 bg-white p-1"
              />
              <input
                type="text"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className={cn(
                  'flex-1 rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-900',
                  'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
                )}
                placeholder="#F59E0B"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              {t('fields.sortOrder')}
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className={cn(
                'w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-900',
                'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              {t('fields.monthlyPrice')} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={monthlyPrice}
              onChange={(event) => setMonthlyPrice(event.target.value)}
              className={cn(
                'w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-900',
                'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
              )}
              placeholder="29.90"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              {t('fields.yearlyPrice')} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={yearlyPrice}
              onChange={(event) => setYearlyPrice(event.target.value)}
              className={cn(
                'w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-900',
                'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
              )}
              placeholder="299.00"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              每日赠送积分
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={dailyCredits}
              onChange={(event) => setDailyCredits(event.target.value)}
              className={cn(
                'w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-900',
                'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
              )}
              placeholder="0"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              {t('fields.bonusPermanentCredits')}
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={bonusPermanentCredits}
              onChange={(event) => setBonusPermanentCredits(event.target.value)}
              className={cn(
                'w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-900',
                'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
              )}
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-stone-700">
            {t('fields.benefits')}
          </label>
          <textarea
            rows={5}
            value={benefitsText}
            onChange={(event) => setBenefitsText(event.target.value)}
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-900',
              'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
            )}
            placeholder={t('form.benefitsPlaceholder')}
          />
          <p className="mt-1 text-xs text-stone-500">{t('form.benefitsHint')}</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-stone-700">
            {t('fields.benefitsEn')}
          </label>
          <textarea
            rows={5}
            value={benefitsEnText}
            onChange={(event) => setBenefitsEnText(event.target.value)}
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-900',
              'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
            )}
            placeholder={t('form.benefitsEnPlaceholder')}
          />
          <p className="mt-1 text-xs text-stone-500">{t('form.benefitsEnHint')}</p>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-aurora-purple focus:ring-aurora-purple/40"
          />
          <span className="text-sm text-stone-700">{t('fields.isActive')}</span>
        </label>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={() => handleClose()} disabled={loading}>
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
