'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils/cn'
import type { Tool } from '@/lib/api/types/tools'
import { ToolUseModal } from './ToolUseModal'

interface ToolCardProps {
  tool: Tool
}

export function ToolCard({ tool }: ToolCardProps) {
  const t = useTranslations('tools')
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div
        className={cn(
          'group relative bg-white dark:bg-stone-900 rounded-2xl overflow-hidden',
          'border border-stone-100 dark:border-stone-800',
          'shadow-canvas hover:shadow-lg transition-all duration-300 hover:-translate-y-1'
        )}
      >
        {/* Cover */}
        <div className="relative aspect-video bg-gradient-to-br from-aurora-pink/10 via-aurora-purple/10 to-aurora-blue/10 overflow-hidden">
          {tool.coverUrl ? (
            <img
              src={tool.coverUrl}
              alt={tool.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-12 h-12 text-aurora-purple/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}

          {/* Type badge */}
          <span className={cn(
            'absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full font-ui text-xs font-medium',
            tool.type === 'image'
              ? 'bg-blue-500/90 text-white'
              : 'bg-purple-500/90 text-white'
          )}>
            {t(`type.${tool.type}`)}
          </span>

          {/* Image count badge */}
          <span className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white font-ui text-xs">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            ×{tool.imageCount}
          </span>

          {/* Credits badge */}
          <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-white font-ui text-xs font-medium">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-5h2v5zm0-7h-2V7h2v2.5z" />
            </svg>
            {tool.creditsPerUse}
          </span>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-display text-base font-semibold text-stone-900 dark:text-stone-100 line-clamp-1 mb-1">
            {tool.title}
          </h3>
          {tool.description && (
            <p className="font-ui text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mb-3">
              {tool.description}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="font-ui text-xs text-stone-400 dark:text-stone-500 truncate max-w-[120px]">
              {tool.modelName}
            </span>
            <button
              onClick={() => setModalOpen(true)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-ui text-xs font-medium',
                'bg-gradient-to-r from-aurora-purple to-aurora-blue text-white',
                'hover:shadow-aurora transition-all duration-200 hover:scale-105 flex-shrink-0'
              )}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t('use')}
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ToolUseModal tool={tool} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
