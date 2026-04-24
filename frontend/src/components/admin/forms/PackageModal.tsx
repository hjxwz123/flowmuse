/**
 * 套餐创建/编辑模态框
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { adminPackageService } from '@/lib/api/services/admin/packages'
import type {
  AdminPackage,
  CreatePackageDto,
} from '@/lib/api/types/admin/packages'

interface PackageModalProps {
  isOpen: boolean
  onClose: () => void
  package?: AdminPackage // 如果提供则为编辑模式
  onSuccess?: () => void
}

export function PackageModal({
  isOpen,
  onClose,
  package: pkg,
  onSuccess,
}: PackageModalProps) {
  const t = useTranslations('admin.packages')
  const tCommon = useTranslations('admin.common')

  const isEditMode = !!pkg

  // Form state
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [totalCredits, setTotalCredits] = useState('100')
  const [price, setPrice] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [description, setDescription] = useState('')
  const [descriptionEn, setDescriptionEn] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Initialize form with package data in edit mode
  useEffect(() => {
    if (pkg) {
      setName(pkg.name)
      setNameEn(pkg.nameEn || '')
      setTotalCredits(pkg.totalCredits.toString())
      setPrice(pkg.price)
      setOriginalPrice(pkg.originalPrice || '')
      setDescription(pkg.description || '')
      setDescriptionEn(pkg.descriptionEn || '')
      setSortOrder(pkg.sortOrder.toString())
      setIsActive(pkg.isActive)
    } else {
      // Reset form for create mode
      setName('')
      setNameEn('')
      setTotalCredits('100')
      setPrice('')
      setOriginalPrice('')
      setDescription('')
      setDescriptionEn('')
      setSortOrder('0')
      setIsActive(true)
    }
    setError('')
  }, [pkg, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!name.trim()) {
      setError(t('form.nameRequired'))
      return
    }

    const credits = parseInt(totalCredits)
    if (isNaN(credits) || credits <= 0) {
      setError(t('form.creditsRequired'))
      return
    }

    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0) {
      setError(t('form.priceRequired'))
      return
    }

    let originalPriceNum: number | null = null
    if (originalPrice.trim()) {
      originalPriceNum = parseFloat(originalPrice)
      if (isNaN(originalPriceNum) || originalPriceNum < 0) {
        setError('原价格式错误')
        return
      }
    }

    const sort = parseInt(sortOrder)
    if (isNaN(sort) || sort < 0) {
      setError('排序值必须为非负整数')
      return
    }

    setLoading(true)
    try {
      const dto: CreatePackageDto = {
        name: name.trim(),
        nameEn: nameEn.trim() || null,
        packageType: 'credits',
        durationDays: 0,
        creditsPerDay: 0,
        totalCredits: credits,
        price: priceNum,
        originalPrice: originalPriceNum,
        description: description.trim() || null,
        descriptionEn: descriptionEn.trim() || null,
        sortOrder: sort,
        isActive,
      }

      if (isEditMode) {
        await adminPackageService.updatePackage(pkg.id, dto)
      } else {
        await adminPackageService.createPackage(dto)
      }

      // Success
      onSuccess?.()
      handleClose()
    } catch (err) {
      setError(isEditMode ? '更新失败，请重试' : '创建失败，请重试')
      console.error('Failed to save package:', err)
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
    <Modal isOpen={isOpen} onClose={handleClose} title={isEditMode ? t('edit') : t('add')}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
          仅支持永久积分包。时长套餐与每日限额积分已并入会员每日赠送积分。
        </div>

        {/* Name */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('fields.name')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="基础套餐"
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

        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('fields.nameEn')}
          </label>
          <input
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder={t('form.nameEnPlaceholder')}
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5',
              'font-ui text-sm text-stone-900',
              'placeholder:text-stone-400',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors'
            )}
          />
        </div>

        {/* Total Credits */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('fields.totalCredits')} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={totalCredits}
            onChange={(e) => setTotalCredits(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5',
              'font-ui text-sm text-stone-900',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors'
            )}
            required
          />
        </div>

        {/* Price and Original Price */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              {t('fields.price')} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="9.90"
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
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              {t('fields.originalPrice')}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              placeholder="19.90"
              className={cn(
                'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                'font-ui text-sm text-stone-900',
                'placeholder:text-stone-400',
                'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                'transition-colors'
              )}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('fields.description')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="套餐描述"
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

        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('fields.descriptionEn')}
          </label>
          <textarea
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
            rows={3}
            placeholder={t('form.descriptionEnPlaceholder')}
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

        {/* Sort Order and Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              {t('fields.sortOrder')}
            </label>
            <input
              type="number"
              min="0"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={cn(
                'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                'font-ui text-sm text-stone-900',
                'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                'transition-colors'
              )}
            />
            <p className="text-xs text-stone-500 mt-1">越小越靠前</p>
          </div>
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              {t('fields.status')}
            </label>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={cn(
                'w-full rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all',
                isActive
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-stone-300 bg-stone-50 text-stone-600'
              )}
            >
              {isActive ? '启用' : '禁用'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="font-ui text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
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
            {isEditMode ? tCommon('actions.save') : tCommon('actions.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
