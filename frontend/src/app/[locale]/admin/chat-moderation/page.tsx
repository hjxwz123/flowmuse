'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { RefreshCcw, Search } from 'lucide-react'

import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { AdminGalleryModerationPanel } from '@/components/admin/moderation/AdminGalleryModerationPanel'
import { FadeIn } from '@/components/shared/FadeIn'
import { Button } from '@/components/ui/Button'
import { adminChatModerationService } from '@/lib/api/services/admin/chat-moderation'
import type {
  AdminChatModerationLogItem,
  AdminModerationLogSource,
} from '@/lib/api/types/admin/chat-moderation'
import { cn } from '@/lib/utils/cn'

type ModerationTab = 'input' | 'content'
type ModerationSourceFilter = 'all' | AdminModerationLogSource

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN')
}

export default function AdminChatModerationPage() {
  const t = useTranslations('admin.chatModeration')
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const searchTab = searchParams.get('tab')
  const derivedTab: ModerationTab = searchTab === 'content' ? 'content' : 'input'

  const [activeTab, setActiveTab] = useState<ModerationTab>(derivedTab)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [total, setTotal] = useState(0)
  const [source, setSource] = useState<ModerationSourceFilter>('all')
  const [items, setItems] = useState<AdminChatModerationLogItem[]>([])

  useEffect(() => {
    setActiveTab(derivedTab)
  }, [derivedTab])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total])

  const sourceOptions = useMemo(
    () =>
      [
        { value: 'all', label: t('sources.all') },
        { value: 'chat', label: t('sources.chat') },
        { value: 'image_generate', label: t('sources.imageGenerate') },
        { value: 'prompt_optimize', label: t('sources.promptOptimize') },
      ] satisfies Array<{ value: ModerationSourceFilter; label: string }>,
    [t]
  )

  const setTab = useCallback(
    (nextTab: ModerationTab) => {
      setActiveTab(nextTab)

      const params = new URLSearchParams(searchParams.toString())
      if (nextTab === 'content') {
        params.set('tab', 'content')
      } else {
        params.delete('tab')
      }

      const nextQuery = params.toString()
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const load = useCallback(async () => {
    if (activeTab !== 'input') return

    setLoading(true)
    try {
      const response = await adminChatModerationService.listLogs({
        page,
        limit: pageSize,
        q: query || undefined,
        source,
      })
      setItems(response.items)
      setTotal(response.total)
    } finally {
      setLoading(false)
    }
  }, [activeTab, page, pageSize, query, source])

  useEffect(() => {
    void load()
  }, [load])

  const renderSceneLabel = useCallback(
    (scene: string) => {
      const sceneMap: Record<string, string> = {
        chat_message: t('scenes.chat_message'),
        image_generate_prompt: t('scenes.image_generate_prompt'),
        image_generate_negative_prompt: t('scenes.image_generate_negative_prompt'),
        midjourney_modal_prompt: t('scenes.midjourney_modal_prompt'),
        midjourney_edits_prompt: t('scenes.midjourney_edits_prompt'),
        prompt_optimize_prompt: t('scenes.prompt_optimize_prompt'),
      }

      return sceneMap[scene] ?? scene
    },
    [t]
  )

  const renderSourceLabel = useCallback(
    (value: AdminModerationLogSource) => {
      const sourceMap: Record<AdminModerationLogSource, string> = {
        chat: t('sources.chat'),
        image_generate: t('sources.imageGenerate'),
        prompt_optimize: t('sources.promptOptimize'),
      }

      return sourceMap[value]
    },
    [t]
  )

  return (
    <AdminPageShell title={t('title')} description={t('description')}>
      <FadeIn variant="fade" delay={0.05}>
        <div className="rounded-2xl border border-stone-200 bg-white p-2 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTab('input')}
              className={cn(
                'rounded-xl px-4 py-3 text-left transition-colors',
                activeTab === 'input'
                  ? 'bg-aurora-purple text-white shadow-sm'
                  : 'text-stone-700 hover:bg-stone-100'
              )}
            >
              <p className="text-sm font-semibold">{t('tabs.input')}</p>
              <p className={cn('mt-1 text-xs', activeTab === 'input' ? 'text-white/80' : 'text-stone-500')}>
                {t('tabs.inputDesc')}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setTab('content')}
              className={cn(
                'rounded-xl px-4 py-3 text-left transition-colors',
                activeTab === 'content'
                  ? 'bg-aurora-purple text-white shadow-sm'
                  : 'text-stone-700 hover:bg-stone-100'
              )}
            >
              <p className="text-sm font-semibold">{t('tabs.content')}</p>
              <p className={cn('mt-1 text-xs', activeTab === 'content' ? 'text-white/80' : 'text-stone-500')}>
                {t('tabs.contentDesc')}
              </p>
            </button>
          </div>
        </div>
      </FadeIn>

      {activeTab === 'content' ? (
        <AdminGalleryModerationPanel />
      ) : (
        <>
          <FadeIn variant="fade" delay={0.08}>
            <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      setPage(1)
                      setQuery(search.trim())
                    }}
                    placeholder={t('searchPlaceholder')}
                    className={cn(
                      'w-full rounded-xl border border-stone-200 px-9 py-2.5 text-sm text-stone-900',
                      'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
                    )}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="rounded-xl"
                    onClick={() => {
                      setPage(1)
                      setQuery(search.trim())
                    }}
                  >
                    {t('search')}
                  </Button>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100"
                    onClick={() => void load()}
                    title={t('refresh')}
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {sourceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setPage(1)
                      setSource(option.value)
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-colors',
                      source === option.value
                        ? 'border-aurora-purple bg-aurora-purple text-white'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-100'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn variant="fade" delay={0.12}>
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-200 px-5 py-4">
                <p className="text-sm font-medium text-stone-800">{t('total', { total })}</p>
              </div>

              {loading ? (
                <div className="px-5 py-16 text-center text-sm text-stone-500">{t('loading')}</div>
              ) : items.length === 0 ? (
                <div className="px-5 py-16 text-center text-sm text-stone-500">{t('empty')}</div>
              ) : (
                <div className="divide-y divide-stone-200">
                  {items.map((item) => (
                    <div key={`${item.source}-${item.id}`} className="space-y-3 px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                            item.source === 'chat'
                              ? 'bg-blue-100 text-blue-700'
                              : item.source === 'image_generate'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-800'
                          )}
                        >
                          {renderSourceLabel(item.source)}
                        </span>
                        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600">
                          {renderSceneLabel(item.scene)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-500">
                        <span>
                          {t('fields.user')}: {item.user.username || item.user.email}
                        </span>
                        {item.conversation ? (
                          <span>
                            {t('fields.conversation')}: {item.conversation.title}
                          </span>
                        ) : null}
                        {item.task?.taskNo || item.task?.id ? (
                          <span>
                            {t('fields.task')}: {item.task?.taskNo || item.task?.id}
                          </span>
                        ) : null}
                        {item.model || item.providerModel ? (
                          <span>
                            {t('fields.model')}: {item.providerModel || item.model?.name}
                          </span>
                        ) : null}
                        <span>
                          {t('fields.time')}: {formatDate(item.createdAt)}
                        </span>
                      </div>

                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                        <p className="mb-1 text-xs font-medium text-stone-500">{t('fields.content')}</p>
                        <p className="whitespace-pre-wrap break-words text-sm text-stone-900">{item.content}</p>
                      </div>

                      {(item.providerResponse || item.reason) && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <p className="mb-1 text-xs font-medium text-amber-700">{t('fields.response')}</p>
                          <p className="whitespace-pre-wrap break-words text-sm text-amber-900">
                            {item.reason || item.providerResponse}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3 text-xs text-stone-500">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-stone-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('paginationPrev')}
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md border border-stone-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('paginationNext')}
                </button>
              </div>
            </div>
          </FadeIn>
        </>
      )}
    </AdminPageShell>
  )
}
