'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import { useLocale } from 'next-intl'

import { Modal } from '@/components/ui/Modal'
import { useAnnouncementStore } from '@/lib/store'
import { announcementsService } from '@/lib/api/services'
import type { Announcement } from '@/lib/api/types/announcements'

import styles from './AnnouncementModal.module.css'

interface AnnouncementModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabKey = 'latest' | 'history'
type AnnouncementVariant = 'critical' | 'update' | 'default'

function formatDate(dateStr: string, isZh: boolean) {
  try {
    return format(new Date(dateStr), 'yyyy-MM-dd HH:mm', { locale: isZh ? zhCN : enUS })
  } catch {
    return dateStr
  }
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

function getAnnouncementVariant(announcement: Announcement): AnnouncementVariant {
  const content = `${announcement.title} ${stripHtml(announcement.content)}`.toLowerCase()

  if (
    /(严禁|违规|封禁|法律责任|使用须知|安全提示|警告|禁止|风险|warning|ban|forbidden|prohibit)/i.test(content)
  ) {
    return 'critical'
  }

  if (
    announcement.isPinned ||
    /(升级|更新|上线|模型|功能|新增|优化|版本|release|update|upgrade|launch|model|feature)/i.test(content)
  ) {
    return 'update'
  }

  return 'default'
}

function HeaderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function LatestTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function HistoryTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function CriticalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <line x1="12" y1="2" x2="12" y2="16" />
      <line x1="12" y1="2" x2="16" y2="6" />
      <line x1="12" y1="2" x2="8" y2="6" />
      <line x1="4" y1="22" x2="20" y2="22" />
    </svg>
  )
}

function UpdateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function DefaultIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function renderAnnouncementIcon(variant: AnnouncementVariant) {
  if (variant === 'critical') return <CriticalIcon />
  if (variant === 'update') return <UpdateIcon />
  return <DefaultIcon />
}

function getCardClassName(variant: AnnouncementVariant) {
  if (variant === 'critical') return `${styles.announcementCard} ${styles.cardCritical}`
  if (variant === 'update') return `${styles.announcementCard} ${styles.cardUpdate}`
  return styles.announcementCard
}

export const AnnouncementModal = ({ isOpen, onClose }: AnnouncementModalProps) => {
  const locale = useLocale()
  const isZh = locale.toLowerCase().startsWith('zh')
  const { announcements, markAllAsRead } = useAnnouncementStore()

  const [activeTab, setActiveTab] = useState<TabKey>('latest')
  const [historyAnnouncements, setHistoryAnnouncements] = useState<Announcement[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setActiveTab('latest')
    markAllAsRead()
  }, [isOpen, markAllAsRead])

  useEffect(() => {
    if (!isOpen) return

    const loadHistoryAnnouncements = async () => {
      try {
        setIsLoadingHistory(true)
        const response = await announcementsService.getList({ page: 1, limit: 20 })
        setHistoryAnnouncements(response.data || [])
      } catch (error) {
        console.error('Failed to load history announcements:', error)
      } finally {
        setIsLoadingHistory(false)
      }
    }

    void loadHistoryAnnouncements()
  }, [isOpen])

  const currentAnnouncements = useMemo(() => announcements || [], [announcements])
  const renderedAnnouncements = activeTab === 'latest' ? currentAnnouncements : historyAnnouncements

  if (!isOpen) {
    return null
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      ariaLabel={isZh ? '公告中心' : 'Announcement Center'}
      className="h-[80vh] max-h-[700px] max-w-[800px]"
      bodyClassName={styles.bodyShell}
      headerContent={
        <div className={styles.headerTitle}>
          <HeaderIcon />
          <span>{isZh ? '公告中心' : 'Announcement Center'}</span>
        </div>
      }
    >
      <div className={styles.announcementTheme}>
        <div className={styles.tabsContainer}>
          <div className={styles.segmentedControl} data-active={activeTab}>
            <div className={styles.tabBg} />
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'latest' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('latest')}
            >
              <LatestTabIcon />
              {isZh ? '最新公告' : 'Latest'}
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'history' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <HistoryTabIcon />
              {isZh ? '历史公告' : 'History'}
            </button>
          </div>
        </div>

        <div className={styles.modalBody}>
          {activeTab === 'history' && isLoadingHistory ? (
            <div className={styles.emptyState}>{isZh ? '加载中...' : 'Loading...'}</div>
          ) : renderedAnnouncements.length === 0 ? (
            <div className={styles.emptyState}>
              {activeTab === 'latest'
                ? (isZh ? '暂无公告' : 'No announcements')
                : (isZh ? '暂无历史公告' : 'No history announcements')}
            </div>
          ) : (
            renderedAnnouncements.map((announcement) => {
              const variant = getAnnouncementVariant(announcement)

              return (
                <div key={announcement.id} className={getCardClassName(variant)}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>
                      {renderAnnouncementIcon(variant)}
                      {announcement.title}
                    </div>
                    <div className={styles.cardDate}>{formatDate(announcement.createdAt, isZh)}</div>
                  </div>
                  <div className={styles.cardContent}>{stripHtml(announcement.content)}</div>
                </div>
              )
            })
          )}
        </div>

        <div className={styles.scrollFade} />
      </div>
    </Modal>
  )
}
