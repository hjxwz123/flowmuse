/**
 * 作品详情页
 * 路径: /[locale]/gallery/[type]/[id]
 * SEO 优化：服务端预渲染，动态 meta 标签
 */

import React from 'react'
import { setRequestLocale } from 'next-intl/server'
import { GalleryDetailContent } from '@/components/features/gallery/GalleryDetail'
import type { Metadata } from 'next'
import type { GalleryItemDetail } from '@/lib/api/types'

export const revalidate = 300

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(obj: Record<string, unknown>, key: string): string | undefined {
  return typeof obj[key] === 'string' ? obj[key] : undefined
}

async function resolveApiBase() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL || '/api'
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, '')
  const backendBase = process.env.BACKEND_URL || 'http://127.0.0.1:3000'
  return `${backendBase.replace(/\/+$/, '')}/${configured.replace(/^\/+/, '').replace(/\/+$/, '')}`
}

// 服务端获取数据函数
async function getGalleryItem(type: string, id: string): Promise<GalleryItemDetail | null> {
  try {
    const apiBase = await resolveApiBase()
    const url = `${apiBase}/gallery/${type}/${id}`

    console.log('[GalleryDetailPage SSR] Fetching:', url)

    const res = await fetch(url, {
      next: { revalidate }, // ISR: 公开作品详情按需缓存
    })

    if (!res.ok) {
      console.error('[GalleryDetailPage SSR] Fetch failed:', res.status, res.statusText)
      return null
    }

    const payload = await res.json()
    const data = isObject(payload) && 'data' in payload ? payload.data : payload
    console.log('[GalleryDetailPage SSR] Data fetched successfully')
    return data as GalleryItemDetail
  } catch (error) {
    console.error('[GalleryDetailPage SSR] Failed to fetch item:', error)
    return null
  }
}

async function fetchSiteTitle(): Promise<string> {
  try {
    const apiBase = await resolveApiBase()
    const response = await fetch(`${apiBase}/site/settings`, { next: { revalidate } })
    if (!response.ok) return 'AI 创作平台'
    const payload = await response.json()
    const source = isObject(payload) && 'data' in payload && isObject(payload.data)
      ? payload.data
      : payload
    if (!isObject(source)) return 'AI 创作平台'
    const siteTitle = readString(source, 'siteTitle')?.trim()
    return siteTitle || 'AI 创作平台'
  } catch {
    return 'AI 创作平台'
  }
}

// 生成动态 meta 标签用于 SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; type: string; id: string }>
}): Promise<Metadata> {
  try {
    const { locale, type, id } = await params
    const [data, siteTitle] = await Promise.all([getGalleryItem(type, id), fetchSiteTitle()])

    if (!data || !data.item) {
      return {
        title: '作品未找到',
      }
    }

    const { item } = data
    const prompt = item.prompt || 'AI 创作作品'
    const modelLabel = item.modelName || item.provider || 'AI'
    const title = `${prompt.slice(0, 60)}... | ${siteTitle}`
    const description = `${prompt.slice(0, 155)} - 使用 ${modelLabel} 模型创建的 AI ${type === 'image' ? '图片' : '视频'}作品`
    const imageUrl = item.thumbnailUrl || item.resultUrl || ''

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: imageUrl ? [{ url: imageUrl }] : [],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: imageUrl ? [imageUrl] : [],
      },
      alternates: {
        canonical: `/${locale}/gallery/${type}/${id}`,
      },
    }
  } catch (error) {
    console.error('[generateMetadata] Error:', error)
    return {
      title: 'AI 创作平台',
      description: 'AI 创作作品展示',
    }
  }
}

export default async function GalleryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; type: string; id: string }>
}) {
  // 先获取 params，确保在任何错误情况下都能访问
  const { locale, type, id } = await params

  // 启用静态渲染
  setRequestLocale(locale)

  // 验证 type
  if (type !== 'image' && type !== 'video') {
    console.error('[GalleryDetailPage] Invalid type:', type)
    // 不要抛出错误，而是渲染客户端组件让它处理
    return <GalleryDetailContent type={type as 'image' | 'video'} id={id} />
  }

  try {
    // 服务端预取数据用于SEO（仅用于生成JSON-LD，不传递给客户端以避免序列化问题）
    const initialData = await getGalleryItem(type, id)

    // 生成 JSON-LD 结构化数据用于 SEO
    const jsonLd = initialData && initialData.item ? {
      '@context': 'https://schema.org',
      '@type': type === 'image' ? 'ImageObject' : 'VideoObject',
      name: (initialData.item.prompt || 'AI 作品').slice(0, 100),
      description: initialData.item.prompt || 'AI 创作作品',
      contentUrl: initialData.item.resultUrl || '',
      thumbnailUrl: initialData.item.thumbnailUrl || initialData.item.resultUrl || '',
      uploadDate: initialData.item.createdAt || new Date().toISOString(),
      author: {
        '@type': 'Person',
        name: `User ${initialData.item.userId || 'Unknown'}`,
      },
      provider: {
        '@type': 'Organization',
        name: initialData.item.modelName || initialData.item.provider || 'AI',
      },
      keywords: `AI生成, ${initialData.item.modelName || initialData.item.provider || 'AI'}, ${type === 'image' ? 'AI图片' : 'AI视频'}`,
    } : null

    return (
      <>
        {/* JSON-LD 结构化数据 */}
        {jsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
        {/* 客户端组件自己加载数据，避免 Server/Client 序列化问题 */}
        <GalleryDetailContent type={type} id={id} />
      </>
    )
  } catch (error) {
    console.error('[GalleryDetailPage] Render error:', error)
    // 发生错误时，仍然渲染客户端组件，让它自己去加载数据
    return <GalleryDetailContent type={type} id={id} />
  }
}
