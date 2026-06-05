'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button, EnhancedSelect, Modal } from '@/components/ui'
import { imageService } from '@/lib/api/services/images'
import { modelService } from '@/lib/api/services/models'
import type { ModelWithCapabilities } from '@/lib/api/types/modelCapabilities'
import type { ApiTask } from '@/lib/api/types/task'
import { cn } from '@/lib/utils/cn'

type ImageRegenerateModalProps = {
  isOpen: boolean
  task: ApiTask
  onClose: () => void
  onCreated: (task: ApiTask) => void
  onPurchaseRequired: (message: string) => boolean
}

function getProviderLabel(provider: string) {
  const normalized = provider.trim()
  if (!normalized) return 'Image'
  if (normalized.toLowerCase() === 'qianwen') return 'Qwen'
  if (normalized.toLowerCase() === 'mj') return 'Midjourney'
  return normalized
}

export function ImageRegenerateModal({
  isOpen,
  task,
  onClose,
  onCreated,
  onPurchaseRequired,
}: ImageRegenerateModalProps) {
  const t = useTranslations('tasks.regenerate')
  const [models, setModels] = useState<ModelWithCapabilities[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    async function loadModels() {
      setIsLoadingModels(true)
      try {
        const items = await modelService.getModelsWithCapabilities({ type: 'image' })
        if (cancelled) return
        setModels(items)
        const preferred = items.find((item) => item.id === task.modelId) ?? items[0]
        setSelectedModelId(preferred?.id ?? '')
      } catch (error) {
        console.error('[ImageRegenerateModal] Failed to load image models:', error)
        toast.error(t('loadModelsFailed'))
      } finally {
        if (!cancelled) setIsLoadingModels(false)
      }
    }

    void loadModels()

    return () => {
      cancelled = true
    }
  }, [isOpen, task.modelId, t])

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? null,
    [models, selectedModelId]
  )

  const modelOptions = useMemo(
    () =>
      models.map((model) => ({
        value: model.id,
        label: model.name,
        description: model.description || model.modelKey || model.provider,
        icon: model.icon,
        iconType: 'image' as const,
        badge: getProviderLabel(model.provider),
        meta: (
          <span>
            {t('credits', { count: model.specialCreditsPerUse && model.specialCreditsPerUse > 0
              ? model.specialCreditsPerUse
              : model.creditsPerUse })}
          </span>
        ),
      })),
    [models, t]
  )

  const handleSubmit = async () => {
    if (!selectedModelId) return

    setIsSubmitting(true)
    try {
      const created = await imageService.regenerateTask(task.id, { modelId: selectedModelId })
      toast.success(t('success'))
      onCreated(created)
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!onPurchaseRequired(message)) {
        console.error('[ImageRegenerateModal] Failed to regenerate image task:', error)
        toast.error(message || t('failed'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      size="sm"
      bodyClassName="space-y-5"
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-900/70">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-stone-500 shadow-sm dark:bg-stone-800 dark:text-stone-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                {t('sourceTask')}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-stone-900 dark:text-stone-100">
                {task.prompt || task.toolTitle || task.taskNo}
              </p>
            </div>
          </div>
        </div>

        <EnhancedSelect
          label={t('targetModel')}
          value={selectedModelId}
          onChange={setSelectedModelId}
          options={modelOptions}
          placeholder={isLoadingModels ? t('loadingModels') : t('selectModel')}
          disabled={isLoadingModels || isSubmitting || modelOptions.length === 0}
          portal
        />

        {selectedModel ? (
          <div className="grid grid-cols-2 gap-2 text-xs text-stone-500 dark:text-stone-400">
            <div className="rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-700">
              <span className="block font-medium text-stone-700 dark:text-stone-300">{t('provider')}</span>
              <span className="mt-0.5 block truncate">{getProviderLabel(selectedModel.provider)}</span>
            </div>
            <div className="rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-700">
              <span className="block font-medium text-stone-700 dark:text-stone-300">{t('cost')}</span>
              <span className="mt-0.5 block">{t('credits', { count: selectedModel.specialCreditsPerUse && selectedModel.specialCreditsPerUse > 0
                ? selectedModel.specialCreditsPerUse
                : selectedModel.creditsPerUse })}</span>
            </div>
          </div>
        ) : null}

        <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">
          {t('hint')}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
          {t('cancel')}
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedModelId || isLoadingModels || isSubmitting}
          className={cn('min-w-[120px]')}
        >
          {isSubmitting ? (
            t('submitting')
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('submit')}
            </>
          )}
        </Button>
      </div>
    </Modal>
  )
}
