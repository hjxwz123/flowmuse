/**
 * AI 模型创建/编辑模态框
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ExtraCreditsConfigEditor } from '@/components/admin/forms/ExtraCreditsConfigEditor'
import { cn } from '@/lib/utils'
import { adminModelService } from '@/lib/api/services/admin/models'
import { adminProviderService } from '@/lib/api/services/admin/providers'
import { adminChannelService } from '@/lib/api/services/admin/channels'
import type { Model, CreateModelDto, ModelType, ExtraCreditsConfig, ExtraCreditsRule } from '@/lib/api/types/admin/models'
import type { Provider } from '@/lib/api/types/admin/providers'
import type { Channel } from '@/lib/api/types/admin/channels'
import { isAdminModelsHiddenProvider } from '@/lib/constants/providers'
import { buildExtraCreditsConfigFromRules, normalizeExtraCreditsRules } from '@/lib/utils/extraCredits'

function normalizeProviderFamily(providerValue: string) {
  const normalized = providerValue.toLowerCase().trim()
  if (normalized === 'qianwen') return 'qwen'
  if (normalized === 'mj') return 'midjourney'
  if (normalized === 'wanxiang') return 'wanx'
  return normalized
}

function isQwenProvider(providerValue: string) {
  const normalized = normalizeProviderFamily(providerValue)
  return normalized.includes('qwen') || normalized.includes('qianwen')
}

function isProviderMatch(left: string, right: string) {
  return normalizeProviderFamily(left) === normalizeProviderFamily(right)
}

function resolveWanx27VideoKind(providerValue: string, keyOrModel?: string | null) {
  const provider = normalizeProviderFamily(providerValue)
  const normalizedKey = String(keyOrModel || '').trim().toLowerCase()
  if (!provider.includes('wanx') || !normalizedKey.startsWith('wan2.7')) return null
  if (normalizedKey.includes('-t2v')) return 't2v'
  if (normalizedKey.includes('-i2v')) return 'i2v'
  if (normalizedKey.includes('-r2v')) return 'r2v'
  return null
}

interface ModelModalProps {
  isOpen: boolean
  onClose: () => void
  model?: Model // 如果提供则为编辑模式
  allowChatType?: boolean
  onSuccess?: () => void
}

function isNanoBananaOrGemini(providerValue: string) {
  const normalized = normalizeProviderFamily(providerValue)
  return normalized.includes('nanobanana') || normalized.includes('gemini') || normalized.includes('google')
}

function inferDefaultImageInput(providerValue: string, modelType: ModelType, keyOrModel?: string | null) {
  const normalized = normalizeProviderFamily(providerValue)

  if (modelType === 'chat') {
    return false
  }

  if (modelType === 'image') {
    return (
      normalized.includes('nanobanana') ||
      normalized.includes('gemini') ||
      normalized.includes('gpt') ||
      normalized.includes('openai') ||
      isQwenProvider(providerValue) ||
      normalized.includes('doubao') ||
      normalized.includes('bytedance') ||
      normalized.includes('ark') ||
      normalized.includes('midjourney') ||
      normalized.includes('mj')
    )
  }

  const wanxKind = resolveWanx27VideoKind(providerValue, keyOrModel)
  if (wanxKind === 't2v') return false
  if (wanxKind === 'i2v' || wanxKind === 'r2v') return true

  return (
    normalized.includes('doubao') ||
    normalized.includes('bytedance') ||
    normalized.includes('ark') ||
    normalized.includes('wanx') ||
    normalized.includes('minimax') ||
    normalized.includes('hailuo')
  )
}

function inferDefaultSizeSelect(providerValue: string) {
  return isNanoBananaOrGemini(providerValue)
}

function inferDefaultResolutionSelect(providerValue: string, keyOrModel?: string | null) {
  if (!isNanoBananaOrGemini(providerValue)) return false
  return (keyOrModel || '').toLowerCase().includes('pro')
}

function inferDefaultQuickMode(modelType: ModelType) {
  return modelType !== 'chat'
}

function inferDefaultAgentMode(providerValue: string, modelType: ModelType) {
  const normalized = normalizeProviderFamily(providerValue)

  if (modelType === 'chat') return false

  if (modelType === 'image') {
    return (
      normalized.includes('qwen') ||
      normalized.includes('doubao') ||
      normalized.includes('bytedance') ||
      normalized.includes('ark') ||
      normalized.includes('nanobanana') ||
      normalized.includes('gemini') ||
      normalized.includes('google')
    )
  }

  return (
    normalized.includes('keling') ||
    normalized.includes('doubao') ||
    normalized.includes('bytedance') ||
    normalized.includes('ark') ||
    normalized.includes('wanx') ||
    normalized.includes('minimax') ||
    normalized.includes('hailuo')
  )
}

function inferDefaultAutoMode(providerValue: string, modelType: ModelType) {
  const normalized = normalizeProviderFamily(providerValue)

  if (modelType === 'chat') return false
  if (modelType === 'image') return true

  return (
    normalized.includes('keling') ||
    normalized.includes('doubao') ||
    normalized.includes('bytedance') ||
    normalized.includes('ark') ||
    normalized.includes('minimax') ||
    normalized.includes('hailuo')
  )
}

export function ModelModal({
  isOpen,
  onClose,
  model,
  allowChatType = true,
  onSuccess,
}: ModelModalProps) {
  const t = useTranslations('admin.models.models')
  const tCommon = useTranslations('admin.common')

  const isEditMode = !!model

  // Form state
  const [name, setName] = useState('')
  const [modelKey, setModelKey] = useState('')
  const [icon, setIcon] = useState('')
  const [type, setType] = useState<ModelType>('image')
  const [provider, setProvider] = useState('')
  const [channelId, setChannelId] = useState('')
  const [creditsPerUse, setCreditsPerUse] = useState('100')
  const [specialCreditsPerUse, setSpecialCreditsPerUse] = useState('')
  const [extraCreditsRules, setExtraCreditsRules] = useState<ExtraCreditsRule[]>([])
  const [description, setDescription] = useState('')
  const [supportsImageInput, setSupportsImageInput] = useState(false)
  const [supportsResolutionSelect, setSupportsResolutionSelect] = useState(false)
  const [supportsSizeSelect, setSupportsSizeSelect] = useState(false)
  const [supportsQuickMode, setSupportsQuickMode] = useState(true)
  const [supportsAgentMode, setSupportsAgentMode] = useState(false)
  const [supportsAutoMode, setSupportsAutoMode] = useState(true)
  const [freeUserDailyQuestionLimit, setFreeUserDailyQuestionLimit] = useState('')
  const [memberDailyQuestionLimit, setMemberDailyQuestionLimit] = useState('')
  const [maxContextRounds, setMaxContextRounds] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [sortOrder, setSortOrder] = useState('100')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Providers and channels
  const [providers, setProviders] = useState<Provider[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [providersLoading, setProvidersLoading] = useState(false)
  const [channelsLoading, setChannelsLoading] = useState(false)

  const isNanoBananaOrGeminiProvider = isNanoBananaOrGemini(provider)
  const allowResolutionAndSizeToggle = type === 'image' && isNanoBananaOrGeminiProvider
  const showSpecialCredits = type !== 'chat'
  const showModeToggleSection = type !== 'chat'
  const wanx27VideoKind = resolveWanx27VideoKind(provider, modelKey)
  const isWanxAutoModeLocked = type === 'video' && (wanx27VideoKind === 't2v' || wanx27VideoKind === 'i2v')

  useEffect(() => {
    if (!isWanxAutoModeLocked) return
    setSupportsAutoMode(false)
  }, [isWanxAutoModeLocked])

  useEffect(() => {
    if (type !== 'video') return
    const nextWanxKind = resolveWanx27VideoKind(provider, modelKey)
    if (nextWanxKind === 't2v') {
      setSupportsImageInput(false)
      return
    }
    if (nextWanxKind === 'i2v' || nextWanxKind === 'r2v') {
      setSupportsImageInput(true)
    }
  }, [provider, modelKey, type])

  // Fetch providers when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchProviders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Fetch channels when provider changes
  useEffect(() => {
    if (provider) {
      fetchChannels(provider)
    } else {
      setChannels([])
      setChannelId('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  // Initialize form with model data in edit mode
  useEffect(() => {
    if (model) {
      setName(model.name)
      setModelKey(model.modelKey)
      setIcon(model.icon || '')
      setType(model.type)
      setProvider(model.provider)
      setChannelId(model.channelId)
      setCreditsPerUse(model.creditsPerUse.toString())
      setSpecialCreditsPerUse(
        model.specialCreditsPerUse === null || model.specialCreditsPerUse === undefined
          ? ''
          : model.specialCreditsPerUse.toString()
      )
      setExtraCreditsRules(normalizeExtraCreditsRules(model.extraCreditsConfig))
      setDescription(model.description || '')
      setSupportsImageInput(model.supportsImageInput ?? inferDefaultImageInput(model.provider, model.type, model.modelKey))
      setSupportsResolutionSelect(
        model.supportsResolutionSelect ?? inferDefaultResolutionSelect(model.provider, model.modelKey)
      )
      setSupportsSizeSelect(model.supportsSizeSelect ?? inferDefaultSizeSelect(model.provider))
      setSupportsQuickMode(model.supportsQuickMode ?? inferDefaultQuickMode(model.type))
      setSupportsAgentMode(model.supportsAgentMode ?? inferDefaultAgentMode(model.provider, model.type))
      setSupportsAutoMode(model.supportsAutoMode ?? inferDefaultAutoMode(model.provider, model.type))
      setFreeUserDailyQuestionLimit(
        model.freeUserDailyQuestionLimit === null || model.freeUserDailyQuestionLimit === undefined
          ? ''
          : model.freeUserDailyQuestionLimit.toString()
      )
      setMemberDailyQuestionLimit(
        model.memberDailyQuestionLimit === null || model.memberDailyQuestionLimit === undefined
          ? ''
          : model.memberDailyQuestionLimit.toString()
      )
      setMaxContextRounds(
        model.maxContextRounds === null || model.maxContextRounds === undefined
          ? ''
          : model.maxContextRounds.toString()
      )
      setIsActive(model.isActive)
      setSortOrder(model.sortOrder.toString())
    } else {
      // Reset form for create mode
      setName('')
      setModelKey('')
      setIcon('')
      setType('image')
      setProvider('')
      setChannelId('')
      setCreditsPerUse('100')
      setSpecialCreditsPerUse('')
      setExtraCreditsRules([])
      setDescription('')
      setSupportsImageInput(false)
      setSupportsResolutionSelect(false)
      setSupportsSizeSelect(false)
      setSupportsQuickMode(inferDefaultQuickMode('image'))
      setSupportsAgentMode(inferDefaultAgentMode('', 'image'))
      setSupportsAutoMode(inferDefaultAutoMode('', 'image'))
      setFreeUserDailyQuestionLimit('')
      setMemberDailyQuestionLimit('')
      setMaxContextRounds('')
      setIsActive(true)
      setSortOrder('100')
    }
  }, [model, isOpen])

  const fetchProviders = async () => {
    setProvidersLoading(true)
    try {
      const response = await adminProviderService.getProviders()
      // Filter only active providers
      setProviders(response.filter((p) => p.isActive && !isAdminModelsHiddenProvider(p.provider)))
    } catch (error) {
      console.error('Failed to fetch providers:', error)
    } finally {
      setProvidersLoading(false)
    }
  }

  const fetchChannels = async (provId: string) => {
    setChannelsLoading(true)
    try {
      const response = await adminChannelService.getChannels()
      // Filter channels by provider and status
      setChannels(
        response.filter(
          (c) =>
            isProviderMatch(c.provider, provId) &&
            c.status === 'active' &&
            !isAdminModelsHiddenProvider(c.provider)
        )
      )
    } catch (error) {
      console.error('Failed to fetch channels:', error)
    } finally {
      setChannelsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!name.trim()) {
      setError('请输入模型名称')
      return
    }

    if (!modelKey.trim()) {
      setError('请输入 Model Key')
      return
    }

    if (!provider) {
      setError('请选择提供商')
      return
    }

    if (!channelId) {
      setError('请选择渠道')
      return
    }

    const creditsNum = parseInt(creditsPerUse)
    if (isNaN(creditsNum) || creditsNum < 0) {
      setError('点数消耗必须为非负整数')
      return
    }

    let specialCreditsNum: number | null = null
    if (type !== 'chat' && specialCreditsPerUse.trim()) {
      const parsed = parseInt(specialCreditsPerUse)
      if (isNaN(parsed) || parsed < 0) {
        setError('特价点数必须为非负整数')
        return
      }
      if (parsed >= creditsNum && creditsNum > 0) {
        setError('特价点数需小于原价点数')
        return
      }
      specialCreditsNum = parsed
    }

    const sortNum = parseInt(sortOrder)
    if (isNaN(sortNum) || sortNum < 0) {
      setError('排序值必须为非负整数')
      return
    }

    const parseOptionalDailyLimit = (value: string, label: string) => {
      const text = value.trim()
      if (!text) return null
      const parsed = Number(text)
      if (!Number.isInteger(parsed) || parsed < 0) {
        setError(`${label}必须为非负整数`)
        return undefined
      }
      return parsed
    }

    let parsedFreeUserDailyQuestionLimit: number | null = null
    let parsedMemberDailyQuestionLimit: number | null = null
    let parsedMaxContextRounds: number | null = null

    if (type === 'chat') {
      const freeLimit = parseOptionalDailyLimit(freeUserDailyQuestionLimit, '免费用户每日提问上限')
      if (freeLimit === undefined) return
      parsedFreeUserDailyQuestionLimit = freeLimit

      const memberLimit = parseOptionalDailyLimit(memberDailyQuestionLimit, '会员每日提问上限')
      if (memberLimit === undefined) return
      parsedMemberDailyQuestionLimit = memberLimit

      const maxRoundsText = maxContextRounds.trim()
      if (maxRoundsText) {
        const parsed = Number(maxRoundsText)
        if (!Number.isInteger(parsed) || parsed < 1) {
          setError('最大上下文轮数必须为正整数')
          return
        }
        parsedMaxContextRounds = parsed
      }
    }

    let parsedExtraCreditsConfig: ExtraCreditsConfig | null = null
    const extraCreditsConfigResult = buildExtraCreditsConfigFromRules(extraCreditsRules)
    if (extraCreditsConfigResult.error) {
      setError(extraCreditsConfigResult.error)
      return
    }
    parsedExtraCreditsConfig = extraCreditsConfigResult.config

    setLoading(true)
    try {
      if (isEditMode) {
        const dto: CreateModelDto = {
          name: name.trim(),
          modelKey: modelKey.trim(),
          icon: icon.trim() || null,
          type,
          provider,
          channelId,
          creditsPerUse: creditsNum,
          specialCreditsPerUse: type === 'chat' ? null : specialCreditsNum,
          extraCreditsConfig: parsedExtraCreditsConfig,
          description: description.trim() || null,
          supportsImageInput,
          supportsResolutionSelect: allowResolutionAndSizeToggle ? supportsResolutionSelect : false,
          supportsSizeSelect: allowResolutionAndSizeToggle ? supportsSizeSelect : false,
          supportsQuickMode: type === 'chat' ? null : supportsQuickMode,
          supportsAgentMode: type === 'chat' ? null : supportsAgentMode,
          supportsAutoMode: type === 'chat' ? null : isWanxAutoModeLocked ? false : supportsAutoMode,
          freeUserDailyQuestionLimit: type === 'chat' ? parsedFreeUserDailyQuestionLimit : null,
          memberDailyQuestionLimit: type === 'chat' ? parsedMemberDailyQuestionLimit : null,
          maxContextRounds: type === 'chat' ? parsedMaxContextRounds : null,
          isActive,
          sortOrder: sortNum,
        }
        await adminModelService.updateModel(model.id, dto)
      } else {
        const dto: CreateModelDto = {
          name: name.trim(),
          modelKey: modelKey.trim(),
          icon: icon.trim() || null,
          type,
          provider,
          channelId,
          creditsPerUse: creditsNum,
          specialCreditsPerUse: type === 'chat' ? null : specialCreditsNum,
          extraCreditsConfig: parsedExtraCreditsConfig,
          description: description.trim() || null,
          supportsImageInput,
          supportsResolutionSelect: allowResolutionAndSizeToggle ? supportsResolutionSelect : false,
          supportsSizeSelect: allowResolutionAndSizeToggle ? supportsSizeSelect : false,
          supportsQuickMode: type === 'chat' ? null : supportsQuickMode,
          supportsAgentMode: type === 'chat' ? null : supportsAgentMode,
          supportsAutoMode: type === 'chat' ? null : isWanxAutoModeLocked ? false : supportsAutoMode,
          freeUserDailyQuestionLimit: type === 'chat' ? parsedFreeUserDailyQuestionLimit : null,
          memberDailyQuestionLimit: type === 'chat' ? parsedMemberDailyQuestionLimit : null,
          maxContextRounds: type === 'chat' ? parsedMaxContextRounds : null,
          isActive,
          sortOrder: sortNum,
        }
        await adminModelService.createModel(dto)
      }

      // Success
      onSuccess?.()
      handleClose()
    } catch (err) {
      const backendMsg = (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message
      const normalizedMsg = Array.isArray(backendMsg)
        ? backendMsg.join('；')
        : backendMsg
      setError(normalizedMsg || (isEditMode ? '更新失败，请重试' : '创建失败，请重试'))
      console.error('Failed to save model:', err)
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
        {/* Model Name and Key */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              模型名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Stable Diffusion XL"
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
              Model Key <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={modelKey}
              onChange={(e) => setModelKey(e.target.value)}
              placeholder="stable-diffusion-xl"
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
        </div>

        {/* Icon URL or Upload */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            图标
          </label>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="https://example.com/icon.png 或 data:image/..."
                className={cn(
                  'flex-1 rounded-lg border border-stone-200 px-4 py-2.5',
                  'font-ui text-sm text-stone-900',
                  'placeholder:text-stone-400',
                  'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                  'transition-colors'
                )}
              />
              {icon && (
                <button
                  type="button"
                  onClick={() => setIcon('')}
                  className={cn(
                    'px-4 py-2.5 rounded-lg border border-stone-200',
                    'font-ui text-sm text-stone-600 hover:text-red-600',
                    'hover:border-red-300 transition-colors'
                  )}
                >
                  清除
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg',
                  'border-2 border-dashed border-stone-300',
                  'font-ui text-sm text-stone-600 cursor-pointer',
                  'hover:border-aurora-purple hover:text-aurora-purple',
                  'transition-colors'
                )}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                上传图片
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return

                    if (!file.type.startsWith('image/')) {
                      setError('请选择图片文件')
                      return
                    }

                    if (file.size > 500 * 1024) {
                      setError('图片文件大小不能超过 500KB')
                      return
                    }

                    const reader = new FileReader()
                    reader.onload = (event) => {
                      const base64 = event.target?.result as string
                      setIcon(base64)
                      setError('')
                    }
                    reader.onerror = () => {
                      setError('读取文件失败')
                    }
                    reader.readAsDataURL(file)
                    e.target.value = ''
                  }}
                  className="hidden"
                />
              </label>

              {icon && (
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg border-2 border-stone-200 flex items-center justify-center overflow-hidden bg-white">
                    {icon.startsWith('data:image') || icon.startsWith('http') ? (
                      <img
                        src={icon}
                        alt="Icon preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xl">{icon}</span>
                    )}
                  </div>
                  <span className="font-ui text-xs text-stone-500">预览</span>
                </div>
              )}
            </div>

            <p className="font-ui text-xs text-stone-500">
              支持上传图片（PNG、JPG、SVG等，最大 500KB）或填写图标 URL
            </p>
          </div>
        </div>

        {/* Type */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            {t('fields.type')} <span className="text-red-500">*</span>
          </label>
          <div className={cn('grid gap-3', allowChatType ? 'grid-cols-3' : 'grid-cols-2')}>
            <button
              type="button"
              onClick={() => {
                setType('image')
                setSupportsImageInput(inferDefaultImageInput(provider, 'image', modelKey))
                setSupportsQuickMode(inferDefaultQuickMode('image'))
                setSupportsAgentMode(inferDefaultAgentMode(provider, 'image'))
                setSupportsAutoMode(inferDefaultAutoMode(provider, 'image'))
              }}
              className={cn(
                'rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all',
                type === 'image'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-blue-200'
              )}
            >
              {t('types.image')}
            </button>
            <button
              type="button"
              onClick={() => {
                setType('video')
                setSupportsImageInput(inferDefaultImageInput(provider, 'video', modelKey))
                setSupportsQuickMode(inferDefaultQuickMode('video'))
                setSupportsAgentMode(inferDefaultAgentMode(provider, 'video'))
                setSupportsAutoMode(inferDefaultAutoMode(provider, 'video'))
              }}
              className={cn(
                'rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all',
                type === 'video'
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-purple-200'
              )}
            >
              {t('types.video')}
            </button>
            {allowChatType && (
              <button
                type="button"
                onClick={() => {
                  setType('chat')
                  setSupportsImageInput(inferDefaultImageInput(provider, 'chat', modelKey))
                  setSupportsQuickMode(inferDefaultQuickMode('chat'))
                  setSupportsAgentMode(inferDefaultAgentMode(provider, 'chat'))
                  setSupportsAutoMode(inferDefaultAutoMode(provider, 'chat'))
                }}
                className={cn(
                  'rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all',
                  type === 'chat'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-emerald-200'
                )}
              >
                {t('types.chat')}
              </button>
            )}
          </div>
        </div>

        {/* Provider and Channel */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              {t('fields.provider')} <span className="text-red-500">*</span>
            </label>
            <select
              value={provider}
              onChange={(e) => {
                const nextProvider = e.target.value
                setProvider(nextProvider)
                setChannelId('') // Reset channel when provider changes
                setSupportsImageInput(inferDefaultImageInput(nextProvider, type, modelKey))
                setSupportsResolutionSelect(inferDefaultResolutionSelect(nextProvider, modelKey))
                setSupportsSizeSelect(inferDefaultSizeSelect(nextProvider))
                setSupportsQuickMode(inferDefaultQuickMode(type))
                setSupportsAgentMode(inferDefaultAgentMode(nextProvider, type))
                setSupportsAutoMode(inferDefaultAutoMode(nextProvider, type))
              }}
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
              {providers.map((prov) => (
                <option key={prov.id} value={prov.provider}>
                  {prov.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              {t('fields.channel')} <span className="text-red-500">*</span>
            </label>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className={cn(
                'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                'font-ui text-sm text-stone-900',
                'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                'transition-colors',
                (channelsLoading || !provider) && 'opacity-50'
              )}
              required
              disabled={channelsLoading || !provider}
            >
              <option value="">
                {!provider ? '请先选择提供商' : '请选择渠道'}
              </option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Credits Cost, Sort, and Status */}
        <div className={cn('grid gap-4', showSpecialCredits ? 'grid-cols-4' : 'grid-cols-3')}>
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              {t('fields.creditsCost')} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              value={creditsPerUse}
              onChange={(e) => setCreditsPerUse(e.target.value)}
              className={cn(
                'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                'font-ui text-sm text-stone-900',
                'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                'transition-colors'
              )}
              required
            />
          </div>
          {showSpecialCredits ? (
            <div>
              <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                {t('fields.specialCreditsCost')}
              </label>
              <input
                type="number"
                min="0"
                value={specialCreditsPerUse}
                onChange={(e) => setSpecialCreditsPerUse(e.target.value)}
                placeholder="可选，低于原价"
                className={cn(
                  'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                  'font-ui text-sm text-stone-900',
                  'placeholder:text-stone-400',
                  'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                  'transition-colors'
                )}
              />
            </div>
          ) : null}
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              排序
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

        {/* Description */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
            模型描述
            <span className="ml-2 text-xs text-stone-500 font-normal">（可选，展示给前端用户）</span>
          </label>
          <textarea
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            placeholder="例如：擅长写实风格，推荐用于人物短视频或教学场景。"
            rows={3}
            className={cn(
              'w-full rounded-lg border border-stone-200 px-4 py-2.5',
              'font-ui text-sm text-stone-900',
              'placeholder:text-stone-400',
              'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
              'transition-colors resize-none'
            )}
          />
        </div>

        {type === 'chat' && (
          <div className="space-y-3">
            <label className="block font-ui text-sm font-medium text-stone-700">
              每日提问上限
              <span className="ml-2 text-xs text-stone-500 font-normal">（可选，留空表示不限制）</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  免费用户（非会员）
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={freeUserDailyQuestionLimit}
                  onChange={(e) => setFreeUserDailyQuestionLimit(e.target.value)}
                  placeholder="例如：20"
                  className={cn(
                    'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                    'font-ui text-sm text-stone-900',
                    'placeholder:text-stone-400',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors'
                  )}
                />
              </div>
              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  会员用户
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={memberDailyQuestionLimit}
                  onChange={(e) => setMemberDailyQuestionLimit(e.target.value)}
                  placeholder="例如：200"
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
            <div>
              <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                最大上下文轮数
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={maxContextRounds}
                onChange={(e) => setMaxContextRounds(e.target.value)}
                placeholder="例如：20（留空使用默认）"
                className={cn(
                  'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                  'font-ui text-sm text-stone-900',
                  'placeholder:text-stone-400',
                  'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                  'transition-colors'
                )}
              />
            </div>
            <p className="text-xs text-stone-500">
              会员按是否处于有效会员期判断，不区分会员等级。
            </p>
          </div>
        )}

        {showModeToggleSection && (
          <div className="space-y-3">
            <label className="block font-ui text-sm font-medium text-stone-700">
              创作模式开关
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSupportsQuickMode(!supportsQuickMode)}
                className={cn(
                  'rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all text-left',
                  supportsQuickMode
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-stone-300 bg-stone-50 text-stone-600'
                )}
              >
                支持快速模式
                <span className="mt-1 block text-xs font-normal text-stone-500">
                  控制 create 页面是否显示该模型
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSupportsAgentMode(!supportsAgentMode)}
                className={cn(
                  'rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all text-left',
                  supportsAgentMode
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-stone-300 bg-stone-50 text-stone-600'
                )}
              >
                支持 Agent 模式
                <span className="mt-1 block text-xs font-normal text-stone-500">
                  控制聊天页 Agent 模式是否显示该模型
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isWanxAutoModeLocked) return
                  setSupportsAutoMode(!supportsAutoMode)
                }}
                className={cn(
                  'rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all text-left',
                  isWanxAutoModeLocked && 'cursor-not-allowed opacity-60',
                  supportsAutoMode
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-stone-300 bg-stone-50 text-stone-600'
                )}
                disabled={isWanxAutoModeLocked}
              >
                支持全自动模式
                <span className="mt-1 block text-xs font-normal text-stone-500">
                  {isWanxAutoModeLocked ? 'wan2.7-t2v / wan2.7-i2v 不支持' : '控制聊天页全自动模式是否显示该模型'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Capability Flags */}
        <div className="space-y-3">
          <label className="block font-ui text-sm font-medium text-stone-700">
            前端能力开关
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setSupportsImageInput(!supportsImageInput)}
              className={cn(
                'rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all text-left',
                supportsImageInput
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-stone-300 bg-stone-50 text-stone-600'
              )}
            >
              {type === 'chat' ? '支持图片上传' : '支持垫图上传'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!allowResolutionAndSizeToggle) return
                setSupportsResolutionSelect(!supportsResolutionSelect)
              }}
              className={cn(
                'rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all text-left',
                !allowResolutionAndSizeToggle && 'opacity-50 cursor-not-allowed',
                supportsResolutionSelect && allowResolutionAndSizeToggle
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-stone-300 bg-stone-50 text-stone-600'
              )}
            >
              支持分辨率选择
              {!allowResolutionAndSizeToggle && (
                <span className="block mt-1 text-xs font-normal text-stone-500">
                  仅图片模型且 nanobanana/gemini 可配置
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!allowResolutionAndSizeToggle) return
                setSupportsSizeSelect(!supportsSizeSelect)
              }}
              className={cn(
                'rounded-lg border-2 px-4 py-2.5 font-ui text-sm font-medium transition-all text-left',
                !allowResolutionAndSizeToggle && 'opacity-50 cursor-not-allowed',
                supportsSizeSelect && allowResolutionAndSizeToggle
                  ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700'
                  : 'border-stone-300 bg-stone-50 text-stone-600'
              )}
            >
              支持尺寸/比例选择
              {!allowResolutionAndSizeToggle && (
                <span className="block mt-1 text-xs font-normal text-stone-500">
                  仅图片模型且 nanobanana/gemini 可配置
                </span>
              )}
            </button>
          </div>
        </div>

        <ExtraCreditsConfigEditor
          value={extraCreditsRules}
          onChange={setExtraCreditsRules}
          disabled={loading}
        />

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
