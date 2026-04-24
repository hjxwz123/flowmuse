/**
 * Sitemap 生成
 * 用于 SEO 优化
 */

import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://flowmuse.example.com'

  const routes = [
    '',
    '/auth/login',
    '/auth/register',
    '/create',
    '/canvas',
    '/chat',
    '/tasks',
    '/packages',
    '/gallery',
  ]

  const locales = ['zh-CN', 'en-US']

  // 为每个路由生成所有语言版本
  const urls: MetadataRoute.Sitemap = []

  for (const locale of locales) {
    for (const route of routes) {
      urls.push({
        url: `${baseUrl}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: route === '' ? 1 : 0.8,
      })
    }
  }

  return urls
}
