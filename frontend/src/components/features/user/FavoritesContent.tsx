/**
 * 我的收藏内容组件
 * 显示用户收藏的所有作品
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, ArtCard, Loading } from '@/components/ui'
import { MasonryGrid, MasonryItem } from '@/components/ui/MasonryGrid'
import { galleryService } from '@/lib/api/services'
import { useAuthStore } from '@/lib/store/authStore'
import type { FavoriteRecord } from '@/lib/api/types/gallery'
import { PageTransition } from '@/components/shared/PageTransition'
import { FadeIn } from '@/components/shared/FadeIn'

export function FavoritesContent() {
  const t = useTranslations('dashboard.favorites')
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  const [activeTab, setActiveTab] = useState<'images' | 'videos'>('images')
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([])
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

  // 加载收藏列表
  const loadFavorites = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (!isAuthenticated || loadingRef.current) return
      loadingRef.current = true

      try {
        if (append) {
          setIsLoadingMore(true)
        } else {
          setIsLoading(true)
        }

        const data = await galleryService.getMyFavorites({
          page: pageNum,
          limit: pageSize,
        })

        // 过滤掉失败的作品，只显示已完成的
        const completedItems = data.data.filter((item) => item.item?.status === 'completed')

        if (append) {
          setFavorites((prev) => [...prev, ...completedItems])
        } else {
          setFavorites(completedItems)
        }

        setHasMore(data.pagination.hasMore)
        setPage(pageNum)
      } catch (err) {
        console.error('Failed to load favorites:', err)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
        loadingRef.current = false
      }
    },
    [isAuthenticated]
  )

  useEffect(() => {
    if (!isAuthenticated) return
    loadFavorites(1, false)
  }, [isAuthenticated, loadFavorites])

  // 加载更多
  const handleLoadMore = () => {
    if (hasMore && !loadingRef.current) {
      loadFavorites(page + 1, true)
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

  // 根据Tab过滤
  const filteredFavorites = favorites.filter(
    (fav) => fav.targetType === (activeTab === 'images' ? 'image' : 'video')
  )

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
            <div className="flex justify-center py-20">
              <Loading size="lg" />
            </div>
          </FadeIn>
        )}

        {/* 收藏列表 */}
        {!isLoading && filteredFavorites.length === 0 ? (
          <FadeIn variant="fade" delay={0.2}>
            <div className="text-center py-20">
            <p className="font-ui text-lg text-stone-600 mb-6">{t('empty')}</p>
            <Link href="/gallery">
              <Button>{t('goGallery')}</Button>
            </Link>
          </div>
          </FadeIn>
        ) : (
          !isLoading && (
            <>
              <FadeIn variant="fade" delay={0.2}>
                <MasonryGrid columns={3}>
                {filteredFavorites.map((fav) => (
                  <MasonryItem key={`${fav.targetType}-${fav.targetId}`}>
                    <Link href={`/gallery/${fav.targetType}/${fav.targetId}`}>
                      <ArtCard
                        imageUrl={
                          fav.item.thumbnailUrl || fav.item.resultUrl || ''
                        }
                        title={fav.item.prompt}
                        author={`User ${fav.item.userId}`}
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
              {!hasMore && favorites.length > 0 && (
                <div className="text-center py-8">
                  <p className="font-ui text-sm text-stone-500">
                    已加载全部收藏
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
