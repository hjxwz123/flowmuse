/**
 * 个人中心内容组件
 * 聚合用户资料、我的作品、我的收藏与账号设置。
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Download,
  Eye,
  Globe2,
  Heart,
  Hourglass,
  Image as ImageIcon,
  Lock,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  UserCog,
  Video,
  WandSparkles,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button, MagicInput, Skeleton } from '@/components/ui'
import { PageTransition } from '@/components/shared/PageTransition'
import { FadeIn } from '@/components/shared/FadeIn'
import { galleryService, userService } from '@/lib/api/services'
import type { ApiTask, FavoriteRecord, UserProfile } from '@/lib/api/types'
import { useAuthStore } from '@/lib/store/authStore'
import { cn } from '@/lib/utils/cn'

type CenterTab = 'works' | 'favorites' | 'profile'
type WorkFilter = 'all' | 'image' | 'video' | 'public' | 'private' | 'pending'
type FavoriteFilter = 'all' | 'image' | 'video'
type SortOption = 'newest' | 'oldest'

type GalleryMetrics = {
  worksTotal: number
  favoritesTotal: number
  publicTotal: number
  imageTotal: number
  videoTotal: number
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString(locale === 'zh-CN' ? 'zh-CN' : 'en-US')
}

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTaskPreview(task: ApiTask) {
  if (task.type === 'video' && !task.thumbnailUrl && task.resultUrl) {
    return { kind: 'video' as const, src: task.resultUrl }
  }

  return {
    kind: 'image' as const,
    src: task.thumbnailUrl || task.resultUrl || '',
  }
}

function getDisplayName(profile: UserProfile) {
  return profile.username?.trim() || profile.email.split('@')[0] || 'Creator'
}

function sortByDate<T extends { createdAt: string }>(items: T[], sort: SortOption) {
  const sorted = [...items].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime()
    const rightTime = new Date(right.createdAt).getTime()
    return rightTime - leftTime
  })

  return sort === 'oldest' ? sorted.reverse() : sorted
}

function CenterSkeleton() {
  return (
    <PageTransition className="min-h-screen w-full max-w-full overflow-x-hidden bg-canvas px-3 py-6 text-stone-950 dark:bg-canvas-dark dark:text-stone-100 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px] min-w-0 space-y-6 sm:space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-full max-w-72" />
        </div>
        <div className="grid min-w-0 gap-5 sm:gap-8 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-3">
            <div className="max-w-full rounded-2xl border border-stone-200 bg-stone-50/80 p-4 dark:border-white/10 dark:bg-stone-900/90 sm:p-6">
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="mt-5 h-5 w-36" />
              <Skeleton className="mt-3 h-4 w-44" />
              <Skeleton className="mt-6 h-32 w-full" />
            </div>
          </div>
          <div className="min-w-0 space-y-5 sm:space-y-6 lg:col-span-9">
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}

function TypeBadge({
  type,
  label,
}: {
  type: ApiTask['type']
  label: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm',
        type === 'video' ? 'bg-aurora-purple' : 'bg-stone-950/65'
      )}
    >
      {type === 'video' ? <Video className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
      {label}
    </span>
  )
}

function VisibilityBadge({
  task,
  labels,
}: {
  task: ApiTask
  labels: { public: string; private: string; pending: string }
}) {
  if (task.publicModerationStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 backdrop-blur-sm dark:text-amber-300">
        <Hourglass className="h-2.5 w-2.5" />
        {labels.pending}
      </span>
    )
  }

  if (task.isPublic || task.publicModerationStatus === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 backdrop-blur-sm dark:text-emerald-300">
        <Globe2 className="h-2.5 w-2.5" />
        {labels.public}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-stone-400/25 bg-stone-900/10 px-1.5 py-0.5 text-[10px] font-medium text-stone-500 backdrop-blur-sm dark:bg-stone-100/10 dark:text-stone-300">
      <Lock className="h-2.5 w-2.5" />
      {labels.private}
    </span>
  )
}

function GalleryCard({
  task,
  locale,
  typeLabel,
  labels,
  downloadLabel,
}: {
  task: ApiTask
  locale: string
  typeLabel: string
  labels: { public: string; private: string; pending: string; untitled: string; view: string }
  downloadLabel: string
}) {
  const preview = getTaskPreview(task)
  const href = `/${locale}/gallery/${task.type}/${task.id}`

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_18px_42px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-stone-900 dark:hover:border-white/20 dark:hover:shadow-none">
      <Link href={href} className="block">
        <div className="relative aspect-square overflow-hidden bg-stone-100 dark:bg-stone-900">
          {preview.src ? (
            preview.kind === 'video' ? (
              <video
                src={preview.src}
                poster={task.thumbnailUrl || undefined}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={preview.src}
                alt={task.prompt || labels.untitled}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center text-stone-400">
              {task.type === 'video' ? <Video className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
            </div>
          )}

          <div className="absolute left-2 top-2">
            <TypeBadge type={task.type} label={typeLabel} />
          </div>
          <div className="absolute right-2 top-2">
            <VisibilityBadge task={task} labels={labels} />
          </div>
        </div>

        <div className="p-3">
          <p className="line-clamp-2 min-h-[2.5rem] break-words text-xs leading-5 text-stone-700 dark:text-stone-200">
            {task.prompt || labels.untitled}
          </p>
          <div className="mt-3 flex min-w-0 items-center justify-between border-t border-stone-100 pt-2 text-[10px] text-stone-400 dark:border-stone-800">
            <span className="min-w-0 truncate">{formatDateTime(task.createdAt, locale)}</span>
          </div>
        </div>
      </Link>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-stone-950/76 p-4 opacity-0 transition-opacity duration-300 group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="flex justify-end gap-1.5">
          <Link
            href={href}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/12 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            aria-label={labels.view}
          >
            <Eye className="h-4 w-4" />
          </Link>
        </div>
        <div>
          {task.resultUrl ? (
            <a
              href={task.resultUrl}
              download
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-stone-950 transition-colors hover:bg-stone-100"
            >
              <Download className="h-3.5 w-3.5" />
              {downloadLabel}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function FavoriteCard({
  favorite,
  locale,
  labels,
}: {
  favorite: FavoriteRecord
  locale: string
  labels: { image: string; video: string; untitled: string; view: string; favorite: string }
}) {
  const task = favorite.item
  const preview = getTaskPreview(task)
  const href = `/${locale}/gallery/${favorite.targetType}/${favorite.targetId}`

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_18px_42px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-stone-900 dark:hover:border-white/20 dark:hover:shadow-none">
      <Link href={href} className="block">
        <div className="relative aspect-square overflow-hidden bg-stone-100 dark:bg-stone-900">
          {preview.src ? (
            preview.kind === 'video' ? (
              <video
                src={preview.src}
                poster={task.thumbnailUrl || undefined}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={preview.src}
                alt={task.prompt || labels.untitled}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center text-stone-400">
              {favorite.targetType === 'video' ? <Video className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
            </div>
          )}
          <div className="absolute left-2 top-2">
            <TypeBadge type={favorite.targetType} label={favorite.targetType === 'video' ? labels.video : labels.image} />
          </div>
          <div className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-aurora-purple/90 text-white backdrop-blur-sm">
            <Heart className="h-3.5 w-3.5 fill-current" />
          </div>
        </div>

        <div className="p-3">
          <div className="mb-2 flex min-w-0 items-center justify-between gap-2 text-[10px] text-stone-400">
            <span className="shrink-0">{labels.favorite}</span>
            <span className="min-w-0 truncate">{formatDate(favorite.createdAt, locale)}</span>
          </div>
          <p className="line-clamp-2 min-h-[2.5rem] break-words text-xs leading-5 text-stone-700 dark:text-stone-200">
            {task.prompt || labels.untitled}
          </p>
        </div>
      </Link>

      <div className="pointer-events-none absolute inset-0 flex items-start justify-end bg-stone-950/72 p-4 opacity-0 transition-opacity duration-300 group-hover:pointer-events-auto group-hover:opacity-100">
        <Link
          href={href}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/12 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          aria-label={labels.view}
        >
          <Eye className="h-4 w-4" />
        </Link>
      </div>
    </article>
  )
}

export function ProfileContent() {
  const t = useTranslations('dashboard.profile')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const { isAuthenticated, updateUser } = useAuthStore()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [works, setWorks] = useState<ApiTask[]>([])
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([])
  const [metrics, setMetrics] = useState<GalleryMetrics>({
    worksTotal: 0,
    favoritesTotal: 0,
    publicTotal: 0,
    imageTotal: 0,
    videoTotal: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [activeTab, setActiveTab] = useState<CenterTab>('works')
  const [workFilter, setWorkFilter] = useState<WorkFilter>('all')
  const [favoriteFilter, setFavoriteFilter] = useState<FavoriteFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('newest')
  const [username, setUsername] = useState('')
  const [editError, setEditError] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/${locale}/auth/login`)
    }
  }, [isAuthenticated, locale, router])

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return

    setIsLoading(true)
    try {
      const [profileData, imagePage, videoPage, favoritePage] = await Promise.all([
        userService.getProfile(),
        galleryService.getMyImages({ page: 1, limit: 12 }),
        galleryService.getMyVideos({ page: 1, limit: 12 }),
        galleryService.getMyFavorites({ page: 1, limit: 12 }),
      ])

      const completedImages = imagePage.data.filter((item) => item.status === 'completed')
      const completedVideos = videoPage.data.filter((item) => item.status === 'completed')
      const nextWorks = sortByDate([...completedImages, ...completedVideos], 'newest')
      const nextFavorites = favoritePage.data.filter((item) => item.item?.status === 'completed')

      setProfile(profileData)
      setUsername(profileData.username)
      setWorks(nextWorks)
      setFavorites(nextFavorites)
      setMetrics({
        worksTotal: imagePage.pagination.total + videoPage.pagination.total,
        favoritesTotal: favoritePage.pagination.total,
        publicTotal: nextWorks.filter((item) => item.isPublic || item.publicModerationStatus === 'approved').length,
        imageTotal: imagePage.pagination.total,
        videoTotal: videoPage.pagination.total,
      })
    } catch (err) {
      console.error('Failed to load personal center:', err)
      toast.error(t('loadFailed'))
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredWorks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = works.filter((item) => {
      if (workFilter === 'image' && item.type !== 'image') return false
      if (workFilter === 'video' && item.type !== 'video') return false
      if (workFilter === 'public' && !(item.isPublic || item.publicModerationStatus === 'approved')) return false
      if (workFilter === 'private' && (item.isPublic || item.publicModerationStatus === 'approved')) return false
      if (workFilter === 'pending' && item.publicModerationStatus !== 'pending') return false
      if (query && !item.prompt.toLowerCase().includes(query)) return false
      return true
    })

    return sortByDate(filtered, sortOption)
  }, [searchQuery, sortOption, workFilter, works])

  const filteredFavorites = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = favorites.filter((favorite) => {
      if (favoriteFilter === 'image' && favorite.targetType !== 'image') return false
      if (favoriteFilter === 'video' && favorite.targetType !== 'video') return false
      if (query && !favorite.item.prompt.toLowerCase().includes(query)) return false
      return true
    })

    return sortByDate(filtered, sortOption)
  }, [favoriteFilter, favorites, searchQuery, sortOption])

  const recentWorks = useMemo(() => sortByDate(works, 'newest').slice(0, 7), [works])

  const handleSaveProfile = async () => {
    if (!profile) return

    setEditError('')
    setIsSaving(true)

    try {
      const updatedProfile = await userService.updateProfile({
        username: username !== profile.username ? username : undefined,
      })
      setProfile(updatedProfile)
      updateUser({ username: updatedProfile.username })
      toast.success(t('saveSuccess'))
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : t('saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('avatarTooLarge'))
      return
    }

    setIsUploadingAvatar(true)
    try {
      const result = await userService.uploadAvatar(file)
      if (profile) setProfile({ ...profile, avatar: result.avatar })
      updateUser({ avatar: result.avatar })
      toast.success(t('uploadSuccess'))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('uploadFailed'))
    } finally {
      setIsUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handleChangePassword = async () => {
    setPasswordError('')

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('passwordRequired'))
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordMismatch'))
      return
    }

    if (newPassword.length < 6) {
      setPasswordError(t('passwordTooShort'))
      return
    }

    setIsChangingPassword(true)

    try {
      await userService.updatePassword({ oldPassword, newPassword })
      toast.success(t('passwordChanged'))
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : t('passwordChangeFailed'))
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (!isAuthenticated) return null
  if (isLoading || !profile) return <CenterSkeleton />

  const displayName = getDisplayName(profile)
  const membershipActive = profile.membership?.isActive === true
  const membershipLabel = membershipActive
    ? locale === 'en-US'
      ? profile.membership?.levelNameEn || profile.membership?.levelName || t('memberActive')
      : profile.membership?.levelName || t('memberActive')
    : t('memberInactive')
  const membershipColor = membershipActive ? profile.membership?.color || undefined : undefined
  const dailyCredits = profile.membership?.dailyCredits ?? 0
  const membershipProgress = membershipActive ? 100 : 0
  const hasUsernameChanged = username.trim() !== '' && username !== profile.username

  const workFilterOptions: Array<{ value: WorkFilter; label: string }> = [
    { value: 'all', label: t('filters.all') },
    { value: 'image', label: t('filters.images') },
    { value: 'video', label: t('filters.videos') },
    { value: 'public', label: t('filters.public') },
    { value: 'private', label: t('filters.private') },
    { value: 'pending', label: t('filters.pending') },
  ]
  const favoriteFilterOptions: Array<{ value: FavoriteFilter; label: string }> = [
    { value: 'all', label: t('filters.allFavorites') },
    { value: 'image', label: t('filters.images') },
    { value: 'video', label: t('filters.videos') },
  ]

  return (
    <PageTransition className="min-h-screen w-full max-w-full overflow-x-hidden bg-canvas px-3 py-6 text-stone-950 dark:bg-canvas-dark dark:text-stone-100 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px] min-w-0 space-y-6 sm:space-y-8">
        <FadeIn variant="slide">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words font-display text-3xl font-bold tracking-tight text-stone-950 dark:text-stone-50 sm:text-4xl">
                {t('centerTitle')}
              </h1>
              <span className="rounded-full border border-stone-200 bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500 dark:border-stone-800 dark:bg-stone-900/80 dark:text-stone-400">
                {t('centerBadge')}
              </span>
            </div>
            <p className="mt-2 max-w-full break-words font-ui text-sm text-stone-500 dark:text-stone-400">{t('centerSubtitle')}</p>
          </div>
        </FadeIn>

        <div className="grid min-w-0 gap-5 sm:gap-8 lg:grid-cols-12 lg:items-start">
          <aside className="min-w-0 lg:sticky lg:top-24 lg:col-span-3">
            <FadeIn variant="scale" delay={0.05}>
              <section className="relative max-w-full overflow-hidden rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-canvas backdrop-blur-sm dark:border-white/10 dark:bg-stone-900/90 dark:shadow-none sm:p-6">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_30%_10%,rgb(var(--aurora-purple)/0.22),transparent_48%),radial-gradient(circle_at_80%_18%,rgb(var(--aurora-purple)/0.14),transparent_42%)]" />

                <div className="relative z-10">
                  <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="group relative h-20 w-20 overflow-hidden rounded-full border-2 border-white bg-aurora-purple text-white shadow-lg outline-none transition-transform hover:scale-[1.03] focus:ring-2 focus:ring-aurora-purple focus:ring-offset-2 focus:ring-offset-white dark:border-stone-950 dark:focus:ring-offset-stone-950"
                      aria-label={t('uploadAvatar')}
                    >
                      {profile.avatar ? (
                        <Image src={profile.avatar} alt={t('avatar')} fill className="object-cover transition-transform duration-300 group-hover:scale-110" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-display text-3xl font-semibold">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-stone-950/48 opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera className="h-5 w-5" />
                      </span>
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />

                    <div className="w-full min-w-0">
                      <div className="flex min-w-0 items-center justify-center gap-2 lg:justify-start">
                        <h2 className="min-w-0 max-w-full truncate font-display text-xl font-bold text-stone-950 dark:text-stone-50">
                          {displayName}
                        </h2>
                        {profile.emailVerified ? (
                          <CheckCircle2 className="h-4 w-4 flex-none text-emerald-500" aria-label={t('emailVerified')} />
                        ) : null}
                      </div>
                      <p className="mt-1 max-w-full truncate text-xs text-stone-500 dark:text-stone-400">{profile.email}</p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3 rounded-xl border border-stone-200 bg-stone-50/70 p-4 dark:border-white/10 dark:bg-stone-950/60">
                    <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-stone-500 dark:text-stone-400">{t('membershipLevel')}</span>
                      <span
                        className="shrink-0 truncate rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
                        style={membershipColor ? { backgroundColor: membershipColor } : undefined}
                      >
                        {membershipLabel}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-stone-500 dark:text-stone-400">{t('permanentCredits')}</span>
                      <span className="shrink-0 font-semibold text-stone-900 dark:text-stone-100">{profile.permanentCredits}</span>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-stone-500 dark:text-stone-400">{t('dailyCredits')}</span>
                      <span className="shrink-0 font-semibold text-stone-900 dark:text-stone-100">
                        {dailyCredits > 0 ? dailyCredits : '-'}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                      <div className="h-full rounded-full bg-aurora-purple transition-all" style={{ width: `${membershipProgress}%` }} />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3">
                    <Button className="min-w-0 rounded-xl px-2 py-2 text-xs sm:px-3" onClick={() => router.push(`/${locale}/create`)}>
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <WandSparkles className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 truncate">{t('startCreate')}</span>
                      </span>
                    </Button>
                    <Button
                      variant="secondary"
                      className="min-w-0 rounded-xl px-2 py-2 text-xs sm:px-3"
                      onClick={() => router.push(`/${locale}/packages`)}
                    >
                      <Zap className="mr-1.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="min-w-0 truncate">{t('recharge')}</span>
                    </Button>
                  </div>

                  <div className="mt-5 flex min-w-0 flex-col items-start gap-2 border-t border-stone-100 pt-4 text-[11px] text-stone-400 dark:border-stone-800 sm:flex-row sm:items-center sm:justify-between">
                    <span className="max-w-full break-words">{t('joinedAt', { date: formatDate(profile.createdAt, locale) })}</span>
                    <Link href={`/${locale}/terms`} className="transition-colors hover:text-aurora-purple">
                      {t('terms')}
                    </Link>
                  </div>
                </div>
              </section>
            </FadeIn>
          </aside>

          <section className="min-w-0 space-y-5 sm:space-y-6 lg:col-span-9">
            <FadeIn variant="scale" delay={0.1}>
              <section className="grid min-w-0 gap-5 rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-canvas backdrop-blur-sm dark:border-white/10 dark:bg-stone-900/90 dark:shadow-none sm:p-5 md:grid-cols-12 md:gap-6 md:p-6">
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 md:col-span-5">
                  {[
                    { label: t('stats.works'), value: metrics.worksTotal, hint: t('stats.imageVideo', { images: metrics.imageTotal, videos: metrics.videoTotal }), icon: Palette },
                    { label: t('stats.favorites'), value: metrics.favoritesTotal, hint: t('stats.flatManage'), icon: Heart },
                    { label: t('stats.public'), value: metrics.publicTotal, hint: t('stats.galleryVisible'), icon: Globe2 },
                    { label: t('stats.credits'), value: profile.permanentCredits, hint: t('stats.available'), icon: CreditCard },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.label} className="min-w-0 rounded-xl border border-stone-200 bg-stone-50/75 p-3 dark:border-white/10 dark:bg-stone-950/55 sm:p-4">
                        <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
                          <span className="min-w-0 truncate text-xs text-stone-500 dark:text-stone-400">{item.label}</span>
                          <Icon className="h-4 w-4 text-aurora-purple" />
                        </div>
                        <div className="mt-2 break-words font-display text-xl font-bold text-stone-950 dark:text-stone-50 sm:text-2xl">{item.value}</div>
                        <div className="mt-1 break-words text-[10px] text-stone-500 dark:text-stone-400">{item.hint}</div>
                      </div>
                    )
                  })}
                </div>

                <div className="min-w-0 flex flex-col justify-between md:col-span-7">
                  <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">{t('recent.title')}</p>
                      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t('recent.subtitle')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('works')}
                      className="text-xs font-medium text-aurora-purple transition-colors hover:text-aurora-purple-hover"
                    >
                      {t('recent.manage')}
                    </button>
                  </div>

                  <div className="flex max-w-full min-w-0 gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {recentWorks.length > 0 ? (
                      recentWorks.map((item) => {
                        const preview = getTaskPreview(item)
                        return (
                          <Link
                            key={`${item.type}-${item.id}`}
                            href={`/${locale}/gallery/${item.type}/${item.id}`}
                            className="relative h-20 w-20 flex-none overflow-hidden rounded-xl border border-stone-200 bg-stone-100 transition-transform hover:scale-[1.03] dark:border-stone-800 dark:bg-stone-900"
                          >
                            {preview.src ? (
                              preview.kind === 'video' ? (
                                <video src={preview.src} poster={item.thumbnailUrl || undefined} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                              ) : (
                                <img src={preview.src} alt={item.prompt || t('labels.untitled')} className="h-full w-full object-cover" loading="lazy" />
                              )
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-stone-400">
                                {item.type === 'video' ? <Video className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                              </div>
                            )}
                            <span className="absolute bottom-1 right-1 rounded bg-stone-950/70 px-1.5 py-0.5 text-[9px] text-white">
                              {item.type === 'video' ? t('labels.video') : t('labels.image')}
                            </span>
                          </Link>
                        )
                      })
                    ) : (
                      <div className="flex h-20 w-full items-center justify-center rounded-xl border border-dashed border-stone-300 text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
                        {t('recent.empty')}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </FadeIn>

            <div className="max-w-full min-w-0 rounded-2xl border border-stone-200 bg-white/90 p-2 shadow-canvas backdrop-blur-sm dark:border-white/10 dark:bg-stone-900/90 dark:shadow-none">
              <div className="min-w-0">
                <div className="grid w-full min-w-0 grid-cols-3 rounded-xl bg-stone-100 p-1 dark:bg-stone-950/70">
                  {[
                    { value: 'works' as CenterTab, label: t('tabs.works'), icon: Palette },
                    { value: 'favorites' as CenterTab, label: t('tabs.favorites'), icon: Heart },
                    { value: 'profile' as CenterTab, label: t('tabs.profile'), icon: UserCog },
                  ].map((item) => {
                    const Icon = item.icon
                    const active = activeTab === item.value
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setActiveTab(item.value)}
                        className={cn(
                          'inline-flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:text-sm',
                          active
                            ? 'bg-white text-stone-950 dark:bg-aurora-purple dark:text-stone-950'
                            : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                        <span className="min-w-0 truncate">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {activeTab !== 'profile' ? (
              <FadeIn variant="fade" delay={0.1}>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white/90 p-3 shadow-canvas backdrop-blur-sm dark:border-white/10 dark:bg-stone-900/90 dark:shadow-none sm:p-3.5">
                  <div className="flex min-w-0 flex-wrap gap-2">
                    {(activeTab === 'works' ? workFilterOptions : favoriteFilterOptions).map((option) => {
                      const isActive = activeTab === 'works'
                        ? workFilter === option.value
                        : favoriteFilter === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            if (activeTab === 'works') setWorkFilter(option.value as WorkFilter)
                            else setFavoriteFilter(option.value as FavoriteFilter)
                          }}
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                            isActive
                              ? 'border-aurora-purple/25 bg-aurora-purple/10 text-aurora-purple'
                              : 'border-transparent text-stone-500 hover:border-stone-200 hover:bg-stone-100 dark:text-stone-400 dark:hover:border-white/10 dark:hover:bg-stone-950/70'
                          )}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <div className="relative min-w-0 flex-1 sm:w-56">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                      <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={activeTab === 'works' ? t('search.works') : t('search.favorites')}
                        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 pl-8 text-xs text-stone-800 outline-none transition-colors placeholder:text-stone-400 focus:border-aurora-purple/60 dark:border-white/10 dark:bg-stone-950/70 dark:text-stone-100 dark:placeholder:text-stone-500"
                      />
                    </div>
                    <select
                      value={sortOption}
                      onChange={(event) => setSortOption(event.target.value as SortOption)}
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 outline-none transition-colors focus:border-aurora-purple/60 dark:border-white/10 dark:bg-stone-950/70 dark:text-stone-200 dark:[color-scheme:dark] sm:w-auto"
                    >
                      <option value="newest">{t('sort.newest')}</option>
                      <option value="oldest">{t('sort.oldest')}</option>
                    </select>
                  </div>
                </div>
              </FadeIn>
            ) : null}

            {activeTab === 'works' ? (
              filteredWorks.length > 0 ? (
                <FadeIn variant="fade" delay={0.12}>
                  <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {filteredWorks.map((item) => (
                      <GalleryCard
                        key={`${item.type}-${item.id}`}
                        task={item}
                        locale={locale}
                        typeLabel={item.type === 'video' ? t('labels.video') : t('labels.image')}
                        labels={{
                          public: t('labels.public'),
                          private: t('labels.private'),
                          pending: t('labels.pending'),
                          untitled: t('labels.untitled'),
                          view: t('actions.view'),
                        }}
                        downloadLabel={item.type === 'video' ? t('actions.downloadVideo') : t('actions.download')}
                      />
                    ))}
                  </div>
                </FadeIn>
              ) : (
                <EmptyPanel
                  title={t('empty.worksTitle')}
                  description={t('empty.worksDescription')}
                  actionLabel={t('startCreate')}
                  href={`/${locale}/create`}
                />
              )
            ) : null}

            {activeTab === 'favorites' ? (
              filteredFavorites.length > 0 ? (
                <FadeIn variant="fade" delay={0.12}>
                  <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {filteredFavorites.map((favorite) => (
                      <FavoriteCard
                        key={`${favorite.targetType}-${favorite.targetId}`}
                        favorite={favorite}
                        locale={locale}
                        labels={{
                          image: t('labels.image'),
                          video: t('labels.video'),
                          untitled: t('labels.untitled'),
                          view: t('actions.view'),
                          favorite: t('labels.favoriteAt'),
                        }}
                      />
                    ))}
                  </div>
                </FadeIn>
              ) : (
                <EmptyPanel
                  title={t('empty.favoritesTitle')}
                  description={t('empty.favoritesDescription')}
                  actionLabel={t('exploreGallery')}
                  href={`/${locale}/gallery`}
                />
              )
            ) : null}

            {activeTab === 'profile' ? (
              <FadeIn variant="fade" delay={0.12}>
                <div className="space-y-6">
                  <section className="max-w-full rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-canvas backdrop-blur-sm dark:border-white/10 dark:bg-stone-900/90 dark:shadow-none sm:p-6">
                    <SectionTitle title={t('sections.basic')} note={t('sections.basicNote')} />

                    <div className="mt-6 grid min-w-0 gap-5 md:grid-cols-2 md:gap-6">
                      <MagicInput
                        label={t('username')}
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        placeholder={t('username')}
                        className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm dark:border-white/10 dark:bg-stone-950/70"
                      />
                      <div>
                        <label className="mb-2 block font-ui text-sm font-medium text-stone-700 dark:text-stone-300">
                          {t('email')}
                        </label>
                        <div className="relative min-w-0">
                          <input
                            readOnly
                            value={profile.email}
                            className="w-full min-w-0 cursor-not-allowed rounded-xl border border-stone-200 bg-stone-100/70 px-4 py-2.5 text-sm text-stone-500 outline-none dark:border-white/10 dark:bg-stone-950/60 dark:text-stone-400 sm:pr-24"
                          />
                          <span className={cn(
                            'mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:absolute sm:right-3 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2',
                            profile.emailVerified
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                              : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                          )}>
                            {profile.emailVerified ? t('emailVerified') : t('emailUnverified')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {editError ? <p className="mt-4 text-sm text-red-600 dark:text-red-400">{editError}</p> : null}

                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={handleSaveProfile}
                        isLoading={isSaving}
                        disabled={isSaving || !hasUsernameChanged}
                        className="rounded-xl px-5 py-2 text-sm"
                      >
                        {tCommon('actions.save')}
                      </Button>
                    </div>
                  </section>

                  <section className="max-w-full rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-canvas backdrop-blur-sm dark:border-white/10 dark:bg-stone-900/90 dark:shadow-none sm:p-6">
                    <SectionTitle title={t('sections.account')} />
                    <div className="mt-6 grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                      {[
                        { label: t('statusLabel'), value: profile.status, tone: 'text-emerald-600 dark:text-emerald-300' },
                        { label: t('roleLabel'), value: profile.role, tone: 'text-stone-900 dark:text-stone-100' },
                        { label: t('membershipLevel'), value: membershipLabel, tone: 'text-aurora-purple' },
                        { label: t('membershipExpire'), value: membershipActive ? formatDate(profile.membership?.expireAt ?? null, locale) : '-', tone: 'text-stone-900 dark:text-stone-100' },
                      ].map((item) => (
                        <div key={item.label} className="min-w-0 rounded-xl border border-stone-200 bg-stone-50/70 p-3 text-center dark:border-white/10 dark:bg-stone-950/55 sm:p-4">
                          <div className="text-[10px] text-stone-500 dark:text-stone-400">{item.label}</div>
                          <div className={cn('mt-1 break-words text-xs font-bold', item.tone)}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="max-w-full rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-canvas backdrop-blur-sm dark:border-white/10 dark:bg-stone-900/90 dark:shadow-none sm:p-6">
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm((value) => !value)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <SectionTitle title={t('sections.security')} compact />
                      <ChevronDown className={cn('h-5 w-5 text-stone-400 transition-transform', showPasswordForm && 'rotate-180')} />
                    </button>

                    <div
                      className={cn(
                        'grid transition-[grid-template-rows] duration-300 ease-out',
                        showPasswordForm ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="mt-6 border-t border-stone-100 pt-6 dark:border-white/10">
                          <div className="grid min-w-0 gap-4 md:grid-cols-3">
                            <MagicInput
                              label={t('oldPassword')}
                              type="password"
                              value={oldPassword}
                              onChange={(event) => setOldPassword(event.target.value)}
                              placeholder={t('oldPassword')}
                              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm dark:border-white/10 dark:bg-stone-950/70"
                            />
                            <MagicInput
                              label={t('newPassword')}
                              type="password"
                              value={newPassword}
                              onChange={(event) => setNewPassword(event.target.value)}
                              placeholder={t('newPassword')}
                              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm dark:border-white/10 dark:bg-stone-950/70"
                            />
                            <MagicInput
                              label={t('confirmPassword')}
                              type="password"
                              value={confirmPassword}
                              onChange={(event) => setConfirmPassword(event.target.value)}
                              placeholder={t('confirmPassword')}
                              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm dark:border-white/10 dark:bg-stone-950/70"
                            />
                          </div>

                          {passwordError ? <p className="mt-4 text-sm text-red-600 dark:text-red-400">{passwordError}</p> : null}

                          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setShowPasswordForm(false)
                                setOldPassword('')
                                setNewPassword('')
                                setConfirmPassword('')
                                setPasswordError('')
                              }}
                              className="rounded-xl px-5 py-2 text-sm"
                            >
                              {tCommon('actions.cancel')}
                            </Button>
                            <Button
                              onClick={handleChangePassword}
                              isLoading={isChangingPassword}
                              disabled={isChangingPassword}
                              className="rounded-xl px-5 py-2 text-sm"
                            >
                              <ShieldCheck className="mr-1.5 h-4 w-4" />
                              {t('submitPassword')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </FadeIn>
            ) : null}
          </section>
        </div>
      </div>
    </PageTransition>
  )
}

function SectionTitle({
  title,
  note,
  compact = false,
}: {
  title: string
  note?: string
  compact?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-2 border-b border-stone-100 pb-3 dark:border-stone-800 sm:flex-row sm:items-center sm:justify-between sm:gap-4', compact && 'border-b-0 pb-0')}>
      <h3 className="flex min-w-0 items-center gap-2 break-words text-sm font-bold text-stone-950 dark:text-stone-50">
        <span className="h-3 w-1.5 rounded-full bg-aurora-purple" />
        {title}
      </h3>
      {note ? <span className="max-w-full break-words text-[10px] text-stone-400">{note}</span> : null}
    </div>
  )
}

function EmptyPanel({
  title,
  description,
  actionLabel,
  href,
}: {
  title: string
  description: string
  actionLabel: string
  href: string
}) {
  return (
    <FadeIn variant="fade" delay={0.12}>
      <div className="max-w-full rounded-2xl border border-dashed border-stone-300 bg-white/60 p-6 text-center dark:border-stone-700 dark:bg-stone-950/50 sm:p-10">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-aurora-purple/10 text-aurora-purple">
          <Sparkles className="h-5 w-5" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-stone-950 dark:text-stone-50">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-500 dark:text-stone-400">{description}</p>
        <Link href={href} className="mt-5 inline-flex items-center justify-center rounded-full bg-aurora-purple px-5 py-2 text-sm font-medium text-white shadow-canvas transition-all hover:bg-aurora-purple-hover">
          {actionLabel}
        </Link>
      </div>
    </FadeIn>
  )
}
