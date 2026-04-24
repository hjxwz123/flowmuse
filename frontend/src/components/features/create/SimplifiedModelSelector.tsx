/**
 * 简化的模型选择器
 * 使用EnhancedSelect显示API返回的模型数据和图标
 */

'use client'

import { EnhancedSelect, EnhancedSelectOption } from '@/components/ui/EnhancedSelect'
import type { ModelWithCapabilities } from '@/lib/api/types/modelCapabilities'
import { cn } from '@/lib/utils/cn'

interface SimplifiedModelSelectorProps {
  models: ModelWithCapabilities[]
  selectedModelId: string
  onSelectModel: (modelId: string) => void
  type: 'image' | 'video'
  label?: string
  compact?: boolean
}

export function SimplifiedModelSelector({
  models,
  selectedModelId,
  onSelectModel,
  type,
  label,
  compact = false,
}: SimplifiedModelSelectorProps) {
  const buildCreditsMeta = (creditsPerUse: number, specialCreditsPerUse?: number | null) => {
    if (typeof specialCreditsPerUse === 'number' && specialCreditsPerUse >= 0 && specialCreditsPerUse < creditsPerUse) {
      return (
        <span className="inline-flex items-center gap-1.5 pt-0.5 mt-0.5">
          <span className="rounded-[4px] bg-gradient-to-r from-rose-500/15 to-orange-500/15 px-1.5 py-[2px] text-[10px] font-bold tracking-wider text-rose-600 dark:from-rose-500/20 dark:to-orange-500/20 dark:text-rose-400">
            特价
          </span>
          <span className="font-medium text-rose-600 dark:text-rose-400">
            {specialCreditsPerUse} <span className="font-normal text-rose-500/80 dark:text-rose-400/80">点/次</span>
          </span>
          <span className="text-stone-400 line-through decoration-stone-300 dark:text-stone-500 dark:decoration-stone-600">
            原价 {creditsPerUse}
          </span>
        </span>
      )
    }
    return creditsPerUse > 0 ? `${creditsPerUse} 点/次` : undefined
  }

  // 转换为EnhancedSelect选项
  const options: EnhancedSelectOption[] = models.map((model) => {
    // 构建能力标签
    const capabilities: string[] = []

    return {
      value: model.id,
      label: model.name,
      icon: model.icon || model.capabilities?.providerIcon || null,
      iconType: type,
      badge: capabilities.length > 0 ? capabilities.join(' · ') : undefined,
      badgeColor: 'bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-200',
      meta: buildCreditsMeta(model.creditsPerUse, model.specialCreditsPerUse),
    }
  })

  return (
    <div className={cn(label ? 'space-y-2' : 'space-y-0')}>
      <EnhancedSelect
        label={label}
        value={selectedModelId}
        onChange={onSelectModel}
        options={options}
        placeholder={models.length === 0 ? `暂无可用的${type === 'image' ? '图片' : '视频'}模型` : '请选择一个模型'}
        compact={compact}
        disabled={models.length === 0}
      />

      {/* 提示信息 */}

    </div>
  )
}
