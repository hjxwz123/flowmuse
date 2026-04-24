'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { galleryService } from '@/lib/api/services'
import { setHomePublicGalleryCache } from '@/lib/cache/viewCache'
import type { ApiTask } from '@/lib/api/types'
import {
  PAGE_SIZE,
  getTaskAspectRatio,
  getTaskAspectRatioValue,
  mergeAndSortTasks,
  toDisplayTasks,
  type DisplayTask,
  type LandingHomeCopy,
} from './landingHomePage.shared'
import styles from './LandingHomePage.module.css'

type LandingPublicGalleryClientProps = {
  locale: string
  initialGalleryItems: ApiTask[]
  initialGalleryPage: number
  initialGalleryHasMore: boolean
  copy: LandingHomeCopy
}

type GalleryCardProps = {
  item: DisplayTask
  index: number
  locale: string
  copy: LandingHomeCopy
}

type MasonryColumnItem = {
  item: DisplayTask
  index: number
}

function getMasonryColumnCount(width: number) {
  if (width >= 1440) return 4
  if (width >= 1024) return 3
  if (width >= 768) return 2
  return 1
}

const GalleryCard = React.memo(function GalleryCard({
  item,
  index,
  locale,
  copy,
}: GalleryCardProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const rafIdRef = useRef(0)

  const formattedDate = useMemo(
    () => new Date(item.createdAt).toLocaleDateString(locale === 'zh-CN' ? 'zh-CN' : 'en-US'),
    [item.createdAt, locale],
  )

  const aspectRatio = useMemo(() => getTaskAspectRatio(item), [item])

  const animationStyle = useMemo(
    () => ({ animationDelay: `${Math.min(index, 8) * 0.14}s`, aspectRatio }),
    [aspectRatio, index],
  )

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    const clientX = event.clientX
    const clientY = event.clientY
    const target = event.currentTarget

    if (rafIdRef.current) return

    rafIdRef.current = requestAnimationFrame(() => {
      const rect = target.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const rotateX = ((y - centerY) / centerY) * -6
      const rotateY = ((x - centerX) / centerX) * 6

      target.style.setProperty('--mouse-x', `${x}px`)
      target.style.setProperty('--mouse-y', `${y}px`)
      target.style.setProperty('--rotate-x', `${rotateX}deg`)
      target.style.setProperty('--rotate-y', `${rotateY}deg`)
      rafIdRef.current = 0
    })
  }, [])

  const handleMouseLeave = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = 0
    }

    const target = event.currentTarget
    target.style.setProperty('--rotate-x', '0deg')
    target.style.setProperty('--rotate-y', '0deg')
  }, [])

  return (
    <Link
      href={`/${locale}/gallery/${item.type}/${item.id}`}
      className={styles.galleryCard}
      style={animationStyle}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {!isLoaded ? (
        <div className={styles.cardPlaceholder} />
      ) : null}

      {item.type === 'video' && item.resultUrl ? (
        <video
          src={item.resultUrl}
          poster={item.thumbnailUrl || undefined}
          className={`${styles.cardMedia} ${isLoaded ? styles.cardMediaLoaded : ''}`}
          muted
          playsInline
          preload="none"
          onLoadedData={() => setIsLoaded(true)}
        />
      ) : (
        <img
          src={item.preview}
          alt={item.prompt || copy.untitled}
          className={`${styles.cardMedia} ${isLoaded ? styles.cardMediaLoaded : ''}`}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onLoad={() => setIsLoaded(true)}
        />
      )}

      <div className={styles.cardOverlay}>
        <p className={styles.cardPrompt}>{item.prompt || copy.untitled}</p>
        <div className={styles.cardMeta}>
          <span>{item.type === 'video' ? copy.publicVideo : copy.publicImage}</span>
          <span>{formattedDate}</span>
        </div>
      </div>
    </Link>
  )
})

export function LandingPublicGalleryClient({
  locale,
  initialGalleryItems,
  initialGalleryPage,
  initialGalleryHasMore,
  copy,
}: LandingPublicGalleryClientProps) {
  const galleryGridRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const hasLoadedFirstPageRef = useRef(initialGalleryPage > 0)
  const loadingRef = useRef(false)
  const itemsRef = useRef<ApiTask[]>([])

  const [items, setItems] = useState<ApiTask[]>(() => initialGalleryItems)
  const [page, setPage] = useState(initialGalleryPage)
  const [hasMore, setHasMore] = useState(initialGalleryHasMore)
  const [isLoading, setIsLoading] = useState(initialGalleryPage === 0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [columnCount, setColumnCount] = useState(1)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    if (initialGalleryPage < 1) return

    setHomePublicGalleryCache({
      items: initialGalleryItems,
      page: initialGalleryPage,
      hasMore: initialGalleryHasMore,
    })
  }, [initialGalleryHasMore, initialGalleryItems, initialGalleryPage])

  const loadPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (loadingRef.current) return
      loadingRef.current = true

      try {
        if (append) {
          setIsLoadingMore(true)
        } else {
          setIsLoading(true)
        }

        const feedResult = await galleryService.getPublicFeed({ page: pageNum, limit: PAGE_SIZE })
        const incoming = feedResult.data || []
        const nextItems = mergeAndSortTasks(append ? itemsRef.current : [], incoming)
        const nextHasMore = Boolean(feedResult.pagination.hasMore)

        setItems(nextItems)
        setPage(pageNum)
        setHasMore(nextHasMore)
        setHomePublicGalleryCache({
          items: nextItems,
          page: pageNum,
          hasMore: nextHasMore,
        })
      } catch (error) {
        console.error('[LandingPublicGalleryClient] Failed to load public gallery:', error)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
        loadingRef.current = false
      }
    },
    [],
  )

  useEffect(() => {
    if (hasLoadedFirstPageRef.current) return

    hasLoadedFirstPageRef.current = true
    void loadPage(1, false)
  }, [loadPage])

  const displayItems = useMemo(() => toDisplayTasks(items), [items])

  useEffect(() => {
    if (!hasLoadedFirstPageRef.current || !hasMore) return

    const sentinel = loadMoreRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        if (loadingRef.current) return
        void loadPage(page + 1, true)
      },
      { root: null, rootMargin: '120px 0px', threshold: 0.01 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [displayItems.length, hasMore, loadPage, page])

  useEffect(() => {
    const grid = galleryGridRef.current
    if (!grid) return

    const updateColumnCount = (width: number) => {
      setColumnCount((prev) => {
        const next = getMasonryColumnCount(width)
        return prev === next ? prev : next
      })
    }

    updateColumnCount(grid.clientWidth || window.innerWidth)

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => updateColumnCount(grid.clientWidth || window.innerWidth)
      window.addEventListener('resize', handleResize, { passive: true })
      return () => window.removeEventListener('resize', handleResize)
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      updateColumnCount(entry.contentRect.width)
    })

    observer.observe(grid)
    return () => observer.disconnect()
  }, [displayItems.length])

  const masonryColumns = useMemo(() => {
    const nextColumns = Array.from({ length: Math.max(1, columnCount) }, () => ({
      items: [] as MasonryColumnItem[],
      heightWeight: 0,
    }))

    for (const [index, item] of displayItems.entries()) {
      const aspectRatioValue = getTaskAspectRatioValue(item)
      const estimatedHeightWeight = aspectRatioValue > 0 ? 1 / aspectRatioValue : 1

      let targetColumnIndex = 0
      for (let currentColumnIndex = 1; currentColumnIndex < nextColumns.length; currentColumnIndex += 1) {
        if (nextColumns[currentColumnIndex].heightWeight < nextColumns[targetColumnIndex].heightWeight) {
          targetColumnIndex = currentColumnIndex
        }
      }

      nextColumns[targetColumnIndex].items.push({ item, index })
      nextColumns[targetColumnIndex].heightWeight += estimatedHeightWeight
    }

    return nextColumns.map((column) => column.items)
  }, [columnCount, displayItems])

  if (isLoading && displayItems.length === 0) {
    return <div className={styles.galleryEmpty}>{copy.galleryLoading}</div>
  }

  if (displayItems.length === 0) {
    return <div className={styles.galleryEmpty}>{copy.galleryEmpty}</div>
  }

  return (
    <>
      <div
        ref={galleryGridRef}
        className={styles.galleryGrid}
        style={{ gridTemplateColumns: `repeat(${Math.max(1, columnCount)}, minmax(0, 1fr))` }}
      >
        {masonryColumns.map((column, columnIndex) => (
          <div key={`gallery-column-${columnIndex}`} className={styles.galleryColumn}>
            {column.map(({ item, index }) => (
              <GalleryCard
                key={`${item.type}-${item.id}`}
                item={item}
                index={index}
                locale={locale}
                copy={copy}
              />
            ))}
          </div>
        ))}
      </div>

      <div ref={loadMoreRef} className={styles.loadMoreSentinel} />

      {isLoadingMore ? <div className={styles.galleryStatus}>{copy.loadingMore}</div> : null}
      {!hasMore ? <div className={styles.galleryStatus}>{copy.noMore}</div> : null}
    </>
  )
}
