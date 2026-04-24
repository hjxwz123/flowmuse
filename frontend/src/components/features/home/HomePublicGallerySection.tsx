'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ArtCard } from '@/components/ui/ArtCard'
import { Loading } from '@/components/ui/Loading'
import { MasonryGrid, MasonryItem } from '@/components/ui/MasonryGrid'
import { galleryService } from '@/lib/api/services'
import type { ApiTask } from '@/lib/api/types'
import { getHomePublicGalleryCache, setHomePublicGalleryCache } from '@/lib/cache/viewCache'

type HomePublicGallerySectionProps = {
  locale: string
  isZh: boolean
}

const PAGE_SIZE = 10
const HOME_PUBLIC_GALLERY_CACHE_MAX_AGE_MS = 5 * 60 * 1000
const HOME_PUBLIC_GALLERY_CACHE_FRESH_MS = 20 * 1000

function mergeAndSortTasks(prev: ApiTask[], incoming: ApiTask[]) {
  const map = new Map<string, ApiTask>()

  for (const task of prev) {
    map.set(`${task.type}-${task.id}`, task)
  }

  for (const task of incoming) {
    map.set(`${task.type}-${task.id}`, task)
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function HomePublicGallerySection({
  locale,
  isZh,
}: HomePublicGallerySectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const loadingRef = useRef(false)
  const hasLoadedFirstPageRef = useRef(false)
  const itemsRef = useRef<ApiTask[]>([])

  const [isActivated, setIsActivated] = useState(false)
  const [items, setItems] = useState<ApiTask[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const loadPage = useCallback(async (pageNum: number, append: boolean, options?: { silent?: boolean }) => {
    if (loadingRef.current) return
    loadingRef.current = true
    const silent = options?.silent ?? false

    try {
      if (append) setIsLoadingMore(true)
      else if (!silent) setIsLoading(true)

      const feedResult = await galleryService.getPublicFeed({ page: pageNum, limit: PAGE_SIZE })
      const incoming = feedResult.data || []
      const nextItems = mergeAndSortTasks(append ? itemsRef.current : [], incoming)
      const nextHasMore = Boolean(feedResult.pagination.hasMore)

      setItems(nextItems)
      setHasMore(nextHasMore)
      setPage(pageNum)
      setHomePublicGalleryCache({
        items: nextItems,
        page: pageNum,
        hasMore: nextHasMore,
      })
    } catch (error) {
      console.error('[HomePublicGallerySection] Failed to load public gallery:', error)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    const cached = getHomePublicGalleryCache(HOME_PUBLIC_GALLERY_CACHE_MAX_AGE_MS)
    if (!cached) return

    hasLoadedFirstPageRef.current = true
    setIsActivated(true)
    setItems(cached.items)
    setPage(cached.page)
    setHasMore(cached.hasMore)
    setIsLoading(false)

    if (cached.page === 1 && Date.now() - cached.cachedAt > HOME_PUBLIC_GALLERY_CACHE_FRESH_MS) {
      void loadPage(1, false, { silent: true })
    }
  }, [loadPage])

  // 区块进入可视区域后才激活加载，避免首页首屏不必要请求。
  useEffect(() => {
    if (isActivated) return
    const section = sectionRef.current
    if (!section) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsActivated(true)
        }
      },
      { root: null, rootMargin: '240px 0px', threshold: 0.01 }
    )

    observer.observe(section)
    return () => observer.disconnect()
  }, [isActivated])

  // 首次进入可视区域时拉取第一页。
  useEffect(() => {
    if (!isActivated || hasLoadedFirstPageRef.current) return
    hasLoadedFirstPageRef.current = true
    void loadPage(1, false)
  }, [isActivated, loadPage])

  // 触底（底部哨兵）自动加载下一页。
  useEffect(() => {
    if (!isActivated || !hasMore || !hasLoadedFirstPageRef.current) return
    const sentinel = loadMoreRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        if (loadingRef.current) return
        void loadPage(page + 1, true)
      },
      { root: null, rootMargin: '320px 0px', threshold: 0.01 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isActivated, loadPage, page])

  const displayItems = useMemo(
    () =>
      items.reduce<Array<ApiTask & { preview: string }>>((acc, item) => {
        const preview = item.thumbnailUrl || item.resultUrl
        if (!preview) return acc
        acc.push({ ...item, preview })
        return acc
      }, []),
    [items]
  )

  return (
    <section
      ref={sectionRef}
      className="w-full px-4 pb-14 md:px-8"
    >
      <div className="rounded-[28px] border border-stone-200 bg-white/75 p-5 shadow-canvas backdrop-blur-sm dark:border-stone-800 dark:bg-stone-950/70 dark:shadow-[0_18px_60px_rgba(0,0,0,0.32)] md:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-stone-900 dark:text-stone-100">
              {isZh ? '公共画廊' : 'Public Gallery'}
            </h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
              {isZh
                ? '展示社区公开作品'
                : 'Public works'}
            </p>
          </div>
          <Link
            href={`/${locale}/create`}
            className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900/90 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            {isZh ? '我也去创作' : 'Create Mine'}
          </Link>
        </div>

        {!isActivated ? (
          <div className="rounded-2xl border border-stone-200 bg-white/90 p-6 text-center text-sm text-stone-500 dark:border-stone-800 dark:bg-stone-900/90 dark:text-stone-400">
            {isZh ? '加载公共作品' : 'load public works'}
          </div>
        ) : isLoading && displayItems.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white/90 p-10 dark:border-stone-800 dark:bg-stone-900/90">
            <Loading size="md" text={isZh ? '正在加载公共作品...' : 'Loading public works...'} />
          </div>
        ) : displayItems.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white/90 p-6 text-center text-sm text-stone-500 dark:border-stone-800 dark:bg-stone-900/90 dark:text-stone-400">
            {isZh ? '暂时没有公开作品' : 'No public artworks yet'}
          </div>
        ) : (
          <>
            <MasonryGrid columns={3}>
              {displayItems.map((item) => (
                <MasonryItem key={`${item.type}-${item.id}`}>
                  <Link href={`/${locale}/gallery/${item.type}/${item.id}`} className="block">
                    <ArtCard
                      imageUrl={item.preview}
                      title={item.prompt || (isZh ? '未命名作品' : 'Untitled work')}
                      author={item.userId ? `User ${item.userId}` : undefined}
                      likes={0}
                    />
                  </Link>
                </MasonryItem>
              ))}
            </MasonryGrid>

            <div ref={loadMoreRef} className="py-2" />

            {isLoadingMore ? (
              <div className="py-4">
                <Loading size="sm" text={isZh ? '加载更多中...' : 'Loading more...'} />
              </div>
            ) : null}

            {!hasMore ? (
              <p className="py-2 text-center text-xs text-stone-500 dark:text-stone-400">
                {isZh ? '没有更多公开作品了' : 'No more public works'}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
