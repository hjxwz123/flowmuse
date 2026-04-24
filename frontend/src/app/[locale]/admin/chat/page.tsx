'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bot, Pin, RefreshCcw, Search, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'

import { FadeIn } from '@/components/shared/FadeIn'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { Button } from '@/components/ui/Button'
import { adminChatService } from '@/lib/api/services/admin/chat'
import type {
  AdminChatConversationDetailResponse,
  AdminChatConversationItem,
} from '@/lib/api/types/admin/chat'
import { cn } from '@/lib/utils/cn'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN')
}

export default function AdminChatPage() {
  const t = useTranslations('admin.chat')

  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')

  const [page, setPage] = useState(1)
  const pageSize = 20
  const [total, setTotal] = useState(0)

  const [items, setItems] = useState<AdminChatConversationItem[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminChatConversationDetailResponse | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetchList = useCallback(async () => {
    setLoadingList(true)
    try {
      const response = await adminChatService.listConversations({
        page,
        pageSize,
        q: query || undefined,
      })
      setItems(response.items)
      setTotal(response.total)

      if (response.items.length === 0) {
        setActiveConversationId(null)
        setDetail(null)
        return
      }

      setActiveConversationId((prev) => {
        if (!prev || !response.items.some((item) => item.id === prev)) {
          return response.items[0].id
        }
        return prev
      })
    } finally {
      setLoadingList(false)
    }
  }, [page, pageSize, query])

  const fetchDetail = useCallback(async (conversationId: string) => {
    setLoadingDetail(true)
    try {
      const response = await adminChatService.getConversationMessages(conversationId)
      setDetail(response)
    } catch (error) {
      console.error('Failed to fetch conversation detail:', error)
      setDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null
    return items.find((item) => item.id === activeConversationId) ?? null
  }, [activeConversationId, items])

  const handleDeleteConversation = useCallback(async () => {
    if (!activeConversation) return

    const confirmed = window.confirm(
      t('deleteConfirm', { title: activeConversation.title || activeConversation.id })
    )
    if (!confirmed) return

    try {
      setDeletingConversationId(activeConversation.id)
      await adminChatService.deleteConversation(activeConversation.id)
      toast.success(t('deleteSuccess'))

      setDetail(null)
      if (activeConversationId === activeConversation.id) {
        setActiveConversationId(null)
      }

      if (items.length === 1 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1))
      } else {
        await fetchList()
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      toast.error(t('deleteFailed'))
    } finally {
      setDeletingConversationId(null)
    }
  }, [activeConversation, activeConversationId, fetchList, items.length, page, t])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  useEffect(() => {
    if (!activeConversationId) return
    void fetchDetail(activeConversationId)
  }, [activeConversationId, fetchDetail])

  return (
    <AdminPageShell title={t('title')} description={t('description')}>
      <FadeIn variant="fade" delay={0.05}>
          <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
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
                onClick={() => void fetchList()}
                title={t('refresh')}
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
      </FadeIn>

      <FadeIn variant="fade" delay={0.1}>
          <div className="grid min-h-[68vh] gap-4 md:grid-cols-[360px_1fr]">
            <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-200 px-4 py-3">
                <p className="text-sm font-medium text-stone-800">{t('conversationList')}</p>
                <p className="mt-1 text-xs text-stone-500">{t('total', { total })}</p>
              </div>

              <div className="max-h-[68vh] space-y-2 overflow-y-auto p-3">
                {loadingList ? (
                  <p className="px-2 py-2 text-sm text-stone-500">{t('conversationLoading')}</p>
                ) : items.length === 0 ? (
                  <p className="px-2 py-2 text-sm text-stone-500">{t('conversationEmpty')}</p>
                ) : (
                  items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveConversationId(item.id)}
                      className={cn(
                        'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                        item.id === activeConversationId
                          ? 'border-aurora-purple/40 bg-aurora-purple/5'
                          : 'border-transparent hover:border-stone-200 hover:bg-stone-50'
                      )}
                    >
                      <p className="line-clamp-1 flex items-center gap-1 text-sm font-medium text-stone-800">
                        {item.isPinned ? <Pin className="h-3.5 w-3.5 text-amber-500" /> : null}
                        <span>{item.title}</span>
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs text-stone-500">{item.lastMessagePreview || '...'}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-stone-400">
                        <span>{item.user.username || item.user.email}</span>
                        <span>{formatDate(item.lastMessageAt)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-stone-400">
                        <span>{item.model.name}</span>
                        <span>
                          {t('messageCount')}: {item.messageCount}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between border-t border-stone-200 px-3 py-2 text-xs text-stone-500">
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
            </section>

            <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-200 px-5 py-4">
                {activeConversation ? (
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-stone-900">{activeConversation.title}</p>
                      <p className="text-xs text-stone-500">
                        {t('user')}: {activeConversation.user.username || activeConversation.user.email} | {t('model')}:
                        {' '}
                        {activeConversation.model.name}
                      </p>
                      <p className="text-xs text-stone-400">
                        {t('lastMessage')}: {formatDate(activeConversation.lastMessageAt)}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleDeleteConversation()}
                      disabled={deletingConversationId === activeConversation.id}
                      className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{deletingConversationId === activeConversation.id ? t('deleting') : t('delete')}</span>
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-stone-500">{t('messageEmpty')}</p>
                )}
              </div>

              <div className="max-h-[68vh] space-y-4 overflow-y-auto px-5 py-4">
                {loadingDetail ? (
                  <p className="text-sm text-stone-500">{t('messageLoading')}</p>
                ) : !detail || detail.messages.length === 0 ? (
                  <p className="text-sm text-stone-500">{t('messageEmpty')}</p>
                ) : (
                  detail.messages.map((message) => {
                    const isUser = message.role === 'user'
                    return (
                      <div key={message.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                        <div className={cn('max-w-[88%]', isUser ? 'items-end' : 'items-start')}>
                          <div className={cn('mb-1 flex items-center gap-1 text-xs text-stone-500', isUser ? 'justify-end' : 'justify-start')}>
                            {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                            <span>{isUser ? 'User' : 'Assistant'}</span>
                            <span>{formatDate(message.createdAt)}</span>
                          </div>

                          <div
                            className={cn(
                              'rounded-2xl px-4 py-3 text-sm leading-6',
                              isUser
                                ? 'bg-gradient-to-r from-aurora-purple to-aurora-blue text-white'
                                : 'border border-stone-200 bg-stone-50 text-stone-800'
                            )}
                          >
                            {message.content ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : null}

                            {message.images.length > 0 ? (
                              <div className={cn('mt-3 grid gap-2', message.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                                {message.images.map((image, index) => (
                                  <img
                                    key={`${message.id}-${index}`}
                                    src={image}
                                    alt={`chat-image-${index + 1}`}
                                    className="max-h-56 w-full rounded-xl border border-white/40 object-cover"
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          </div>
      </FadeIn>
    </AdminPageShell>
  )
}
