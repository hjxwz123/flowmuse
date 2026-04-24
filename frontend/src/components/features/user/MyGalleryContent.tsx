/**
 * 我的作品内容组件
 * 显示用户的所有公开和私密作品
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, ArtCard, Loading, SkeletonCard } from '@/components/ui'
import { MasonryGrid, MasonryItem } from '@/components/ui/MasonryGrid'
import { galleryService } from '@/lib/api/services'
import { useAuthStore } from '@/lib/store/authStore'
import type { ApiTask } from '@/lib/api/types'
import { PageTransition } from '@/components/shared/PageTransition'
import { FadeIn } from '@/components/shared/FadeIn'

export function MyGalleryContent() {
  const t = useTranslations('dashboard.myGallery')
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  const [activeTab, setActiveTab] = useState<'images' | 'videos'>('images')
  const [items, setItems] = useState<ApiTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const loadingRef = useRef(false)
  const pageSize = 10

  // 检查登录状态
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, router])

  // 加载作品列表
  const loadItems = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (!isAuthenticated || loadingRef.current) return
      loadingRef.current = true

      try {
        if (append) {
          setIsLoadingMore(true)
        } else {
          setIsLoading(true)
        }

        console.log('[MyGalleryContent] Loading items, page:', pageNum, 'activeTab:', activeTab)

        const data =
          activeTab === 'images'
            ? await galleryService.getMyImages({ page: pageNum, limit: pageSize })
            : await galleryService.getMyVideos({ page: pageNum, limit: pageSize })

        console.log('[MyGalleryContent] Loaded items:', data.data.length, 'hasMore:', data.pagination.hasMore)

        // 过滤掉失败的作品，只显示已完成的
        const completedItems = data.data.filter((item) => item.status === 'completed')

        if (append) {
          setItems((prev) => [...prev, ...completedItems])
        } else {
          setItems(completedItems)
        }

        setHasMore(data.pagination.hasMore)
        setPage(pageNum)
      } catch (err) {
        console.error('[MyGalleryContent] Failed to load my gallery:', err)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
        loadingRef.current = false
      }
    },
    [isAuthenticated, activeTab]
  )

  // 切换Tab时重新加载
  useEffect(() => {
    if (!isAuthenticated) return
    loadItems(1, false)
  }, [isAuthenticated, activeTab, loadItems])

  // 加载更多
  const handleLoadMore = () => {
    if (hasMore && !loadingRef.current) {
      loadItems(page + 1, true)
    }
  }

  // 监听滚动触底
  useEffect(() => {
    if (!hasMore || !isAuthenticated) return

    const handleScroll = () => {
      if (loadingRef.current) return

      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight

      if (scrollTop + windowHeight >= documentHeight - 100) {
        handleLoadMore()
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [hasMore, isAuthenticated, page])

  if (!isAuthenticated) return null

  return (
    <PageTransition className="min-h-screen bg-canvas px-4 py-12 dark:bg-canvas-dark">
      <div className="mx-auto max-w-[98rem]">
        {/* 标题 */}
        <FadeIn variant="slide">
          <h1 className="font-display text-4xl font-bold text-stone-900 dark:text-stone-100 mb-8">
            {t('title')}
          </h1>
        </FadeIn>

        {/* Tab切换 */}
        <FadeIn variant="scale" delay={0.1}>
          <div className="flex gap-2 mb-8">
          <Button
            variant={activeTab === 'images' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('images')}
          >
            {t('tabs.images')}
          </Button>
          <Button
            variant={activeTab === 'videos' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('videos')}
          >
            {t('tabs.videos')}
          </Button>
        </div>
        </FadeIn>

        {/* 加载状态 */}
        {isLoading && (
          <FadeIn variant="fade" delay={0.2}>
            <MasonryGrid columns={3}>
            {Array.from({ length: 9 }).map((_, i) => (
              <MasonryItem key={i}>
                <SkeletonCard />
              </MasonryItem>
            ))}
          </MasonryGrid>
          </FadeIn>
        )}

        {/* 作品列表 */}
        {!isLoading && items.length === 0 ? (
          <FadeIn variant="fade" delay={0.2}>
            <div className="text-center py-20">
            <p className="font-ui text-lg text-stone-600 mb-6">{t('empty')}</p>
            <Link href="/create">
              <Button>{t('goCreate')}</Button>
            </Link>
          </div>
          </FadeIn>
        ) : (
          !isLoading && (
            <>
              <FadeIn variant="fade" delay={0.2}>
                <MasonryGrid columns={3}>
                {items.map((item) => (
                  <MasonryItem key={item.id}>
                    <Link href={`/gallery/${item.type}/${item.id}`}>
                      <ArtCard
                        imageUrl={item.thumbnailUrl || item.resultUrl || ''}
                        title={item.prompt}
                        author={`User ${item.userId}`}
                        likes={0}
                      />
                    </Link>
                  </MasonryItem>
                ))}
              </MasonryGrid>
              </FadeIn>

              {/* Loading More Indicator */}
              {isLoadingMore && (
                <div className="flex justify-center py-8">
                  <Loading />
                </div>
              )}

              {/* No More Data Message */}
              {!hasMore && items.length > 0 && (
                <div className="text-center py-8">
                  <p className="font-ui text-sm text-stone-500">
                    已加载全部作品
                  </p>
                </div>
              )}
            </>
          )
        )}
      </div>
    </PageTransition>
  )
}
