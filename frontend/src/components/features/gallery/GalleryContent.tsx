/**
 * 公共画廊客户端组件
 */

'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { galleryService } from '@/lib/api/services/gallery'
import type { ApiTask } from '@/lib/api/types'
import { cn } from '@/lib/utils/cn'
import { PageTransition } from '@/components/shared/PageTransition'
import { MasonryGrid, MasonryItem } from '@/components/ui/MasonryGrid'

type TabType = 'all' | 'images' | 'videos'

interface GalleryContentProps {
  locale: string
  initialImages?: ApiTask[]
  initialVideos?: ApiTask[]
  initialHasMore?: boolean
}

function formatDate(date: string, locale: string) {
  return new Date(date).toLocaleDateString(locale === 'zh-CN' ? 'zh-CN' : 'en-US')
}

function getCardPreview(task: ApiTask) {
  if (task.type === 'video' && !task.thumbnailUrl && task.resultUrl) {
    return { kind: 'video' as const, src: task.resultUrl }
  }

  return {
    kind: 'image' as const,
    src: task.thumbnailUrl || task.resultUrl || '',
  }
}

function GalleryArtworkCard({ artwork, locale, isZh }: { artwork: ApiTask, locale: string, isZh: boolean }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const preview = getCardPreview(artwork)

  const aspectRatio = useMemo(() => {
    if (artwork.parameters) {
      const params = artwork.parameters as Record<string, unknown>
      if (params.width && params.height) {
        return `${params.width} / ${params.height}`
      }
      if (params.ar) {
        const arMap: Record<string, string> = {
          '16:9': '16 / 9',
          '9:16': '9 / 16',
          '3:2': '3 / 2',
          '2:3': '2 / 3',
          '4:3': '4 / 3',
          '3:4': '3 / 4',
          '1:1': '1 / 1',
        }
        if (typeof params.ar === 'string' && arMap[params.ar]) {
          return arMap[params.ar]
        }
      }
    }
    return artwork.type === 'video' ? '16 / 9' : '1 / 1'
  }, [artwork])

  return (
    <MasonryItem>
      <Link
        href={`/${locale}/gallery/${artwork.type}/${artwork.id}`}
        className="group block overflow-hidden rounded-[24px] border border-stone-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-stone-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:border-stone-800 dark:bg-stone-950 dark:hover:border-stone-700 dark:hover:shadow-[0_20px_48px_rgba(0,0,0,0.36)]"
      >
        <div className="relative" style={{ aspectRatio }}>
          {!isLoaded && (
            <div className="absolute inset-0 bg-stone-100 dark:bg-stone-900 animate-pulse" />
          )}

          {preview.kind === 'video' ? (
            <video
              src={preview.src}
              poster={artwork.thumbnailUrl || undefined}
              className={cn("block h-full w-full object-cover transition-opacity duration-500", isLoaded ? "opacity-100" : "opacity-0")}
              muted
              playsInline
              preload="metadata"
              onLoadedData={() => setIsLoaded(true)}
            />
          ) : (
            <img
              src={preview.src}
              alt={artwork.prompt || (isZh ? '公开作品' : 'Public artwork')}
              className={cn("block h-full w-full object-cover transition-opacity duration-500", isLoaded ? "opacity-100" : "opacity-0")}
              loading="lazy"
              onLoad={() => setIsLoaded(true)}
            />
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent opacity-80" />
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className="rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
              {artwork.type === 'video' ? (isZh ? '视频' : 'Video') : (isZh ? '图片' : 'Image')}
            </span>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <p className="line-clamp-3 text-sm leading-6 text-stone-800 dark:text-stone-100">
            {artwork.prompt || (isZh ? '未命名作品' : 'Untitled artwork')}
          </p>
          <div className="flex items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-stone-400 dark:text-stone-500">
            <span>{artwork.type === 'video' ? (isZh ? '公开视频' : 'Public Video') : (isZh ? '公开图片' : 'Public Image')}</span>
            <span>{formatDate(artwork.createdAt, locale)}</span>
          </div>
        </div>
      </Link>
    </MasonryItem>
  )
}

export function GalleryContent({
  locale,
  initialImages = [],
  initialVideos = [],
  initialHasMore = true,
}: GalleryContentProps) {
  const t = useTranslations('gallery')
  const isZh = locale.toLowerCase().startsWith('zh')
  const hasSSRData = initialImages.length > 0 || initialVideos.length > 0

  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [images, setImages] = useState<ApiTask[]>(initialImages)
  const [videos, setVideos] = useState<ApiTask[]>(initialVideos)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)

  const skipInitialFetch = useRef(hasSSRData)
  const loadingRef = useRef(false)
  const pageSize = 10

  const loadArtworks = async (pageNum: number, append = false) => {
    if (loadingRef.current) return
    loadingRef.current = true

    try {
      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }

      if (activeTab === 'all') {
        const feedResult = await galleryService.getPublicFeed({ q: searchQuery, page: pageNum, limit: pageSize })

        if (append) {
          setImages((prev) => [...prev, ...(feedResult.data || [])])
        } else {
          setImages(feedResult.data || [])
        }

        setVideos([])
        setHasMore(Boolean(feedResult.pagination.hasMore))
      } else if (activeTab === 'images') {
        const imageResult = await galleryService.getPublicImages({ q: searchQuery, page: pageNum, limit: pageSize })

        if (append) {
          setImages((prev) => [...prev, ...(imageResult.data || [])])
        } else {
          setImages(imageResult.data || [])
          setVideos([])
        }

        setHasMore(Boolean(imageResult.pagination.hasMore))
      } else {
        const videoResult = await galleryService.getPublicVideos({ q: searchQuery, page: pageNum, limit: pageSize })

        if (append) {
          setVideos((prev) => [...prev, ...(videoResult.data || [])])
        } else {
          setImages([])
          setVideos(videoResult.data || [])
        }

        setHasMore(Boolean(videoResult.pagination.hasMore))
      }

      setPage(pageNum)
    } catch (error) {
      console.error('[GalleryContent] Failed to load artworks:', error)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
      loadingRef.current = false
    }
  }

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }

    void loadArtworks(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  useEffect(() => {
    if (!hasMore) return

    const handleScroll = () => {
      if (loadingRef.current) return

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight

      if (scrollTop + windowHeight >= documentHeight - 220) {
        void loadArtworks(page + 1, true)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, page])

  const allArtworks = useMemo(
    () =>
      [...(Array.isArray(images) ? images : []), ...(Array.isArray(videos) ? videos : [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [images, videos],
  )

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void loadArtworks(1, false)
  }

  return (
    <PageTransition className="min-h-screen bg-canvas text-stone-950 dark:bg-canvas-dark dark:text-white">
      <section className="mx-auto max-w-[98rem] px-4 pb-10 pt-6 md:px-6 md:pb-14 md:pt-8">
        <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-stone-950 dark:text-white md:text-4xl">
              {t('title')}
            </h1>
          </div>

          <form onSubmit={handleSearch} className="w-full md:max-w-md">
            <div className="flex items-center gap-2 rounded-[22px] border border-stone-200 bg-white px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-950 dark:shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
              <svg className="h-4 w-4 shrink-0 text-stone-400 dark:text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('searchPlaceholder')}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400 dark:text-stone-100 dark:placeholder:text-stone-500"
              />
              <button
                type="submit"
                className="theme-solid-control theme-solid-shadow inline-flex h-9 items-center justify-center rounded-full px-4 text-xs font-semibold transition-colors"
              >
                {t('search')}
              </button>
            </div>
          </form>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-2">
          {(['all', 'images', 'videos'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
                activeTab === tab
                  ? 'theme-toggle-active'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-950 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300 dark:hover:border-stone-700 dark:hover:text-white'
              )}
            >
              {t(`tabs.${tab}`)}
            </button>
          ))}
        </div>

        {isLoading && allArtworks.length === 0 ? (
          <MasonryGrid columns={4}>
            {Array.from({ length: 9 }).map((_, index) => (
              <MasonryItem key={index}>
                <div className="overflow-hidden rounded-[24px] border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950">
                  <div className="aspect-[4/5] animate-pulse bg-stone-100 dark:bg-stone-900" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 w-3/4 animate-pulse rounded-full bg-stone-100 dark:bg-stone-900" />
                    <div className="h-3 w-1/2 animate-pulse rounded-full bg-stone-100 dark:bg-stone-900" />
                  </div>
                </div>
              </MasonryItem>
            ))}
          </MasonryGrid>
        ) : null}

        {!isLoading && allArtworks.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-[28px] border border-dashed border-stone-200 bg-stone-50/70 px-6 py-16 text-center dark:border-stone-800 dark:bg-stone-950/70">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-600">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-stone-950 dark:text-white">
              {searchQuery ? t('empty.searchEmpty') : t('empty.title')}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-stone-500 dark:text-stone-400">
              {searchQuery ? t('empty.searchDescription') : t('empty.description')}
            </p>
          </div>
        ) : null}

        {!isLoading && allArtworks.length > 0 ? (
          <>
            <MasonryGrid columns={4}>
              {allArtworks.map((artwork) => (
                <GalleryArtworkCard 
                  key={`${artwork.type}-${artwork.id}`} 
                  artwork={artwork} 
                  locale={locale} 
                  isZh={isZh} 
                />
              ))}
            </MasonryGrid>

            {isLoadingMore ? (
              <div className="py-10 text-center text-sm font-medium text-stone-500 dark:text-stone-400">
                {isZh ? '正在加载更多公共作品...' : 'Loading more public works...'}
              </div>
            ) : null}

            {!hasMore ? (
              <div className="py-10 text-center text-sm font-medium text-stone-400 dark:text-stone-500">
                {isZh ? '已加载全部公共作品' : 'All public works loaded'}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </PageTransition>
  )
}
