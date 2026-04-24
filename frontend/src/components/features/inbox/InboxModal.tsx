/**
 * 收件箱模态框
 * 入口：Header 右侧按钮
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronRight,
  ExternalLink,
  Inbox,
  Info,
  Mail,
  Trash2,
  XCircle,
} from 'lucide-react'

import { Modal } from '@/components/ui/Modal'
import { Loading } from '@/components/ui/Loading'
import { inboxService } from '@/lib/api/services'
import type { InboxMessage, InboxTaskMeta } from '@/lib/api/types/inbox'
import { useAuthStore, useInboxStore } from '@/lib/store'
import { cn } from '@/lib/utils/cn'

import styles from './InboxModal.module.css'

type InboxTab = 'unread' | 'all'
type MessageTone = 'success' | 'error' | 'info'

function toTaskMeta(meta: InboxMessage['meta']): InboxTaskMeta {
  if (!meta || typeof meta !== 'object') return {}
  return meta as InboxTaskMeta
}

function isGalleryType(value: unknown): value is 'image' | 'video' {
  return value === 'image' || value === 'video'
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getMessageTone(message: InboxMessage): MessageTone {
  const level = message.level ?? message.type

  if (level === 'success' || message.type === 'task_completed') return 'success'
  if (level === 'error' || message.type === 'task_failed') return 'error'
  return 'info'
}

function getMessagePreview(message: InboxMessage) {
  const meta = toTaskMeta(message.meta)
  const candidates = [
    message.content,
    meta.prompt,
    meta.comment,
    meta.errorMessage,
  ]

  const raw = candidates.find((value) => typeof value === 'string' && value.trim().length > 0) || ''
  if (!raw) return ''
  return stripHtml(raw).replace(/\s+/g, ' ').trim()
}

export function InboxModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const t = useTranslations('inbox')
  const locale = useLocale()
  const isZh = locale.toLowerCase().startsWith('zh')
  const { isAuthenticated, _hasHydrated } = useAuthStore()
  const { unreadCount, setUnreadCount, latestEvent } = useInboxStore()

  const [activeTab, setActiveTab] = useState<InboxTab>('unread')
  const [selected, setSelected] = useState<InboxMessage | null>(null)

  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const loadingRef = useRef(false)

  const pageSize = 20
  const unreadBadge = unreadCount > 99 ? '99+' : `${unreadCount}`

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
    if (!_hasHydrated || !isAuthenticated) return
    try {
      const { count } = await inboxService.getUnreadCount()
      setUnreadCount(count)
    } catch {
      // ignore
    }
  }, [_hasHydrated, isAuthenticated, setUnreadCount])

  const loadMessages = useCallback(
    async (pageNum: number, append = false) => {
      if (!_hasHydrated || !isAuthenticated || loadingRef.current) return
      loadingRef.current = true

      try {
        if (append) setIsLoadingMore(true)
        else setIsLoading(true)

        const params = {
          page: pageNum,
          limit: pageSize,
          ...(activeTab === 'unread' ? { isRead: 'false' as const } : {}),
        }
        const result = await inboxService.getMessages(params)
        setMessages((prev) => (append ? [...prev, ...result.data] : result.data))
        setHasMore(result.pagination.hasMore)
        setPage(pageNum)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
        loadingRef.current = false
      }
    },
    [_hasHydrated, isAuthenticated, activeTab]
  )

  // 每次打开时加载一次（默认未读）
  useEffect(() => {
    if (!isOpen) return
    setSelected(null)
    setActiveTab('unread')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (!_hasHydrated || !isAuthenticated) return
    loadMessages(1, false)
    refreshUnreadCount()
  }, [isOpen, _hasHydrated, isAuthenticated, activeTab, loadMessages, refreshUnreadCount])

  useEffect(() => {
    if (!isOpen || !latestEvent) return

    if (latestEvent.type === 'message_created') {
      setMessages((prev) => {
        if (prev.some((item) => item.id === latestEvent.message.id)) return prev
        if (activeTab === 'unread' && latestEvent.message.isRead) return prev
        return [latestEvent.message, ...prev]
      })
      return
    }

    if (latestEvent.type === 'message_read') {
      setSelected((prev) => (prev?.id === latestEvent.message.id ? latestEvent.message : prev))
      setMessages((prev) =>
        activeTab === 'unread'
          ? prev.filter((item) => item.id !== latestEvent.message.id)
          : prev.map((item) => (item.id === latestEvent.message.id ? latestEvent.message : item))
      )
      return
    }

    if (latestEvent.type === 'messages_read_all') {
      setSelected((prev) =>
        prev && !prev.isRead ? { ...prev, isRead: true, readAt: latestEvent.readAt } : prev
      )
      if (activeTab === 'unread') {
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
  }, [activeTab, isOpen, latestEvent])

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
          setMessages((prev) => {
            if (activeTab === 'unread') {
              // 未读列表中，读完后从列表移除
              return prev.filter((m) => m.id !== updated.id)
            }
            return prev.map((m) => (m.id === updated.id ? updated : m))
          })
          refreshUnreadCount()
        } catch {
          // ignore
        }
      }
    },
    [activeTab, refreshUnreadCount]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await inboxService.deleteMessage(id)
        setMessages((prev) => prev.filter((m) => m.id !== id))
        if (selected?.id === id) setSelected(null)
        refreshUnreadCount()
      } catch {
        // ignore
      }
    },
    [refreshUnreadCount, selected?.id]
  )

  const handleMarkAllRead = useCallback(async () => {
    if (!_hasHydrated || !isAuthenticated) return
    try {
      await inboxService.markAllRead()
      setSelected(null)
      setUnreadCount(0)
      if (activeTab === 'unread') {
        setMessages([])
        setHasMore(false)
        setPage(1)
      } else {
        loadMessages(1, false)
      }
    } catch {
      // ignore
    }
  }, [_hasHydrated, isAuthenticated, activeTab, loadMessages, setUnreadCount])

  const EmptyState = useMemo(() => {
    const text = activeTab === 'unread' ? t('empty.unread') : t('empty.all')
    return (
      <div className={styles.emptyState}>
        <Inbox className={styles.emptyStateIcon} />
        <p>{text}</p>
      </div>
    )
  }, [activeTab, t])

  const LoginState = useMemo(() => {
    return (
      <div className={styles.loginState}>
        <Inbox className={styles.emptyStateIcon} />
        <p>{t('login.desc')}</p>
      </div>
    )
  }, [t])

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
  const selectedThumb = selectedMeta?.thumbnailUrl ?? null

  const renderStatusIcon = (msg: InboxMessage) => {
    const tone = getMessageTone(msg)
    const icon =
      tone === 'success'
        ? <Check />
        : tone === 'error'
          ? <XCircle />
          : <Info />

    return (
      <span
        className={cn(
          styles.statusIcon,
          tone === 'error' && styles.statusIconError,
          tone === 'info' && styles.statusIconInfo,
          msg.isRead && styles.statusIconRead
        )}
      >
        {icon}
      </span>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      ariaLabel={t('title')}
      className="h-[85vh] max-h-[800px] max-w-[960px]"
      bodyClassName={styles.bodyShell}
      headerContent={
        <div className={styles.headerTitle}>
          <Mail />
          <span>{t('title')}</span>
        </div>
      }
    >
      <div className={styles.inboxTheme}>
      {!isAuthenticated ? (
        LoginState
      ) : selected ? (
        <div className={styles.detailView}>
          <div className={styles.detailToolbar}>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className={styles.backButton}
            >
              <ArrowLeft className="h-4 w-4" />
              {t('actions.back')}
            </button>

            <button
              type="button"
              onClick={() => handleDelete(selected.id)}
              className={styles.detailDeleteButton}
            >
              <Trash2 className="h-4 w-4" />
              {t('actions.delete')}
            </button>
          </div>

          <div className={styles.detailCard}>
            <div className={styles.detailHeader}>
              <div className="min-w-0">
                <div className={styles.detailTitleRow}>
                  {renderStatusIcon(selected)}
                  <h3 className={styles.detailTitle}>{selected.title}</h3>
                </div>
                <div className={styles.detailDate}>{formatDate(selected.createdAt)}</div>
              </div>
            </div>

            {selectedThumb ? (
              <div className={styles.detailImage}>
                <Image
                  src={selectedThumb}
                  alt={selected.title}
                  fill
                  className={styles.detailImageMedia}
                />
              </div>
            ) : null}

            {selected.content ? (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>
                  {selected.type === 'moderation'
                    ? t('fields.message')
                    : t('fields.prompt')}
                </div>
                {selectedContentIsHtml ? (
                  <div
                    className={styles.richContent}
                    dangerouslySetInnerHTML={{ __html: selected.content }}
                  />
                ) : (
                  <div className={styles.detailSectionBody}>
                    {selected.content}
                  </div>
                )}
              </div>
            ) : null}

            {selected.type === 'moderation' && selectedMeta?.prompt ? (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>
                  {t('fields.workContent')}
                </div>
                <div className={styles.detailSectionBody}>
                  {selectedMeta.prompt}
                </div>
              </div>
            ) : null}

            {selected.type === 'task_failed' ? (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>
                  {t('fields.error')}
                </div>
                <div className={styles.detailSectionBodyDanger}>
                  {selectedMeta?.errorMessage || selected.content || (
                    isZh
                      ? '任务失败，请重试或者联系管理员'
                      : 'Task failed. Please try again or contact support.'
                  )}
                </div>
              </div>
            ) : selectedMeta?.errorMessage ? (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>
                  {t('fields.error')}
                </div>
                <div className={styles.detailSectionBodyDanger}>
                  {selectedMeta.errorMessage}
                </div>
              </div>
            ) : null}

            <div className={styles.detailActions}>
              {selected.type === 'moderation' &&
              selectedMeta?.action !== 'delete' &&
              isGalleryType(selected.relatedType) &&
              selected.relatedId ? (
                <Link
                  href={`/${locale}/gallery/${selected.relatedType}/${selected.relatedId}`}
                  className={styles.detailActionButtonSecondary}
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('actions.openWork')}
                </Link>
              ) : null}

              {selectedResultHref ? (
                <Link
                  href={selectedResultHref}
                  target={selectedResultExternal ? '_blank' : undefined}
                  className={styles.detailActionButton}
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('actions.openResult')}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.segmentedControl} data-active={activeTab}>
              <div className={styles.tabBg} />
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={cn(styles.tabButton, activeTab === 'unread' && styles.tabButtonActive)}
              >
                <span>{t('tabs.unread')}</span>
                <span className={styles.badge}>{unreadBadge}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(styles.tabButton, activeTab === 'all' && styles.tabButtonActive)}
              >
                <span>{t('tabs.all')}</span>
              </button>
            </div>

            <div className={styles.toolbarActions}>
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className={styles.markReadButton}
              >
                <CheckCheck className="h-4 w-4" />
                {t('actions.markAllRead')}
              </button>
            </div>
          </div>

          <div className={styles.listShell}>
            <div className={styles.messageList}>
              {isLoading ? (
                <div className={styles.loadingState}>
                  <Loading size="lg" />
                </div>
              ) : messages.length === 0 ? (
                EmptyState
              ) : (
                messages.map((msg) => {
                  const meta = toTaskMeta(msg.meta)
                  const thumb = meta.thumbnailUrl ?? null
                  const preview = getMessagePreview(msg)

                  return (
                    <button
                      key={msg.id}
                      type="button"
                      onClick={() => handleSelect(msg)}
                      className={cn(
                        styles.messageCard,
                        !msg.isRead && styles.messageCardUnread
                      )}
                    >
                      {renderStatusIcon(msg)}

                      <div className={styles.thumbnailWrap}>
                        {thumb ? (
                          <Image
                            src={thumb}
                            alt={msg.title}
                            fill
                            className={cn(
                              styles.thumbnailImage,
                              msg.isRead && styles.thumbnailRead
                            )}
                          />
                        ) : (
                          <div className={styles.thumbnailPlaceholder}>
                            <Inbox className="h-5 w-5" />
                          </div>
                        )}
                      </div>

                      <div className={styles.cardContent}>
                        <div className={styles.cardHeaderRow}>
                          <div className={styles.cardTitle}>
                            <span className={styles.cardTitleText}>{msg.title}</span>
                            {!msg.isRead ? <span className={styles.unreadDot} /> : null}
                          </div>
                          <div className={styles.cardDate}>{formatDate(msg.createdAt)}</div>
                        </div>

                        <p
                          className={cn(
                            styles.cardPrompt,
                            !preview && styles.cardPromptEmpty
                          )}
                        >
                          {preview || '\u00A0'}
                        </p>
                      </div>

                      <span className={styles.hoverArrow}>
                        <ChevronRight className="h-5 w-5" />
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            {!isLoading ? <div className={styles.scrollFade} /> : null}
          </div>

          {hasMore && !isLoading ? (
            <div className={styles.loadMoreWrap}>
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className={styles.loadMoreButton}
              >
                {isLoadingMore ? t('actions.loading') : t('actions.loadMore')}
              </button>
            </div>
          ) : null}
        </>
      )}
      </div>
    </Modal>
  )
}
