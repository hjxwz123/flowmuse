/**
 * AI 提供商创建/编辑模态框
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { adminProviderService } from '@/lib/api/services/admin/providers'
import { AVAILABLE_PROVIDERS, getProviderConfig } from '@/lib/constants/providers'
import type { Provider, CreateProviderDto, ProviderSupportType } from '@/lib/api/types/admin/providers'

interface ProviderModalProps {
  isOpen: boolean
  onClose: () => void
  provider?: Provider // 如果提供则为编辑模式
  onSuccess?: () => void
}

const SUPPORT_TYPES: { value: ProviderSupportType; label: string }[] = [
  { value: 'image', label: '图片生成' },
  { value: 'video', label: '视频生成' },
]

export function ProviderModal({
  isOpen,
  onClose,
  provider,
  onSuccess,
}: ProviderModalProps) {
  const t = useTranslations('admin.models.providers')
  const tCommon = useTranslations('admin.common')

  const isEditMode = !!provider

  // Form state
  const [selectedPreset, setSelectedPreset] = useState('')
  const [providerKey, setProviderKey] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [adapterClass, setAdapterClass] = useState('')
  const [supportTypes, setSupportTypes] = useState<ProviderSupportType[]>(['image'])
  const [isActive, setIsActive] = useState(true)
  const [sortOrder, setSortOrder] = useState('100')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 当选择预设 provider 时自动填充字段
  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey)

    if (!presetKey) {
      // 清空选择
      setProviderKey('')
      setDisplayName('')
      setAdapterClass('')
      setSupportTypes(['image'])
      return
    }

    const config = getProviderConfig(presetKey)
    if (config) {
      setProviderKey(config.key)
      setDisplayName(config.displayName)
      setAdapterClass(config.adapterClass)
      setSupportTypes(config.supportTypes)
    }
  }

  // Initialize form with provider data in edit mode
  useEffect(() => {
    if (provider) {
      setSelectedPreset('') // 编辑模式下不显示预设选择
      setProviderKey(provider.provider)
      setDisplayName(provider.displayName)
      setAdapterClass(provider.adapterClass)
      setSupportTypes(provider.supportTypes)
      setIsActive(provider.isActive)
      setSortOrder(provider.sortOrder.toString())
    } else {
      // Reset form for create mode
      setSelectedPreset('')
      setProviderKey('')
      setDisplayName('')
      setAdapterClass('')
      setSupportTypes(['image'])
      setIsActive(true)
      setSortOrder('100')
    }
  }, [provider, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!providerKey.trim()) {
      setError('请输入提供商标识')
      return
    }

    if (!displayName.trim()) {
      setError('请输入提供商名称')
      return
    }

    if (!adapterClass.trim()) {
      setError('请输入适配器类名')
      return
    }

    if (supportTypes.length === 0) {
      setError('请至少选择一个支持类型')
      return
    }

    const sortNum = parseInt(sortOrder)
    if (isNaN(sortNum) || sortNum < 0) {
      setError('排序值必须为非负整数')
      return
    }

    setLoading(true)
    try {
      const dto: CreateProviderDto = {
        provider: providerKey.trim(),
        displayName: displayName.trim(),
        adapterClass: adapterClass.trim(),
        supportTypes,
        isActive,
        sortOrder: sortNum,
      }

      if (isEditMode) {
        await adminProviderService.updateProvider(provider.id, dto)
      } else {
        await adminProviderService.createProvider(dto)
      }

      // Success
      onSuccess?.()
      handleClose()
    } catch (err) {
      setError(isEditMode ? '更新失败，请重试' : '创建失败，请重试')
      console.error('Failed to save provider:', err)
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
      title={isEditMode ? t('edit') : t('add')}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 预设 Provider 选择（仅新建模式） */}
        {!isEditMode && (
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              选择预设 Provider
            </label>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className={cn(
                'w-full rounded-lg border-2 border-stone-200 px-4 py-3',
                'font-ui text-sm text-stone-900',
                'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                'transition-colors'
              )}
            >
              <option value="">请选择预设 Provider（或手动填写）</option>
              <optgroup label="图片生成">
                {AVAILABLE_PROVIDERS.filter((p) => p.supportTypes.includes('image')).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.icon} {p.displayName} - {p.description}
                  </option>
                ))}
              </optgroup>
              <optgroup label="视频生成">
                {AVAILABLE_PROVIDERS.filter((p) => p.supportTypes.includes('video')).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.icon} {p.displayName} - {p.description}
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="mt-2 font-ui text-xs text-stone-500">
              提示：选择预设后会自动填充下方字段，你也可以不选择预设直接手动填写
            </p>
          </div>
        )}

        {/* Provider Key and Display Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              提供商标识 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={providerKey}
              onChange={(e) => setProviderKey(e.target.value)}
              placeholder="midjourney"
              className={cn(
                'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                'font-mono text-sm text-stone-900',
                'placeholder:text-stone-400',
                'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                'transition-colors'
              )}
              required
            />
          </div>
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              {t('fields.name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Midjourney"
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
        </div>

        {/* Adapter Class */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            适配器类名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={adapterClass}
            onChange={(e) => setAdapterClass(e.target.value)}
            placeholder="MidjourneyAdapter"
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5',
              'font-mono text-sm text-stone-900',
              'placeholder:text-stone-400',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors'
            )}
            required
          />
        </div>

        {/* Support Types */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            支持类型 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {SUPPORT_TYPES.map((st) => (
              <button
                key={st.value}
                type="button"
                onClick={() => {
                  if (supportTypes.includes(st.value)) {
                    setSupportTypes(supportTypes.filter((t) => t !== st.value))
                  } else {
                    setSupportTypes([...supportTypes, st.value])
                  }
                }}
                className={cn(
                  'rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all',
                  supportTypes.includes(st.value)
                    ? 'border-aurora-purple bg-aurora-purple/10 text-aurora-purple'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-aurora-purple/30'
                )}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Order and Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              {t('fields.sort')}
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
          </div>
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              {t('fields.enabled')}
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
