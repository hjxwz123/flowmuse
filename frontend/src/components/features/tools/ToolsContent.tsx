'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { MasonryGrid, MasonryItem } from '@/components/ui/MasonryGrid'
import { SkeletonCard } from '@/components/ui'
import { PageHeroHeader } from '@/components/shared/PageHeroHeader'
import { PageTransition } from '@/components/shared/PageTransition'
import { FadeIn } from '@/components/shared/FadeIn'
import { ToolCard } from './ToolCard'
import { toolService } from '@/lib/api/services/tools'
import type { Tool } from '@/lib/api/types/tools'

type TypeFilter = 'all' | 'image' | 'video'

export function ToolsContent() {
  const t = useTranslations('tools')

  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    toolService
      .getActiveTools()
      .then(setTools)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    return ['all', ...new Set(tools.map((t) => t.category).filter(Boolean) as string[])]
  }, [tools])

  const filtered = useMemo(() => {
    return tools.filter((tool) => {
      if (typeFilter !== 'all' && tool.type !== typeFilter) return false
      if (categoryFilter !== 'all' && tool.category !== categoryFilter) return false
      return true
    })
  }, [tools, typeFilter, categoryFilter])

  const chipBase =
    'flex-shrink-0 px-3.5 py-1.5 rounded-full font-ui text-xs font-medium transition-all duration-200 whitespace-nowrap'
  const chipActive = 'bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900'
  const chipInactive =
    'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
  const chipPurpleActive = 'bg-aurora-purple text-white'

  return (
    <PageTransition className="min-h-screen bg-canvas px-4 py-6 dark:bg-canvas-dark md:px-6 md:py-8">
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6">
        <FadeIn variant="slide">
          <PageHeroHeader
            badge={
              <>
                <Wand2 className="h-3.5 w-3.5" />
                {t('hero.badge')}
              </>
            }
            title={t('title')}
            description={t('description')}
            meta={
              <>
                <span className="inline-flex rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">
                  {t('stats.total', { count: tools.length })}
                </span>
                <span className="inline-flex rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">
                  {t('stats.visible', { count: filtered.length })}
                </span>
              </>
            }
          />
        </FadeIn>

        <FadeIn variant="scale" delay={0.08}>
          <section className="overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/85 p-4 shadow-sm backdrop-blur-sm dark:border-stone-800 dark:bg-stone-900/80">
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex w-max items-center gap-1.5 pb-0.5">
                {(['all', 'image', 'video'] as TypeFilter[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={cn(chipBase, typeFilter === type ? chipActive : chipInactive)}
                  >
                    {t(`filters.${type}`)}
                  </button>
                ))}
                {categories.length > 1 && (
                  <>
                    <span className="mx-1 h-4 w-px flex-shrink-0 bg-stone-300 dark:bg-stone-600" />
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={cn(
                          chipBase,
                          categoryFilter === cat ? chipPurpleActive : chipInactive
                        )}
                      >
                        {cat === 'all' ? t('filters.all') : cat}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </section>
        </FadeIn>

        {/* Content */}
        {loading ? (
          <FadeIn variant="fade">
            <MasonryGrid columns={3}>
              {Array.from({ length: 6 }).map((_, i) => (
                <MasonryItem key={i}>
                  <SkeletonCard />
                </MasonryItem>
              ))}
            </MasonryGrid>
          </FadeIn>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
              <svg className="w-10 h-10 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="font-display text-2xl text-stone-900 dark:text-stone-100 mb-2">
              {t('empty.title')}
            </h2>
            <p className="font-ui text-stone-500 dark:text-stone-400">{t('empty.description')}</p>
          </div>
        ) : (
          <FadeIn variant="fade" delay={0.1}>
            <MasonryGrid columns={3}>
              {filtered.map((tool, i) => (
                <MasonryItem key={tool.id}>
                  <FadeIn variant="scale" delay={i * 0.04}>
                    <ToolCard tool={tool} />
                  </FadeIn>
                </MasonryItem>
              ))}
            </MasonryGrid>
          </FadeIn>
        )}
      </div>
    </PageTransition>
  )
}
