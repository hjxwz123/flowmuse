/**
 * 收件箱页面内容
 * 展示异步任务完成/失败的通知消息
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Inbox, CheckCircle2, XCircle, Info, Trash2, ExternalLink } from 'lucide-react'

import { Button, Card, Loading } from '@/components/ui'
import { PageTransition } from '@/components/shared/PageTransition'
import { FadeIn } from '@/components/shared/FadeIn'
import { cn } from '@/lib/utils/cn'
import { inboxService } from '@/lib/api/services'
import type { InboxMessage, InboxTaskMeta } from '@/lib/api/types/inbox'
import { useAuth } from '@/lib/hooks/useAuth'
import { useInboxStore } from '@/lib/store'

type InboxFilter = 'all' | 'unread'

function toTaskMeta(meta: InboxMessage['meta']): InboxTaskMeta {
  if (!meta || typeof meta !== 'object') return {}
  return meta as InboxTaskMeta
}

function isGalleryType(value: unknown): value is 'image' | 'video' {
  return value === 'image' || value === 'video'
}

export function InboxContent() {
  const t = useTranslations('inbox')
  const locale = useLocale()
  const router = useRouter()
  const { isAuthenticated, isReady, requireAuth } = useAuth()
  const { setUnreadCount, latestEvent } = useInboxStore()

  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [selected, setSelected] = useState<InboxMessage | null>(null)
  const [filter, setFilter] = useState<InboxFilter>('unread')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const loadingRef = useRef(false)

  const pageSize = 20

  const formatDate = useCallback(
    (dateStr: string) => {
      try {
        return new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(dateStr))
      } catch {
        return dateStr
      }
    },
    [locale]
  )

  const refreshUnreadCount = useCallback(async () => {
    try {
      const { count } = await inboxService.getUnreadCount()
      setUnreadCount(count)
    } catch {
      // ignore
    }
  }, [setUnreadCount])

  const loadMessages = useCallback(
    async (pageNum: number, append = false) => {
      if (!isAuthenticated || loadingRef.current) return
      loadingRef.current = true

      try {
        if (append) setIsLoadingMore(true)
        else setIsLoading(true)

        const params = {
          page: pageNum,
          limit: pageSize,
          ...(filter === 'unread' ? { isRead: 'false' as const } : {}),
        }

        const result = await inboxService.getMessages(params)
        const next = result.data

        setMessages((prev) => (append ? [...prev, ...next] : next))
        setHasMore(result.pagination.hasMore)
        setPage(pageNum)
      } catch (error) {
        console.error('[Inbox] Failed to load messages:', error)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
        loadingRef.current = false
        refreshUnreadCount()
      }
    },
    [filter, isAuthenticated, refreshUnreadCount]
  )

  // 等待 hydration 完成后再检查认证和加载数据
  useEffect(() => {
    if (!isReady) return
    if (!requireAuth()) return
    loadMessages(1, false)
  }, [isReady, loadMessages, requireAuth])

  // 切换筛选条件时重置
  useEffect(() => {
    if (!isAuthenticated) return
    setSelected(null)
    loadMessages(1, false)
  }, [filter, isAuthenticated, loadMessages])

  useEffect(() => {
    if (!latestEvent) return

    if (latestEvent.type === 'message_created') {
      setMessages((prev) => {
        if (prev.some((item) => item.id === latestEvent.message.id)) return prev
        if (filter === 'unread' && latestEvent.message.isRead) return prev
        return [latestEvent.message, ...prev]
      })
      return
    }

    if (latestEvent.type === 'message_read') {
      setSelected((prev) => (prev?.id === latestEvent.message.id ? latestEvent.message : prev))
      setMessages((prev) =>
        filter === 'unread'
          ? prev.filter((item) => item.id !== latestEvent.message.id)
          : prev.map((item) => (item.id === latestEvent.message.id ? latestEvent.message : item))
      )
      return
    }

    if (latestEvent.type === 'messages_read_all') {
      setSelected((prev) =>
        prev && !prev.isRead ? { ...prev, isRead: true, readAt: latestEvent.readAt } : prev
      )
      if (filter === 'unread') {
        setMessages([])
        setHasMore(false)
      } else {
        setMessages((prev) =>
          prev.map((item) => ({
            ...item,
            isRead: true,
            readAt: item.readAt ?? latestEvent.readAt,
          }))
        )
      }
      return
    }

    if (latestEvent.type === 'message_deleted') {
      setMessages((prev) => prev.filter((item) => item.id !== latestEvent.messageId))
      setSelected((prev) => (prev?.id === latestEvent.messageId ? null : prev))
    }
  }, [filter, latestEvent])

  const handleLoadMore = () => {
    if (!hasMore || loadingRef.current) return
    loadMessages(page + 1, true)
  }

  const handleSelect = useCallback(
    async (msg: InboxMessage) => {
      setSelected(msg)
      if (!msg.isRead) {
        try {
          const updated = await inboxService.markRead(msg.id)
          setSelected(updated)
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          )
          refreshUnreadCount()
        } catch (error) {
          console.error('[Inbox] Failed to mark read:', error)
        }
      }
    },
    [refreshUnreadCount]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await inboxService.deleteMessage(id)
        setMessages((prev) => prev.filter((m) => m.id !== id))
        if (selected?.id === id) setSelected(null)
        refreshUnreadCount()
      } catch (error) {
        console.error('[Inbox] Failed to delete message:', error)
      }
    },
    [refreshUnreadCount, selected?.id]
  )

  const handleMarkAllRead = useCallback(async () => {
    try {
      await inboxService.markAllRead()
      setSelected(null)
      await loadMessages(1, false)
      await refreshUnreadCount()
    } catch (error) {
      console.error('[Inbox] Failed to mark all read:', error)
    }
  }, [loadMessages, refreshUnreadCount])

  const EmptyState = useMemo(() => {
    const text = filter === 'unread' ? t('empty.unread') : t('empty.all')
    return (
      <div className="text-center py-16 text-stone-400">
        <Inbox className="w-14 h-14 mx-auto mb-4 opacity-30" />
        <p className="font-ui">{text}</p>
      </div>
    )
  }, [filter, t])

  const MessageIcon = ({ msg }: { msg: InboxMessage }) => {
    const level = msg.level ?? msg.type
    if (level === 'success' || msg.type === 'task_completed') {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />
    }
    if (level === 'error' || msg.type === 'task_failed') {
      return <XCircle className="w-5 h-5 text-red-600" />
    }
    return <Info className="w-5 h-5 text-blue-600" />
  }

  const MessageItem = ({ msg }: { msg: InboxMessage }) => {
    const meta = toTaskMeta(msg.meta)
    const thumb = meta.thumbnailUrl ?? null
    return (
      <button
        type="button"
        onClick={() => handleSelect(msg)}
        className={cn(
          'w-full text-left p-4 rounded-xl border transition-all duration-200 hover:shadow-md',
          msg.isRead ? 'border-stone-200 bg-white' : 'border-blue-200 bg-blue-50/50'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">
            <MessageIcon msg={msg} />
          </div>

          {thumb ? (
            <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
              <Image
                src={thumb}
                alt={msg.title}
                fill
                className="object-cover"
              />
            </div>
          ) : null}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-stone-900 truncate">
                    {msg.title}
                  </h3>
                  {!msg.isRead && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                  )}
                </div>
                {msg.content ? (
                  <p className="mt-1 text-sm text-stone-600 line-clamp-2">
                    {msg.content}
                  </p>
                ) : null}
              </div>
              <span className="text-xs text-stone-400 flex-shrink-0">
                {formatDate(msg.createdAt)}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-3 text-xs text-stone-400">
              {meta.taskNo ? <span>#{meta.taskNo}</span> : null}
              {meta.provider ? <span>{meta.provider}</span> : null}
            </div>
          </div>
        </div>
      </button>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
        <Card className="text-center max-w-md">
          <h2 className="font-display text-2xl text-stone-900 mb-4">
            {t('title')}
          </h2>
          <p className="font-ui text-stone-600 mb-6">{t('login.desc')}</p>
          <Button onClick={() => router.push(`/${locale}/auth/login`)}>
            {t('login.cta')}
          </Button>
        </Card>
      </div>
    )
  }

  const selectedMeta = selected ? toTaskMeta(selected.meta) : null
  const selectedContentIsHtml = Boolean(
    selected?.content &&
      selectedMeta?.contentFormat === 'html'
  )
  const selectedResultHref = selected
    ? (
      (isGalleryType(selected.relatedType) && selected.relatedId
        ? `/${locale}/gallery/${selected.relatedType}/${selected.relatedId}`
        : null)
      ?? (isGalleryType(selectedMeta?.taskType) && selectedMeta?.taskId
        ? `/${locale}/gallery/${selectedMeta.taskType}/${selectedMeta.taskId}`
        : null)
      ?? (selected.relatedType === 'research'
        ? `/${locale}/tasks`
        : null)
      ?? (selectedMeta?.taskType === 'research'
        ? `/${locale}/tasks`
        : null)
      ?? selectedMeta?.resultUrl
      ?? null
    )
    : null
  const selectedResultExternal = Boolean(selectedResultHref && /^https?:\/\//i.test(selectedResultHref))

  return (
    <PageTransition className="min-h-screen bg-canvas py-12 px-4">
      <div className="mx-auto max-w-[82rem]">
        <FadeIn variant="slide">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-4xl font-bold text-stone-900">
                {t('title')}
              </h1>
              <p className="mt-2 text-stone-600 font-ui">{t('subtitle')}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-full bg-white/80 backdrop-blur-sm border border-stone-200 p-1 shadow-canvas">
                {(['unread', 'all'] as InboxFilter[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      'px-5 py-2 rounded-full font-ui text-sm font-medium transition-all duration-300',
                      filter === key
                        ? 'bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue text-white shadow-aurora'
                        : 'text-stone-600 hover:text-stone-900'
                    )}
                  >
                    {t(`tabs.${key}`)}
                  </button>
                ))}
              </div>
              <Button variant="secondary" onClick={handleMarkAllRead}>
                {t('actions.markAllRead')}
              </Button>
            </div>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="py-16">
            <Loading size="lg" />
          </div>
        ) : selected ? (
          <FadeIn variant="scale">
            <div className="mb-6">
              <button
                onClick={() => setSelected(null)}
                className="text-sm text-aurora-purple hover:text-aurora-purple/80 flex items-center gap-2"
              >
                <span aria-hidden="true">←</span>
                {t('actions.back')}
              </button>
            </div>

            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <MessageIcon msg={selected} />
                    <h2 className="text-xl font-semibold text-stone-900 truncate">
                      {selected.title}
                    </h2>
                  </div>
                  <div className="mt-2 text-sm text-stone-500">
                    {formatDate(selected.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="secondary"
                    onClick={() => handleDelete(selected.id)}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('actions.delete')}
                  </Button>
                </div>
              </div>

              {selectedMeta?.thumbnailUrl ? (
                <div className="mt-6 relative w-full max-w-xl aspect-[4/3] rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                  <Image
                    src={selectedMeta.thumbnailUrl}
                    alt={selected.title}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : null}

              {selected.content ? (
                <div className="mt-6">
                  <h3 className="font-medium text-stone-800 mb-2">
                    {t('fields.prompt')}
                  </h3>
                  {selectedContentIsHtml ? (
                    <div
                      className="prose prose-sm max-w-none text-stone-700 bg-white/60 border border-stone-200 rounded-xl p-4"
                      dangerouslySetInnerHTML={{ __html: selected.content }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap text-stone-700 bg-white/60 border border-stone-200 rounded-xl p-4">
                      {selected.content}
                    </div>
                  )}
                </div>
              ) : null}

              {selectedMeta?.errorMessage ? (
                <div className="mt-6">
                  <h3 className="font-medium text-stone-800 mb-2">
                    {t('fields.error')}
                  </h3>
                  <div className="whitespace-pre-wrap text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">
                    {selectedMeta.errorMessage}
                  </div>
                </div>
              ) : null}

              {selectedResultHref ? (
                <div className="mt-6 flex items-center gap-3">
                  <Link
                    href={selectedResultHref}
                    target={selectedResultExternal ? '_blank' : undefined}
                    className="inline-flex"
                  >
                    <Button className="gap-2">
                      <ExternalLink className="w-4 h-4" />
                      {t('actions.openResult')}
                    </Button>
                  </Link>
                </div>
              ) : null}
            </Card>
          </FadeIn>
        ) : messages.length === 0 ? (
          EmptyState
        ) : (
          <>
            <FadeIn variant="scale" delay={0.05}>
              <div className="space-y-3">
                {messages.map((msg) => (
                  <MessageItem key={msg.id} msg={msg} />
                ))}
              </div>
            </FadeIn>

            {hasMore ? (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="secondary"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="min-w-[160px]"
                >
                  {isLoadingMore ? t('actions.loading') : t('actions.loadMore')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </PageTransition>
  )
}
