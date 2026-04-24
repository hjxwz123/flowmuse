/**
 * 作品详情页内容组件
 */

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { SkeletonDetailPage } from '@/components/ui'
import { PageTransition } from '@/components/shared/PageTransition'
import { galleryService } from '@/lib/api/services/gallery'
import { useAuthStore } from '@/lib/store/authStore'
import type { GalleryComment, GalleryItemDetail } from '@/lib/api/types/gallery'
import styles from './GalleryDetail.module.css'

interface GalleryDetailProps {
  type: 'image' | 'video'
  id: string
}

const REFERENCE_IMAGE_KEYS = [
  'image',
  'imageUrl',
  'referenceImage',
  'initImage',
  'imageBase64',
  'promptImage',
  'image_url',
  'firstFrameImage',
  'firstFrame',
]

const REFERENCE_IMAGE_ARRAY_KEYS = ['images', 'referenceImages', 'base64Array']

function toDisplayUrl(value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
    return value
  }

  return `data:image/png;base64,${value}`
}

function formatDate(dateString: string, locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return formatter.format(new Date(dateString))
}

function getUserDisplayName(comment: GalleryComment) {
  return comment.username || comment.email?.split('@')[0] || `User ${comment.userId}`
}

export function GalleryDetailContent({ type, id }: GalleryDetailProps) {
  const t = useTranslations('gallery.detail')
  const locale = useLocale()
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const [detail, setDetail] = useState<GalleryItemDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  const [comments, setComments] = useState<GalleryComment[]>([])
  const [commentContent, setCommentContent] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  const loginUrl = `/${locale}/auth/login`
  const galleryUrl = `/${locale}/gallery`

  useEffect(() => {
    loadDetail()
    loadComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id])

  useEffect(() => {
    setImageLoaded(false)
  }, [detail?.item.resultUrl, detail?.item.thumbnailUrl, type])

  const referenceImages = useMemo(() => {
    if (!detail?.item.parameters) return []

    const params = detail.item.parameters as Record<string, unknown>
    const urls: string[] = []

    const pushUrl = (value: unknown) => {
      if (typeof value === 'string' && value.trim()) {
        urls.push(toDisplayUrl(value))
      }
    }

    for (const key of REFERENCE_IMAGE_KEYS) {
      pushUrl(params[key])
    }

    for (const key of REFERENCE_IMAGE_ARRAY_KEYS) {
      const items = params[key]
      if (!Array.isArray(items)) continue

      for (const item of items) {
        pushUrl(item)
      }
    }

    return Array.from(new Set(urls))
  }, [detail?.item.parameters])

  const creatorName = useMemo(() => {
    if (!detail) return ''

    const creator = detail.item.creator
    return creator?.username || creator?.email?.split('@')[0] || `User ${detail.item.userId}`
  }, [detail])

  const artworkTitle = detail?.item.prompt?.trim() || t('untitled')
  const displayModel = detail?.item.modelName || detail?.item.provider || '--'
  const mainImageUrl = detail?.item.resultUrl || detail?.item.thumbnailUrl || ''
  const ambientImageUrl = detail?.item.thumbnailUrl || detail?.item.resultUrl || referenceImages[0] || ''
  const negativePrompt = detail?.item.negativePrompt?.trim()
  const ambientStyle = ambientImageUrl
    ? ({ ['--ambient-image' as string]: `url("${ambientImageUrl}")` } as React.CSSProperties)
    : undefined
  const isCommentSubmitDisabled = isAuthenticated
    ? isSubmittingComment || !commentContent.trim()
    : false

  const loadDetail = async () => {
    setIsLoading(true)

    try {
      const data = await galleryService.getItemDetail(type, id)
      setDetail(data)
      setLikeCount(data.likeCount)
      setFavoriteCount(data.favoriteCount)
    } catch (error) {
      console.error('[GalleryDetail] Failed to load detail:', error)
      setDetail(null)
    } finally {
      setIsLoading(false)
    }
  }

  const loadComments = async () => {
    try {
      const response = await galleryService.getComments(type, id, { limit: 50 })
      setComments(response.data)
    } catch {
      // ignore
    }
  }

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }

    router.push(galleryUrl)
  }

  const handleRequireAuth = () => {
    router.push(loginUrl)
  }

  const handleLike = async () => {
    if (!isAuthenticated) {
      handleRequireAuth()
      return
    }

    try {
      if (isLiked) {
        await galleryService.unlikeItem(type, id)
        setIsLiked(false)
        setLikeCount((prev) => Math.max(0, prev - 1))
        return
      }

      await galleryService.likeItem(type, id)
      setIsLiked(true)
      setLikeCount((prev) => prev + 1)
    } catch {
      // ignore
    }
  }

  const handleFavorite = async () => {
    if (!isAuthenticated) {
      handleRequireAuth()
      return
    }

    try {
      if (isFavorited) {
        await galleryService.unfavoriteItem(type, id)
        setIsFavorited(false)
        setFavoriteCount((prev) => Math.max(0, prev - 1))
        return
      }

      await galleryService.favoriteItem(type, id)
      setIsFavorited(true)
      setFavoriteCount((prev) => prev + 1)
    } catch {
      // ignore
    }
  }

  const handleDownload = async () => {
    if (!detail?.item.resultUrl) return

    try {
      const fileExtension = type === 'image' ? 'png' : 'mp4'
      const fileName = `flowmuse_${detail.item.id}_${Date.now()}.${fileExtension}`
      const response = await fetch(detail.item.resultUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch {
      window.alert(t('downloadFailed'))
    }
  }

  const handleCopyPrompt = async () => {
    if (!detail?.item.prompt?.trim()) return

    try {
      await navigator.clipboard.writeText(detail.item.prompt)
      setCopiedPrompt(true)
      window.setTimeout(() => setCopiedPrompt(false), 1600)
    } catch {
      // ignore
    }
  }

  const handleSubmitComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isAuthenticated) {
      handleRequireAuth()
      return
    }

    if (!commentContent.trim()) return

    setIsSubmittingComment(true)

    try {
      const newComment = await galleryService.createComment(type, id, commentContent.trim())
      setComments((prev) => [...prev, newComment])
      setCommentContent('')
    } catch {
      // ignore
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    setDeletingCommentId(commentId)

    try {
      await galleryService.deleteComment(type, id, commentId)
      setComments((prev) => prev.filter((comment) => comment.id !== commentId))
    } catch {
      // ignore
    } finally {
      setDeletingCommentId(null)
    }
  }

  if (isLoading) {
    return (
      <PageTransition className={styles.page}>
        <div className={styles.fallbackShell}>
          <SkeletonDetailPage />
        </div>
      </PageTransition>
    )
  }

  if (!detail) {
    return (
      <PageTransition className={styles.page}>
        <div className={styles.fallbackShell}>
          <div className={styles.fallbackCard}>
            <h2 className={styles.fallbackTitle}>{t('notFoundTitle')}</h2>
            <p className={styles.fallbackDescription}>{t('notFoundDescription')}</p>
            <button type="button" className={styles.fallbackButton} onClick={() => router.push(galleryUrl)}>
              {t('back')}
            </button>
          </div>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition className={styles.page}>
      <div className={styles.ambientBackground} aria-hidden="true">
        <div className={styles.ambientBlur} style={ambientStyle} />
      </div>
      <div className={styles.noiseOverlay} aria-hidden="true" />

      <nav className={styles.topNav}>
        <button type="button" className={styles.backButton} onClick={handleBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>{t('back')}</span>
        </button>
      </nav>

      <div className={styles.detailContainer}>
        <section className={styles.artworkSide}>
          <div className={styles.artworkStage}>
            <div className={styles.imageFrame}>
              {type === 'image' ? (
                mainImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mainImageUrl}
                    alt={artworkTitle}
                    className={`${styles.artworkMedia} ${imageLoaded ? styles.artworkMediaLoaded : ''}`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(true)}
                  />
                ) : (
                  <div className={styles.artworkPlaceholder} aria-label={artworkTitle}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-4.2-4.2a1 1 0 0 0-1.4 0L9 17.2l-2.3-2.3a1 1 0 0 0-1.4 0L3 17.2" />
                    </svg>
                  </div>
                )
              ) : detail.item.resultUrl ? (
                <video
                  className={styles.artworkVideo}
                  src={detail.item.resultUrl}
                  controls
                  poster={detail.item.thumbnailUrl || undefined}
                />
              ) : (
                <div className={styles.artworkPlaceholder} aria-label={artworkTitle}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <path d="M10 9.5l5 2.5-5 2.5v-5z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className={styles.infoSide}>
          <h1 className={styles.title}>{artworkTitle}</h1>

          <div className={styles.actionBar}>
            <button
              type="button"
              className={`${styles.actionButton} ${isLiked ? styles.actionButtonActive : ''}`}
              onClick={handleLike}
              aria-pressed={isLiked}
            >
              <svg viewBox="0 0 24 24" fill={isLiked ? 'rgba(239, 68, 68, 0.16)' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span>{t('actions.like')} ({likeCount})</span>
            </button>

            <button
              type="button"
              className={`${styles.actionButton} ${isFavorited ? styles.actionButtonActive : ''}`}
              onClick={handleFavorite}
              aria-pressed={isFavorited}
            >
              <svg viewBox="0 0 24 24" fill={isFavorited ? 'rgba(234, 179, 8, 0.18)' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span>{t('actions.favorite')} ({favoriteCount})</span>
            </button>

            <button
              type="button"
              className={`${styles.actionButton} ${styles.downloadButton}`}
              onClick={handleDownload}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{t('downloadHd')}</span>
            </button>
          </div>

          <div className={styles.promptSection}>
            <div className={styles.sectionLabel}>{t('prompt')}</div>
            <div className={styles.promptBox}>
              <div className={styles.promptText}>{artworkTitle}</div>
              <button
                type="button"
                className={styles.copyButton}
                onClick={handleCopyPrompt}
                title={copiedPrompt ? t('copied') : t('copy')}
                aria-label={copiedPrompt ? t('copied') : t('copy')}
              >
                {copiedPrompt ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {negativePrompt ? (
            <div className={styles.promptSection}>
              <div className={styles.sectionLabel}>{t('negativePrompt')}</div>
              <div className={styles.promptBox}>
                <div className={styles.promptText}>{negativePrompt}</div>
              </div>
            </div>
          ) : null}

          <div className={styles.metaGrid}>
            <div className={styles.metaCard}>
              <div className={styles.sectionLabel}>{t('model')}</div>
              <div className={styles.metaValue}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <span>{displayModel}</span>
              </div>
            </div>

            <div className={styles.metaCard}>
              <div className={styles.sectionLabel}>{t('createdAt')}</div>
              <div className={`${styles.metaValue} ${styles.timeText}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{formatDate(detail.item.createdAt, locale)}</span>
              </div>
            </div>

            <div className={styles.metaCard}>
              <div className={styles.sectionLabel}>{t('creator')}</div>
              <div className={styles.metaValue}>
                {detail.item.creator?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.item.creator.avatar} alt={creatorName} className={styles.authorAvatarImage} />
                ) : (
                  <div className={styles.authorAvatar}>{creatorName.slice(0, 1).toUpperCase()}</div>
                )}
                <span>{creatorName}</span>
              </div>
            </div>
          </div>

          {referenceImages.length > 0 ? (
            <div className={styles.referenceSection}>
              <div className={styles.sectionLabel}>{t('reference')}</div>
              <div className={styles.referenceList}>
                {referenceImages.map((url, index) => (
                  <a
                    key={`${url}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.referenceCard}
                    title={t('referenceSource')}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={t('reference')} className={styles.referenceImage} />
                    <div className={styles.referenceInfo}>
                      {referenceImages.length > 1 ? `${t('referenceSource')} ${index + 1}` : t('referenceSource')}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <div className={styles.commentsSection}>
            <div className={styles.commentsHeader}>
              <span>{t('comments')}</span>
              <span className={styles.commentsCount}>({comments.length})</span>
            </div>

            <form onSubmit={handleSubmitComment}>
              <div className={styles.editorContainer}>
                <textarea
                  value={commentContent}
                  onChange={(event) => {
                    if (!isAuthenticated) return
                    setCommentContent(event.target.value)
                  }}
                  onClick={() => {
                    if (!isAuthenticated) handleRequireAuth()
                  }}
                  readOnly={!isAuthenticated}
                  placeholder={isAuthenticated ? t('commentPlaceholder') : t('commentLoginPlaceholder')}
                  rows={4}
                  maxLength={500}
                  className={`${styles.commentTextarea} ${!isAuthenticated ? styles.commentTextareaReadonly : ''}`}
                />

                <div className={styles.editorActions}>
                  <button
                    type="submit"
                    className={styles.sendButton}
                    disabled={isCommentSubmitDisabled}
                  >
                    <span>{isSubmittingComment ? t('sending') : t('send')}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </div>
            </form>

            {comments.length === 0 ? (
              <div className={styles.emptyState}>{t('commentsEmpty')}</div>
            ) : (
              <ul className={styles.commentList}>
                {comments.map((comment) => {
                  const name = getUserDisplayName(comment)
                  const canDelete = isAdmin || (isAuthenticated && user?.id?.toString() === comment.userId)

                  return (
                    <li key={comment.id} className={styles.commentItem}>
                      <div className={styles.commentAvatarWrap}>
                        {comment.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={comment.avatar} alt={name} className={styles.commentAvatarImage} />
                        ) : (
                          <div className={styles.commentAvatar}>{name.slice(0, 1).toUpperCase()}</div>
                        )}
                      </div>

                      <div className={styles.commentMain}>
                        <div className={styles.commentMeta}>
                          <span className={styles.commentAuthor}>{name}</span>
                          <span className={styles.commentTime}>{formatDate(comment.createdAt, locale)}</span>
                        </div>
                        <p className={styles.commentContent}>{comment.content}</p>
                      </div>

                      {canDelete ? (
                        <button
                          type="button"
                          className={styles.commentDeleteButton}
                          onClick={() => handleDeleteComment(comment.id)}
                          disabled={deletingCommentId === comment.id}
                          title={t('delete')}
                        >
                          {deletingCommentId === comment.id ? t('deleting') : t('delete')}
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </PageTransition>
  )
}
