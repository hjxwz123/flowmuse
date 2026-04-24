'use client'

import Image from 'next/image'
import { Clapperboard, ImageIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { galleryService } from '@/lib/api/services'
import type { ApiTask } from '@/lib/api/types/task'
import { cn } from '@/lib/utils/cn'

import styles from './AuthExperience.module.css'

type GalleryTile = {
  id: string
  type: 'image' | 'video'
  preview: string | null
}

const CARD_HEIGHTS = [320, 280, 360, 300, 340, 290]

function normalizeGalleryItems(items: ApiTask[]) {
  return items.reduce<GalleryTile[]>((acc, item) => {
    const preview =
      item.type === 'video'
        ? item.thumbnailUrl
        : item.thumbnailUrl || item.resultUrl

    if (!preview) return acc

    acc.push({
      id: item.id,
      type: item.type,
      preview,
    })

    return acc
  }, [])
}

function GalleryCard({ item, index }: { item: GalleryTile; index: number }) {
  const height = CARD_HEIGHTS[index % CARD_HEIGHTS.length]

  return (
    <div className={cn(styles.showcaseCard, !item.preview && styles.placeholderCard)} style={{ height }}>
      <span className={styles.iconBadge}>
        {item.type === 'video' ? (
          <Clapperboard className="h-4 w-4" />
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
      </span>

      {item.preview ? (
        <Image
          src={item.preview}
          alt=""
          fill
          sizes="(min-width: 1440px) 22vw, (min-width: 1024px) 24vw, 0px"
          className={styles.showcaseImage}
        />
      ) : (
        <>
          <div className={styles.placeholderOrb} />
          <div className={styles.placeholderGlow} />
        </>
      )}
    </div>
  )
}

export function AuthShowcaseGallery() {
  const [items, setItems] = useState<GalleryTile[]>([])

  useEffect(() => {
    let mounted = true

    const loadPublicWorks = async () => {
      try {
        const feedResult = await galleryService.getPublicFeed({ page: 1, limit: 12 })

        if (!mounted) return

        const merged = normalizeGalleryItems(feedResult.data || []).slice(0, 12)

        setItems(merged)
      } catch (error) {
        console.error('[AuthShowcaseGallery] Failed to load public works:', error)
      }
    }

    void loadPublicWorks()

    return () => {
      mounted = false
    }
  }, [])

  const fallbackItems = useMemo<GalleryTile[]>(
    () =>
      Array.from({ length: 6 }, (_, index) => ({
        id: `placeholder-${index}`,
        type: index % 3 === 1 ? 'video' : 'image',
        preview: null,
      })),
    []
  )

  const displayItems = items.length > 0 ? items : fallbackItems
  const columns = useMemo(
    () => [
      displayItems.filter((_, index) => index % 2 === 0),
      displayItems.filter((_, index) => index % 2 === 1),
    ],
    [displayItems]
  )

  return (
    <div className={cn(styles.showcaseInner, styles.galleryShowcase)} aria-hidden="true">
      <div className={styles.galleryFadeTop} />
      <div className={styles.galleryFadeBottom} />

      {columns.map((column, columnIndex) => (
        <div
          key={columnIndex}
          className={cn(
            styles.scrollColumn,
            columnIndex === 1 && styles.scrollColumnReverse,
          )}
        >
          {[0, 1].map((duplicateIndex) => (
            <div key={duplicateIndex} className={styles.scrollInner}>
              {column.map((item, itemIndex) => (
                <GalleryCard
                  key={`${item.id}-${duplicateIndex}-${itemIndex}`}
                  item={item}
                  index={itemIndex}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
