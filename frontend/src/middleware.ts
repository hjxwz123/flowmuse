/**
 * Next.js 中间件
 * 处理国际化路由重定向
 */

import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { defaultLocale, locales } from '@/i18n/locales'

const PUBLIC_FILE_PATH = /\/[^/]+\.[^/]+$/
const handleI18nRouting = createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'always',
})

function isMobileUserAgent(userAgent: string) {
  if (!userAgent) return false
  return /android|webos|iphone|ipod|ipad|blackberry|iemobile|opera mini|mobile/i.test(userAgent)
}

function isBotUserAgent(userAgent: string) {
  if (!userAgent) return false
  return /bot|crawler|spider|crawl|slurp|bingpreview|headless|lighthouse|google-structured-data-testing-tool/i.test(userAgent)
}

function resolveLocaleHomepage(pathname: string) {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname === `/${locale}/`) {
      return locale
    }
  }
  return null
}

function resolveLocalePrefixedBypassPath(pathname: string) {
  for (const locale of locales) {
    const prefixedPath = `/${locale}/cdn-cgi`
    if (pathname === prefixedPath || pathname.startsWith(`${prefixedPath}/`)) {
      return pathname.slice(locale.length + 1) || '/cdn-cgi'
    }
  }
  return null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const userAgent = request.headers.get('user-agent') ?? ''

  if (pathname === '/cdn-cgi' || pathname.startsWith('/cdn-cgi/')) {
    return NextResponse.next()
  }

  const bypassPath = resolveLocalePrefixedBypassPath(pathname)
  if (bypassPath) {
    const url = request.nextUrl.clone()
    url.pathname = bypassPath
    return NextResponse.redirect(url)
  }

  // 放行 public 下的静态资源，例如 /iframe/nexus-os-home.html
  if (PUBLIC_FILE_PATH.test(pathname)) {
    return NextResponse.next()
  }

  // 检查路径是否已经包含语言前缀
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) {
    const localeHomepage = resolveLocaleHomepage(pathname)
    if (localeHomepage && isMobileUserAgent(userAgent) && !isBotUserAgent(userAgent)) {
      const url = request.nextUrl.clone()
      url.pathname = `/${localeHomepage}/create`
      return NextResponse.redirect(url)
    }

    return handleI18nRouting(request)
  }

  return handleI18nRouting(request)
}

export const config = {
  matcher: [
    // 匹配所有路径，除了：
    // - api 路由
    // - Cloudflare Turnstile challenge 路径
    // - _next 静态文件
    // - _next/image (图片优化文件)
    // - favicon.ico, sitemap.xml 等静态文件
    '/((?!api|cdn-cgi|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
