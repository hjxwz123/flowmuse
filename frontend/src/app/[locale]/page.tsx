import { setRequestLocale } from 'next-intl/server'

import { LandingHomePage } from '@/components/features/home/LandingHomePage'
import type { ApiTask } from '@/lib/api/types'

type SiteSettingsSnapshot = {
  registrationEnabled?: boolean
  siteTitle?: string
  siteIcon?: string
  siteFooter?: string
  homeTopMarqueeText?: string
  homeHeroImageUrls?: string
  homeHeroVideoUrl?: string
}

type PublicFeedSnapshot = {
  data: ApiTask[]
  pagination: {
    page: number
    limit: number
    hasMore: boolean
  }
}

export const dynamic = 'force-static'
export const revalidate = 60

const HOME_PUBLIC_GALLERY_PAGE_SIZE = 12

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(obj: Record<string, unknown>, key: string): string | undefined {
  return typeof obj[key] === 'string' ? obj[key] : undefined
}

function readBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
  return typeof obj[key] === 'boolean' ? obj[key] : undefined
}

async function resolveApiBase() {
  const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api'
  if (/^https?:\/\//i.test(configuredApiBase)) {
    return configuredApiBase.replace(/\/+$/, '')
  }

  const backendBase = process.env.BACKEND_URL || 'http://127.0.0.1:3000'
  return `${backendBase.replace(/\/+$/, '')}/${configuredApiBase.replace(/^\/+/, '').replace(/\/+$/, '')}`
}

function unwrapSiteSettings(payload: unknown): SiteSettingsSnapshot | null {
  if (!isObject(payload)) return null

  const source = 'data' in payload && isObject(payload.data) ? payload.data : payload
  if (!isObject(source)) return null

  const registrationEnabled = readBoolean(source, 'registrationEnabled')
  const siteTitle = readString(source, 'siteTitle')
  const siteIcon = readString(source, 'siteIcon')
  const siteFooter = readString(source, 'siteFooter')
  const homeTopMarqueeText = readString(source, 'homeTopMarqueeText')
  const homeHeroImageUrls = readString(source, 'homeHeroImageUrls')
  const homeHeroVideoUrl = readString(source, 'homeHeroVideoUrl')

  if (registrationEnabled === undefined && !siteTitle && !siteIcon && !siteFooter && !homeTopMarqueeText && !homeHeroImageUrls && !homeHeroVideoUrl) {
    return null
  }

  return {
    registrationEnabled,
    siteTitle,
    siteIcon,
    siteFooter,
    homeTopMarqueeText,
    homeHeroImageUrls,
    homeHeroVideoUrl,
  }
}

function unwrapPublicFeed(payload: unknown): PublicFeedSnapshot | null {
  if (!isObject(payload)) return null

  const source = 'data' in payload && isObject(payload.data) ? payload.data : payload
  if (!isObject(source)) return null

  const data = Array.isArray(source.data) ? source.data : null
  const pagination = isObject(source.pagination) ? source.pagination : null
  if (!data || !pagination || typeof pagination.hasMore !== 'boolean') {
    return null
  }

  return {
    data: data as ApiTask[],
    pagination: {
      page: typeof pagination.page === 'number' ? pagination.page : 1,
      limit: typeof pagination.limit === 'number' ? pagination.limit : HOME_PUBLIC_GALLERY_PAGE_SIZE,
      hasMore: pagination.hasMore,
    },
  }
}

async function fetchSiteSettings(): Promise<SiteSettingsSnapshot | null> {
  try {
    const apiBase = await resolveApiBase()
    const response = await fetch(`${apiBase}/site/settings`, {
      next: { revalidate },
    })

    if (!response.ok) return null
    const payload = await response.json()
    return unwrapSiteSettings(payload)
  } catch {
    return null
  }
}

async function fetchHomePublicFeed(): Promise<PublicFeedSnapshot | null> {
  try {
    const apiBase = await resolveApiBase()
    const response = await fetch(
      `${apiBase}/gallery/public/feed?page=1&limit=${HOME_PUBLIC_GALLERY_PAGE_SIZE}`,
      {
        next: { revalidate },
      },
    )

    if (!response.ok) return null
    const payload = await response.json()
    return unwrapPublicFeed(payload)
  } catch {
    return null
  }
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  setRequestLocale(locale)

  const [settings, publicFeed] = await Promise.all([
    fetchSiteSettings(),
    fetchHomePublicFeed(),
  ])

  return (
    <LandingHomePage
      locale={locale}
      registrationEnabled={settings?.registrationEnabled ?? true}
      siteTitle={settings?.siteTitle?.trim() || 'AI 创作平台'}
      siteIcon={settings?.siteIcon?.trim() || ''}
      siteFooter={settings?.siteFooter?.trim() || ''}
      marqueeText={settings?.homeTopMarqueeText?.trim() || ''}
      homeHeroImageUrls={settings?.homeHeroImageUrls?.trim() || ''}
      homeHeroVideoUrl={settings?.homeHeroVideoUrl?.trim() || ''}
      initialGalleryItems={publicFeed?.data ?? []}
      initialGalleryPage={publicFeed?.pagination.page ?? 0}
      initialGalleryHasMore={publicFeed?.pagination.hasMore ?? false}
    />
  )
}
