/**
 * 模板卡片组件
 * 展示单个系统模板或用户预设
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils/cn'
import { AnimatedCard } from '@/components/shared/AnimatedCard'
import type { Template } from '@/lib/api/types/templates'

interface TemplateCardProps {
  template: Template
  onDelete?: (id: string) => void
  isPreset?: boolean
}

export function TemplateCard({ template, onDelete, isPreset }: TemplateCardProps) {
  const t = useTranslations('templates')
  const locale = useLocale()
  const router = useRouter()
  const [imageError, setImageError] = useState(false)

  const handleUse = () => {
    router.push(`/${locale}/create?templateId=${template.id}`)
  }

  const shouldShowImage = template.coverUrl && !imageError

  return (
    <AnimatedCard>
      <div className="overflow-hidden bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 hover:border-aurora-purple dark:hover:border-aurora-purple transition-all duration-300 hover:shadow-aurora group">
        {/* 封面图容器 */}
        <div className="relative w-full pt-[66%] bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden">
          {shouldShowImage ? (
            <img
              src={template.coverUrl!}
              alt={template.title}
              className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-aurora-pink/10 via-aurora-purple/10 to-aurora-blue/10">
              <svg
                className="w-16 h-16 text-stone-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}

          {/* 类型徽章 */}
          <div className="absolute top-2 right-2 z-10">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm shadow-sm',
                template.type === 'image'
                  ? 'bg-blue-100/90 text-blue-800'
                  : 'bg-purple-100/90 text-purple-800'
              )}
            >
              {t(`filters.${template.type}`)}
            </span>
          </div>

          {/* 分类徽章 */}
          {template.category && (
            <div className="absolute top-2 left-2 z-10">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/90 backdrop-blur-sm text-stone-700 shadow-sm">
                {template.category}
              </span>
            </div>
          )}
        </div>

        {/* 内容区 */}
        <div className="p-3">
          <h3 className="font-display text-base font-semibold text-stone-900 line-clamp-1 group-hover:text-aurora-purple transition-colors mb-1">
            {template.title}
          </h3>

          {template.description && (
            <p className="font-ui text-xs text-stone-500 line-clamp-2 mb-3">
              {template.description}
            </p>
          )}

          <div className={cn('flex gap-2', !template.description && 'mt-2')}>
            <button
              onClick={handleUse}
              className={cn(
                'flex-1 py-1.5 rounded-lg font-ui text-xs font-medium transition-all duration-300',
                'bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue text-white',
                'hover:shadow-aurora hover:scale-[1.02]'
              )}
            >
              {t('card.use')}
            </button>

            {isPreset && onDelete && (
              <button
                onClick={() => onDelete(template.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-ui text-xs font-medium transition-all duration-300',
                  'bg-red-50 text-red-600 hover:bg-red-100'
                )}
              >
                {t('presets.delete')}
              </button>
            )}
          </div>
        </div>
      </div>
    </AnimatedCard>
  )
}
