/**
 * API 渠道创建/编辑模态框
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { adminChannelService } from '@/lib/api/services/admin/channels'
import { adminProviderService } from '@/lib/api/services/admin/providers'
import type { Channel, CreateChannelDto, UpdateChannelDto, ChannelStatus } from '@/lib/api/types/admin/channels'
import type { Provider } from '@/lib/api/types/admin/providers'
import { isAdminModelsHiddenProvider } from '@/lib/constants/providers'

interface ChannelModalProps {
  isOpen: boolean
  onClose: () => void
  channel?: Channel // 如果提供则为编辑模式
  onSuccess?: () => void
}

export function ChannelModal({
  isOpen,
  onClose,
  channel,
  onSuccess,
}: ChannelModalProps) {
  const t = useTranslations('admin.models.channels')
  const tCommon = useTranslations('admin.common')

  const isEditMode = !!channel

  // Form state
  const [name, setName] = useState('')
  const [providerId, setProviderId] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [weight, setWeight] = useState('100')
  const [timeout, setTimeout] = useState('300000')
  const [status, setStatus] = useState<ChannelStatus>('active')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Providers list
  const [providers, setProviders] = useState<Provider[]>([])
  const [providersLoading, setProvidersLoading] = useState(false)
  const isWanxProvider = providerId.toLowerCase().trim() === 'wanx' || providerId.toLowerCase().trim() === 'wanxiang'

  // Fetch providers when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchProviders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Initialize form with channel data in edit mode
  useEffect(() => {
    if (channel) {
      setName(channel.name)
      setProviderId(channel.provider)
      setBaseUrl(channel.baseUrl)
      setApiKey('') // Don't show existing API key for security
      setWeight(channel.priority.toString())
      setTimeout(channel.timeout.toString())
      setStatus(channel.status)
    } else {
      // Reset form for create mode
      setName('')
      setProviderId('')
      setBaseUrl('')
      setApiKey('')
      setWeight('100')
      setTimeout('300000')
      setStatus('active')
    }
  }, [channel, isOpen])

  const fetchProviders = async () => {
    setProvidersLoading(true)
    try {
      const response = await adminProviderService.getProviders()
      // Filter only enabled providers
      setProviders(response.filter((p) => p.isActive && !isAdminModelsHiddenProvider(p.provider)))
    } catch (error) {
      console.error('Failed to fetch providers:', error)
    } finally {
      setProvidersLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!name.trim()) {
      setError('请输入渠道名称')
      return
    }

    if (!providerId) {
      setError('请选择提供商')
      return
    }

    if (!baseUrl.trim()) {
      setError('请输入 Base URL')
      return
    }

    // API key is required for create, optional for edit
    if (!isEditMode && !apiKey.trim()) {
      setError('请输入 API Key')
      return
    }

    const weightNum = parseInt(weight)
    if (isNaN(weightNum) || weightNum < 0) {
      setError('权重值必须为非负整数')
      return
    }

    const timeoutNum = parseInt(timeout)
    if (isNaN(timeoutNum) || timeoutNum < 1000) {
      setError('超时时间必须为正整数，且不小于 1000ms')
      return
    }

    setLoading(true)
    try {
      if (isEditMode) {
        // Update mode - use UpdateChannelDto
        const updateDto: UpdateChannelDto = {
          name: name.trim(),
          provider: providerId,
          baseUrl: baseUrl.trim(),
          priority: weightNum,
          timeout: timeoutNum,
          status,
        }

        // Only include apiKey if it's provided (optional for edit)
        if (apiKey.trim()) {
          updateDto.apiKey = apiKey.trim()
        }

        await adminChannelService.updateChannel(channel.id, updateDto)
      } else {
        // Create mode - use CreateChannelDto
        const createDto: CreateChannelDto = {
          name: name.trim(),
          provider: providerId,
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(), // Required for create
          priority: weightNum,
          timeout: timeoutNum,
          status,
        }

        await adminChannelService.createChannel(createDto)
      }

      // Success
      onSuccess?.()
      handleClose()
    } catch (err) {
      setError(isEditMode ? '更新失败，请重试' : '创建失败，请重试')
      console.error('Failed to save channel:', err)
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
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('fields.name')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入渠道名称"
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

        {/* Provider */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('fields.provider')} <span className="text-red-500">*</span>
          </label>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5',
              'font-ui text-sm text-stone-900',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors',
              providersLoading && 'opacity-50'
            )}
            required
            disabled={providersLoading}
          >
            <option value="">请选择提供商</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.provider}>
                {provider.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Base URL */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('fields.baseUrl')} <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com"
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5',
              'font-mono text-sm text-stone-900',
              'placeholder:text-stone-400',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors'
            )}
            required
          />
          {isWanxProvider && (
            <p className="mt-2 text-xs leading-5 text-stone-500">
              万相渠道请配置对应地域的 DashScope Endpoint，例如北京 `https://dashscope.aliyuncs.com/api/v1`、
              新加坡 `https://dashscope-intl.aliyuncs.com/api/v1`、弗吉尼亚 `https://dashscope-us.aliyuncs.com/api/v1`。
              模型、Base URL 和 API Key 必须同地域。
            </p>
          )}
        </div>

        {/* API Key */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            API Key {!isEditMode && <span className="text-red-500">*</span>}
            {isEditMode && (
              <span className="ml-2 text-xs text-stone-500">
                （留空则不更新）
              </span>
            )}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={isEditMode ? '留空则不更新 API Key' : '请输入 API Key'}
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5',
              'font-mono text-sm text-stone-900',
              'placeholder:text-stone-400',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors'
            )}
            required={!isEditMode}
          />
        </div>

        {/* Weight, Timeout and Status */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              {t('fields.weight')}
            </label>
            <input
              type="number"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
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
              超时时间 (ms)
            </label>
            <input
              type="number"
              min="1000"
              step="1000"
              value={timeout}
              onChange={(e) => setTimeout(e.target.value)}
              placeholder="300000"
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
              {t('fields.status')}
            </label>
            <button
              type="button"
              onClick={() =>
                setStatus(status === 'active' ? 'disabled' : 'active')
              }
              className={cn(
                'w-full rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all',
                status === 'active'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-stone-300 bg-stone-50 text-stone-600'
              )}
            >
              {status === 'active' ? '启用' : '禁用'}
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
