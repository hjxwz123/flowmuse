'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Clapperboard, ImageIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { galleryService } from '@/lib/api/services'
import type { ApiTask } from '@/lib/api/types/task'
import { cn } from '@/lib/utils/cn'

type ShowcaseItem = {
  id: string
  type: 'image' | 'video'
  preview: string
  createdAt: string
}

type PlaceholderTile = {
  id: string
  type: 'image' | 'video'
  placeholder: true
}

type DisplayTile = ShowcaseItem | PlaceholderTile

type OrbitVariant = 'register' | 'recovery' | 'reset'

type AbstractTheme = {
  shellClass: string
  glowClass: string
  meshStart: string
  meshMid: string
  meshEnd: string
  blobAStart: string
  blobAEnd: string
  blobBStart: string
  blobBEnd: string
  blobCStart: string
  blobCEnd: string
  trailStart: string
  trailEnd: string
  particle: string
}

const IMAGE_TILE_HEIGHTS = ['h-36', 'h-44', 'h-56', 'h-40', 'h-52']
const VIDEO_TILE_HEIGHTS = ['h-28', 'h-36', 'h-40', 'h-32']
const PLACEHOLDER_GRADIENTS = [
  'from-[#ffe7d6] via-[#ffe4ef] to-[#fff4cc] dark:from-[#7c2d12]/55 dark:via-[#831843]/48 dark:to-[#854d0e]/45',
  'from-[#d8f3ff] via-[#dbeafe] to-[#e9d5ff] dark:from-[#155e75]/44 dark:via-[#1d4ed8]/38 dark:to-[#5b21b6]/34',
  'from-[#ddfce7] via-[#ecfccb] to-[#cffafe] dark:from-[#166534]/42 dark:via-[#365314]/36 dark:to-[#0f766e]/32',
  'from-[#fef3c7] via-[#fed7aa] to-[#fecdd3] dark:from-[#78350f]/44 dark:via-[#9a3412]/38 dark:to-[#9d174d]/32',
]

const BLOB_PATHS_A = [
  'M192 178 C270 92 403 83 510 137 C617 191 700 308 684 431 C668 554 553 682 425 724 C297 766 156 722 90 619 C24 516 114 264 192 178 Z',
  'M154 222 C242 115 409 77 536 137 C663 197 745 344 715 479 C685 614 543 736 395 748 C247 760 98 663 58 535 C18 407 66 329 154 222 Z',
  'M223 139 C336 73 484 92 582 172 C680 252 728 393 682 513 C636 633 496 733 352 724 C208 715 78 596 54 463 C30 330 110 205 223 139 Z',
  'M192 178 C270 92 403 83 510 137 C617 191 700 308 684 431 C668 554 553 682 425 724 C297 766 156 722 90 619 C24 516 114 264 192 178 Z',
]

const BLOB_PATHS_B = [
  'M555 182 C650 214 721 294 736 388 C751 482 711 590 634 667 C557 744 442 789 334 768 C226 747 125 660 103 548 C81 436 138 316 229 252 C320 188 460 150 555 182 Z',
  'M592 214 C694 254 759 353 750 460 C741 567 658 664 557 727 C456 790 337 819 236 772 C135 725 56 602 71 485 C86 368 170 270 276 221 C382 172 490 174 592 214 Z',
  'M505 144 C631 157 735 243 776 355 C817 467 795 607 709 697 C623 787 474 825 344 792 C214 759 97 655 82 532 C67 409 155 267 273 197 C391 127 379 131 505 144 Z',
  'M555 182 C650 214 721 294 736 388 C751 482 711 590 634 667 C557 744 442 789 334 768 C226 747 125 660 103 548 C81 436 138 316 229 252 C320 188 460 150 555 182 Z',
]

const BLOB_PATHS_C = [
  'M300 512 C389 463 498 472 580 517 C662 562 718 642 719 726 C720 810 665 898 579 931 C493 964 377 942 286 894 C195 846 129 772 128 690 C127 608 211 561 300 512 Z',
  'M248 553 C347 477 482 458 585 495 C688 532 760 625 772 724 C784 823 736 927 640 974 C544 1021 399 1011 287 957 C175 903 95 806 103 708 C111 610 149 629 248 553 Z',
  'M338 482 C438 437 551 455 634 515 C717 575 770 677 754 776 C738 875 653 970 546 999 C439 1028 310 990 210 931 C110 872 39 771 52 674 C65 577 238 527 338 482 Z',
  'M300 512 C389 463 498 472 580 517 C662 562 718 642 719 726 C720 810 665 898 579 931 C493 964 377 942 286 894 C195 846 129 772 128 690 C127 608 211 561 300 512 Z',
]

const ABSTRACT_THEMES: Record<OrbitVariant, AbstractTheme> = {
  register: {
    shellClass:
      'bg-[linear-gradient(180deg,rgba(255,248,241,0.98)_0%,rgba(246,241,255,0.94)_50%,rgba(238,246,255,0.92)_100%)] dark:bg-[linear-gradient(180deg,rgba(13,11,22,0.98)_0%,rgba(19,18,33,0.95)_50%,rgba(10,18,31,0.94)_100%)]',
    glowClass:
      'from-[#f59e0b]/18 via-[#8b5cf6]/14 to-[#38bdf8]/12 dark:from-[#fb923c]/14 dark:via-[#8b5cf6]/12 dark:to-[#38bdf8]/10',
    meshStart: '#fff7ed',
    meshMid: '#f5f3ff',
    meshEnd: '#dbeafe',
    blobAStart: '#f59e0b',
    blobAEnd: '#8b5cf6',
    blobBStart: '#fb7185',
    blobBEnd: '#fdba74',
    blobCStart: '#38bdf8',
    blobCEnd: '#c084fc',
    trailStart: '#fffaf2',
    trailEnd: '#ddd6fe',
    particle: '#fff7ed',
  },
  recovery: {
    shellClass:
      'bg-[linear-gradient(180deg,rgba(243,251,252,0.98)_0%,rgba(244,248,255,0.94)_52%,rgba(255,248,238,0.92)_100%)] dark:bg-[linear-gradient(180deg,rgba(7,18,24,0.98)_0%,rgba(10,22,34,0.95)_52%,rgba(21,18,24,0.94)_100%)]',
    glowClass:
      'from-[#0ea5e9]/16 via-[#14b8a6]/14 to-[#f59e0b]/10 dark:from-[#06b6d4]/14 dark:via-[#38bdf8]/12 dark:to-[#f59e0b]/9',
    meshStart: '#ecfeff',
    meshMid: '#e0f2fe',
    meshEnd: '#fef3c7',
    blobAStart: '#06b6d4',
    blobAEnd: '#3b82f6',
    blobBStart: '#67e8f9',
    blobBEnd: '#f59e0b',
    blobCStart: '#14b8a6',
    blobCEnd: '#fcd34d',
    trailStart: '#f8fafc',
    trailEnd: '#bfdbfe',
    particle: '#f0fdfa',
  },
  reset: {
    shellClass:
      'bg-[linear-gradient(180deg,rgba(250,245,255,0.98)_0%,rgba(255,244,249,0.94)_52%,rgba(239,248,255,0.92)_100%)] dark:bg-[linear-gradient(180deg,rgba(20,10,30,0.98)_0%,rgba(25,15,35,0.95)_52%,rgba(12,22,33,0.94)_100%)]',
    glowClass:
      'from-[#a78bfa]/18 via-[#f472b6]/14 to-[#38bdf8]/10 dark:from-[#8b5cf6]/14 dark:via-[#ec4899]/12 dark:to-[#0ea5e9]/10',
    meshStart: '#faf5ff',
    meshMid: '#ffe4ef',
    meshEnd: '#cffafe',
    blobAStart: '#a78bfa',
    blobAEnd: '#f472b6',
    blobBStart: '#38bdf8',
    blobBEnd: '#8b5cf6',
    blobCStart: '#fb7185',
    blobCEnd: '#67e8f9',
    trailStart: '#fff7fb',
    trailEnd: '#ddd6fe',
    particle: '#fff7fb',
  },
}

const FLOW_PATHS_A = [
  'M-88 314 C106 176 270 194 428 294 C586 394 708 456 980 390',
  'M-104 346 C74 220 256 208 420 298 C584 388 734 500 980 430',
  'M-74 286 C116 156 298 178 446 286 C594 394 736 454 980 362',
  'M-88 314 C106 176 270 194 428 294 C586 394 708 456 980 390',
]

const FLOW_PATHS_B = [
  'M96 1040 C168 826 290 668 432 548 C574 428 710 268 826 -84',
  'M74 1040 C154 856 284 690 444 566 C604 442 746 276 862 -100',
  'M122 1040 C196 818 334 640 476 520 C618 400 742 248 812 -76',
  'M96 1040 C168 826 290 668 432 548 C574 428 710 268 826 -84',
]

const FLOW_PATHS_C = [
  'M-120 746 C78 646 252 646 394 706 C536 766 666 826 980 770',
  'M-96 700 C108 610 286 618 422 694 C558 770 704 856 980 806',
  'M-132 782 C60 676 246 664 392 724 C538 784 676 798 980 732',
  'M-120 746 C78 646 252 646 394 706 C536 766 666 826 980 770',
]

const CONTOUR_PATHS_A = [
  'M176 498 C232 382 354 324 500 346 C646 368 736 472 724 608 C712 744 580 842 434 840 C288 838 150 708 176 498 Z',
  'M156 516 C224 392 360 330 512 354 C664 378 752 492 730 632 C708 772 568 860 414 842 C260 824 126 698 156 516 Z',
  'M190 476 C250 370 380 308 522 336 C664 364 748 478 726 604 C704 730 570 822 430 820 C290 818 160 684 190 476 Z',
  'M176 498 C232 382 354 324 500 346 C646 368 736 472 724 608 C712 744 580 842 434 840 C288 838 150 708 176 498 Z',
]

const CONTOUR_PATHS_B = [
  'M236 434 C320 358 430 330 546 356 C662 382 744 476 744 594 C744 712 652 800 532 828 C412 856 272 824 198 738 C124 652 152 510 236 434 Z',
  'M218 452 C308 366 428 332 554 366 C680 400 762 500 754 618 C746 736 648 816 522 838 C396 860 254 820 184 728 C114 636 128 538 218 452 Z',
  'M250 416 C338 344 444 320 556 348 C668 376 740 470 736 586 C732 702 638 790 520 818 C402 846 274 812 208 730 C142 648 162 488 250 416 Z',
  'M236 434 C320 358 430 330 546 356 C662 382 744 476 744 594 C744 712 652 800 532 828 C412 856 272 824 198 738 C124 652 152 510 236 434 Z',
]

const CORE_PATHS_A = [
  'M98 264 C128 180 210 134 276 150 C342 166 382 232 364 294 C346 356 284 400 218 396 C152 392 68 348 98 264 Z',
  'M82 252 C122 170 208 126 282 146 C356 166 390 238 370 306 C350 374 276 406 206 396 C136 386 42 334 82 252 Z',
  'M112 286 C146 194 222 154 286 166 C350 178 388 240 370 300 C352 360 294 390 232 388 C170 386 78 378 112 286 Z',
  'M98 264 C128 180 210 134 276 150 C342 166 382 232 364 294 C346 356 284 400 218 396 C152 392 68 348 98 264 Z',
]

const CORE_PATHS_B = [
  'M112 122 C170 80 250 78 306 118 C362 158 388 230 372 294 C356 358 298 414 224 420 C150 426 76 382 58 314 C40 246 54 164 112 122 Z',
  'M96 132 C160 76 252 72 314 118 C376 164 398 246 376 316 C354 386 282 432 204 424 C126 416 54 360 42 286 C30 212 32 188 96 132 Z',
  'M124 110 C186 70 260 78 316 126 C372 174 394 244 376 308 C358 372 300 426 230 430 C160 434 82 398 56 326 C30 254 62 150 124 110 Z',
  'M112 122 C170 80 250 78 306 118 C362 158 388 230 372 294 C356 358 298 414 224 420 C150 426 76 382 58 314 C40 246 54 164 112 122 Z',
]

function normalizeGalleryItems(items: ApiTask[]) {
  return items.reduce<ShowcaseItem[]>((acc, item) => {
    const preview =
      item.type === 'video'
        ? item.thumbnailUrl
        : item.thumbnailUrl || item.resultUrl

    if (!preview) return acc

    acc.push({
      id: item.id,
      type: item.type,
      preview,
      createdAt: item.createdAt,
    })

    return acc
  }, [])
}

function getTileHeight(type: 'image' | 'video', index: number) {
  return type === 'video'
    ? VIDEO_TILE_HEIGHTS[index % VIDEO_TILE_HEIGHTS.length]
    : IMAGE_TILE_HEIGHTS[index % IMAGE_TILE_HEIGHTS.length]
}

function PreviewTile({ tile, index }: { tile: DisplayTile; index: number }) {
  const heightClass = getTileHeight(tile.type, index)
  const iconClassName =
    'absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-black/20 text-white shadow-[0_12px_24px_rgba(15,23,42,0.24)] backdrop-blur-md'

  if ('placeholder' in tile) {
    const gradientClass = PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length]

    return (
      <div
        className={cn(
          'group relative overflow-hidden rounded-[28px] border border-white/30 bg-gradient-to-br shadow-[0_26px_44px_-30px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-white/10',
          heightClass,
          gradientClass,
        )}
      >
        <motion.div
          animate={{ rotate: [0, 22, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 10 + (index % 4), repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/25 blur-2xl dark:bg-white/10"
        />
        <motion.div
          animate={{ y: [0, 10, 0], opacity: [0.25, 0.58, 0.25] }}
          transition={{ duration: 8 + (index % 3), repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-x-5 bottom-5 h-16 rounded-[22px] border border-white/25 bg-white/15 backdrop-blur-md dark:border-white/10 dark:bg-white/5"
        />
        <div className={iconClassName}>
          {tile.type === 'video' ? <Clapperboard className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[28px] border border-white/30 bg-white/10 shadow-[0_26px_44px_-30px_rgba(15,23,42,0.6)] backdrop-blur-xl dark:border-white/10',
        heightClass,
      )}
    >
      <Image
        src={tile.preview}
        alt=""
        fill
        sizes="(min-width: 1280px) 240px, (min-width: 1024px) 220px, 0px"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.1)_0%,rgba(15,23,42,0.06)_38%,rgba(15,23,42,0.42)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.3),transparent_40%)] mix-blend-screen opacity-75" />
      <div className={iconClassName}>
        {tile.type === 'video' ? <Clapperboard className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
      </div>
    </div>
  )
}

export function LoginShowcasePanel() {
  const [items, setItems] = useState<ShowcaseItem[]>([])

  useEffect(() => {
    let active = true

    const loadItems = async () => {
      try {
        const feedResult = await galleryService.getPublicFeed({ page: 1, limit: 12 })

        if (!active) return

        const merged = normalizeGalleryItems(feedResult.data || []).slice(0, 12)

        setItems(merged)
      } catch (error) {
        console.error('[LoginShowcasePanel] Failed to load public gallery:', error)
      }
    }

    void loadItems()

    return () => {
      active = false
    }
  }, [])

  const tiles = useMemo<DisplayTile[]>(() => {
    if (items.length > 0) return items

    return Array.from({ length: 10 }, (_, index) => ({
      id: `placeholder-${index}`,
      type: index % 4 === 0 ? 'video' : 'image',
      placeholder: true as const,
    }))
  }, [items])

  const columns = useMemo(
    () => [
      tiles.filter((_, index) => index % 2 === 0),
      tiles.filter((_, index) => index % 2 === 1),
    ],
    [tiles]
  )

  return (
    <div
      aria-hidden="true"
      className="relative h-full min-h-0 overflow-hidden rounded-[32px] bg-[linear-gradient(180deg,rgba(255,250,245,0.98)_0%,rgba(247,250,252,0.9)_100%)] dark:bg-[linear-gradient(180deg,rgba(9,9,11,0.96)_0%,rgba(15,23,42,0.92)_100%)]"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[size:24px_24px] opacity-60 dark:opacity-10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(45,212,191,0.14),transparent_32%),radial-gradient(circle_at_bottom,rgba(251,191,36,0.14),transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_bottom,rgba(251,191,36,0.1),transparent_34%)]" />

      <motion.div
        animate={{ x: [0, 20, 0], y: [0, -18, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-10 top-6 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(251,146,60,0.22)_0%,rgba(251,146,60,0)_72%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(251,146,60,0.18)_0%,rgba(251,146,60,0)_72%)]"
      />
      <motion.div
        animate={{ x: [0, -24, 0], y: [0, 20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-12 right-0 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.22)_0%,rgba(45,212,191,0)_72%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(45,212,191,0.16)_0%,rgba(45,212,191,0)_72%)]"
      />

      <div className="relative flex h-full min-h-0 items-stretch overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-[#fffaf5] via-[#fffaf5]/85 to-transparent dark:from-stone-950 dark:via-stone-950/82" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-t from-[#fffaf5] via-[#fffaf5]/80 to-transparent dark:from-stone-950 dark:via-stone-950/82" />

        <div className="grid h-full w-full grid-cols-2 gap-3">
          {columns.map((column, columnIndex) => (
            <motion.div
              key={columnIndex}
              animate={{
                y: columnIndex === 0 ? [0, -170, 0] : [-120, 34, -120],
              }}
              transition={{
                duration: 22 + columnIndex * 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="flex flex-col gap-3 will-change-transform"
            >
              {[...column, ...column].map((tile, tileIndex) => (
                <PreviewTile
                  key={`${tile.id}-${columnIndex}-${tileIndex}`}
                  tile={tile}
                  index={tileIndex}
                />
              ))}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AuthOrbitPanel({ variant }: { variant: OrbitVariant }) {
  const theme = ABSTRACT_THEMES[variant]
  const gradientId = `auth-panel-${variant}`

  return (
    <div
      aria-hidden="true"
      className={cn('relative h-full min-h-[680px] overflow-hidden rounded-[32px]', theme.shellClass)}
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:26px_26px] opacity-50 dark:opacity-10" />
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-75 blur-3xl dark:opacity-45', theme.glowClass)} />

      <motion.div
        animate={{ x: [0, 26, 0], y: [0, -22, 0], scale: [1, 1.14, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        className={cn('absolute -left-14 top-10 h-52 w-52 rounded-full bg-gradient-to-br blur-3xl', theme.glowClass)}
      />
      <motion.div
        animate={{ x: [0, -30, 0], y: [0, 24, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
        className={cn('absolute bottom-0 right-0 h-60 w-60 rounded-full bg-gradient-to-br blur-3xl', theme.glowClass)}
      />
      <motion.div
        animate={{ x: [0, 18, 0], y: [0, 20, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 21, repeat: Infinity, ease: 'easeInOut' }}
        className={cn('absolute left-1/3 top-1/3 h-36 w-36 rounded-full bg-gradient-to-br opacity-70 blur-[90px] dark:opacity-35', theme.glowClass)}
      />

      <svg
        viewBox="0 0 900 1000"
        className="absolute inset-0 h-full w-full scale-[1.03]"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id={`${gradientId}-mesh`} cx="50%" cy="44%" r="66%">
            <stop offset="0%" stopColor={theme.meshStart} stopOpacity="0.72" />
            <stop offset="52%" stopColor={theme.meshMid} stopOpacity="0.42" />
            <stop offset="100%" stopColor={theme.meshEnd} stopOpacity="0.08" />
          </radialGradient>
          <linearGradient id={`${gradientId}-blob-a`} x1="10%" y1="10%" x2="90%" y2="90%">
            <stop offset="0%" stopColor={theme.blobAStart} stopOpacity="0.88" />
            <stop offset="100%" stopColor={theme.blobAEnd} stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id={`${gradientId}-blob-b`} x1="80%" y1="12%" x2="18%" y2="88%">
            <stop offset="0%" stopColor={theme.blobBStart} stopOpacity="0.74" />
            <stop offset="100%" stopColor={theme.blobBEnd} stopOpacity="0.24" />
          </linearGradient>
          <linearGradient id={`${gradientId}-blob-c`} x1="20%" y1="80%" x2="80%" y2="15%">
            <stop offset="0%" stopColor={theme.blobCStart} stopOpacity="0.64" />
            <stop offset="100%" stopColor={theme.blobCEnd} stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id={`${gradientId}-trail`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={theme.trailStart} stopOpacity="0.95" />
            <stop offset="100%" stopColor={theme.trailEnd} stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id={`${gradientId}-ribbon-a`} x1="0%" y1="10%" x2="100%" y2="90%">
            <stop offset="0%" stopColor={theme.blobAStart} stopOpacity="0.28" />
            <stop offset="48%" stopColor={theme.blobBStart} stopOpacity="0.68" />
            <stop offset="100%" stopColor={theme.blobAEnd} stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id={`${gradientId}-ribbon-b`} x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor={theme.blobCStart} stopOpacity="0.18" />
            <stop offset="52%" stopColor={theme.blobCStart} stopOpacity="0.58" />
            <stop offset="100%" stopColor={theme.blobBEnd} stopOpacity="0.14" />
          </linearGradient>
          <linearGradient id={`${gradientId}-ribbon-c`} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor={theme.blobBStart} stopOpacity="0.16" />
            <stop offset="50%" stopColor={theme.blobAStart} stopOpacity="0.54" />
            <stop offset="100%" stopColor={theme.blobCStart} stopOpacity="0.16" />
          </linearGradient>
          <linearGradient id={`${gradientId}-panel-surface`} x1="10%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={theme.trailStart} stopOpacity="0.9" />
            <stop offset="48%" stopColor={theme.blobCStart} stopOpacity="0.24" />
            <stop offset="100%" stopColor={theme.blobAEnd} stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id={`${gradientId}-panel-core`} x1="14%" y1="14%" x2="86%" y2="86%">
            <stop offset="0%" stopColor={theme.blobAStart} stopOpacity="0.72" />
            <stop offset="52%" stopColor={theme.blobBStart} stopOpacity="0.4" />
            <stop offset="100%" stopColor={theme.blobCStart} stopOpacity="0.22" />
          </linearGradient>
          <filter id={`${gradientId}-blur-large`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="34" />
          </filter>
          <filter id={`${gradientId}-blur-medium`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
          <filter id={`${gradientId}-blur-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id={`${gradientId}-panel-shadow`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="18" stdDeviation="28" floodColor={theme.blobAEnd} floodOpacity="0.18" />
          </filter>
          <filter id={`${gradientId}-grain`} x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" stitchTiles="stitch" result="noise">
              <animate attributeName="baseFrequency" values="0.72;0.78;0.72" dur="22s" repeatCount="indefinite" />
            </feTurbulence>
            <feColorMatrix
              in="noise"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 0.08 0"
            />
          </filter>
        </defs>

        <rect width="900" height="1000" fill={`url(#${gradientId}-mesh)`} />
        <rect width="900" height="1000" fill={theme.trailStart} opacity="0.28" filter={`url(#${gradientId}-grain)`} />

        <g filter={`url(#${gradientId}-blur-large)`} opacity="0.68">
          <path d={BLOB_PATHS_A[0]} fill={`url(#${gradientId}-blob-a)`}>
            <animate attributeName="d" dur="18s" repeatCount="indefinite" values={BLOB_PATHS_A.join(';')} />
          </path>
          <path d={BLOB_PATHS_B[0]} fill={`url(#${gradientId}-blob-b)`}>
            <animate attributeName="d" dur="24s" repeatCount="indefinite" values={BLOB_PATHS_B.join(';')} />
          </path>
          <path d={BLOB_PATHS_C[0]} fill={`url(#${gradientId}-blob-c)`}>
            <animate attributeName="d" dur="20s" repeatCount="indefinite" values={BLOB_PATHS_C.join(';')} />
          </path>
        </g>

        <g opacity="0.72">
          <path
            d={FLOW_PATHS_A[0]}
            fill="none"
            stroke={`url(#${gradientId}-ribbon-a)`}
            strokeWidth="122"
            strokeLinecap="round"
            filter={`url(#${gradientId}-blur-medium)`}
          >
            <animate attributeName="d" dur="22s" repeatCount="indefinite" values={FLOW_PATHS_A.join(';')} />
          </path>
          <path
            d={FLOW_PATHS_B[0]}
            fill="none"
            stroke={`url(#${gradientId}-ribbon-b)`}
            strokeWidth="108"
            strokeLinecap="round"
            filter={`url(#${gradientId}-blur-medium)`}
          >
            <animate attributeName="d" dur="26s" repeatCount="indefinite" values={FLOW_PATHS_B.join(';')} />
          </path>
          <path
            d={FLOW_PATHS_C[0]}
            fill="none"
            stroke={`url(#${gradientId}-ribbon-c)`}
            strokeWidth="96"
            strokeLinecap="round"
            filter={`url(#${gradientId}-blur-medium)`}
          >
            <animate attributeName="d" dur="18s" repeatCount="indefinite" values={FLOW_PATHS_C.join(';')} />
          </path>
        </g>

        <g opacity="0.58" filter={`url(#${gradientId}-blur-soft)`}>
          <path d={CONTOUR_PATHS_A[0]} fill="none" stroke={`url(#${gradientId}-trail)`} strokeWidth="1.3">
            <animate attributeName="d" dur="20s" repeatCount="indefinite" values={CONTOUR_PATHS_A.join(';')} />
          </path>
          <path d={CONTOUR_PATHS_B[0]} fill="none" stroke={`url(#${gradientId}-trail)`} strokeWidth="0.95" opacity="0.85">
            <animate attributeName="d" dur="24s" repeatCount="indefinite" values={CONTOUR_PATHS_B.join(';')} />
          </path>
        </g>

        <g fill="none" stroke={`url(#${gradientId}-trail)`} strokeLinecap="round" opacity="0.92">
          <path d={FLOW_PATHS_A[0]} strokeWidth="1.1" strokeDasharray="6 18">
            <animate attributeName="d" dur="22s" repeatCount="indefinite" values={FLOW_PATHS_A.join(';')} />
            <animate attributeName="stroke-dashoffset" values="0;-420" dur="18s" repeatCount="indefinite" />
          </path>
          <path d={FLOW_PATHS_B[0]} strokeWidth="1.2" strokeDasharray="5 14">
            <animate attributeName="d" dur="26s" repeatCount="indefinite" values={FLOW_PATHS_B.join(';')} />
            <animate attributeName="stroke-dashoffset" values="0;360" dur="16s" repeatCount="indefinite" />
          </path>
          <path d={FLOW_PATHS_C[0]} strokeWidth="1" strokeDasharray="4 16" opacity="0.82">
            <animate attributeName="d" dur="18s" repeatCount="indefinite" values={FLOW_PATHS_C.join(';')} />
            <animate attributeName="stroke-dashoffset" values="0;-280" dur="14s" repeatCount="indefinite" />
          </path>
          <path d={CONTOUR_PATHS_A[0]} strokeWidth="0.9" strokeDasharray="3 13" opacity="0.56">
            <animate attributeName="d" dur="20s" repeatCount="indefinite" values={CONTOUR_PATHS_A.join(';')} />
            <animate attributeName="stroke-dashoffset" values="0;220" dur="13s" repeatCount="indefinite" />
          </path>
        </g>

        <g fill={theme.particle} opacity="0.9">
          <circle r="4.8">
            <animateMotion dur="16s" repeatCount="indefinite" path={FLOW_PATHS_A[0]} />
            <animate attributeName="opacity" values="0;1;1;0" dur="16s" repeatCount="indefinite" />
          </circle>
          <circle r="4.2">
            <animateMotion dur="14s" repeatCount="indefinite" rotate="auto" path={FLOW_PATHS_B[1]} />
            <animate attributeName="opacity" values="0;0.9;0.9;0" dur="14s" repeatCount="indefinite" />
          </circle>
          <circle r="3.8">
            <animateMotion dur="12s" repeatCount="indefinite" path={FLOW_PATHS_C[2]} />
            <animate attributeName="opacity" values="0;0.8;0.8;0" dur="12s" repeatCount="indefinite" />
          </circle>
          <circle cx="244" cy="222" r="2.8">
            <animate attributeName="cy" values="222;204;222" dur="8s" repeatCount="indefinite" />
            <animate attributeName="cx" values="244;270;244" dur="11s" repeatCount="indefinite" />
          </circle>
          <circle cx="698" cy="322" r="3.4">
            <animate attributeName="cy" values="322;348;322" dur="7.5s" repeatCount="indefinite" />
            <animate attributeName="cx" values="698;672;698" dur="10s" repeatCount="indefinite" />
          </circle>
          <circle cx="626" cy="854" r="3.2">
            <animate attributeName="cy" values="854;826;854" dur="9s" repeatCount="indefinite" />
            <animate attributeName="cx" values="626;604;626" dur="12s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.22),transparent_52%)] mix-blend-screen opacity-70 dark:opacity-30" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_18%,rgba(255,255,255,0)_82%,rgba(255,255,255,0.18)_100%)] opacity-70 dark:opacity-15" />

      <div className="relative flex h-full min-h-[680px] items-center justify-center p-10">
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [-8, -4, -8], x: [-14, -4, -14] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute h-[360px] w-[300px] rounded-[48px] border border-white/28 bg-white/12 backdrop-blur-[20px] dark:border-white/10 dark:bg-white/[0.03]"
        />
        <motion.div
          animate={{ y: [0, 14, 0], rotate: [10, 5, 10], x: [16, 6, 16] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute h-[334px] w-[280px] rounded-[44px] border border-white/22 bg-white/10 backdrop-blur-[18px] dark:border-white/8 dark:bg-white/[0.025]"
        />
        <motion.div
          animate={{ y: [0, -14, 0], rotate: [0, 4, 0], scale: [1, 1.022, 1] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          className="relative h-[392px] w-[316px] overflow-hidden rounded-[52px] border border-white/34 bg-white/14 backdrop-blur-[24px] dark:border-white/12 dark:bg-white/[0.045]"
          style={{ filter: `url(#${gradientId}-panel-shadow)` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.08)_38%,rgba(255,255,255,0.04)_100%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_42%,rgba(255,255,255,0.02)_100%)]" />
          <div className="absolute inset-6 rounded-[42px] border border-white/22 dark:border-white/8" />
          <div className="absolute left-8 right-8 top-8 h-24 rounded-[30px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.5),transparent_68%)] opacity-85 dark:opacity-28" />
          <div className="absolute bottom-8 left-8 right-8 h-24 rounded-[32px] bg-[radial-gradient(circle_at_bottom,rgba(255,255,255,0.32),transparent_70%)] opacity-70 dark:opacity-18" />

          <svg viewBox="0 0 316 392" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id={`${gradientId}-panel-trace`} x1="10%" y1="10%" x2="90%" y2="90%">
                <stop offset="0%" stopColor={theme.trailStart} stopOpacity="0.9" />
                <stop offset="100%" stopColor={theme.trailEnd} stopOpacity="0.18" />
              </linearGradient>
            </defs>
            <g filter={`url(#${gradientId}-blur-soft)`} opacity="0.95">
              <path d={CORE_PATHS_B[0]} fill={`url(#${gradientId}-panel-surface)`}>
                <animate attributeName="d" dur="18s" repeatCount="indefinite" values={CORE_PATHS_B.join(';')} />
              </path>
              <path d={CORE_PATHS_A[0]} fill={`url(#${gradientId}-panel-core)`}>
                <animate attributeName="d" dur="14s" repeatCount="indefinite" values={CORE_PATHS_A.join(';')} />
              </path>
            </g>

            <g fill="none" stroke={`url(#${gradientId}-panel-trace)`} strokeLinecap="round">
              <path d="M72 268 C118 208 182 182 234 202 C286 222 314 280 290 328 C266 376 202 392 142 372 C82 352 48 300 72 268 Z" strokeWidth="1.3" strokeDasharray="6 12">
                <animate attributeName="stroke-dashoffset" values="0;180" dur="12s" repeatCount="indefinite" />
              </path>
              <path d="M84 140 C126 100 182 84 230 96 C278 108 312 152 312 204 C312 256 280 302 230 326 C180 350 120 344 82 308 C44 272 42 180 84 140 Z" strokeWidth="1.05" opacity="0.8">
                <animateTransform attributeName="transform" type="rotate" from="0 158 196" to="360 158 196" dur="30s" repeatCount="indefinite" />
              </path>
              <path d="M62 214 C96 154 158 122 220 128 C282 134 332 184 338 248 C344 312 302 370 238 394 C174 418 96 400 58 346 C20 292 28 274 62 214 Z" strokeWidth="0.9" opacity="0.55" strokeDasharray="4 14">
                <animate attributeName="stroke-dashoffset" values="0;-200" dur="16s" repeatCount="indefinite" />
              </path>
            </g>

            <g fill={theme.particle} opacity="0.9">
              <circle r="3.4">
                <animateMotion dur="10s" repeatCount="indefinite" path="M86 284 C120 238 178 220 230 230 C282 240 300 282 276 320 C252 358 192 366 140 344 C88 322 62 316 86 284 Z" />
                <animate attributeName="opacity" values="0;1;1;0" dur="10s" repeatCount="indefinite" />
              </circle>
              <circle r="2.8">
                <animateMotion dur="12s" repeatCount="indefinite" path="M94 156 C130 122 176 108 220 116 C264 124 294 158 302 206 C310 254 288 304 242 326 C196 348 134 340 96 304 C58 268 58 190 94 156 Z" />
                <animate attributeName="opacity" values="0;0.85;0.85;0" dur="12s" repeatCount="indefinite" />
              </circle>
            </g>
          </svg>
        </motion.div>
      </div>
    </div>
  )
}
