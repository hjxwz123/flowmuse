import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { UnauthorizedGuard } from '@/components/providers/UnauthorizedGuard'
import 'katex/dist/katex.min.css'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#a855f7',
}

const SITE_METADATA_REVALIDATE = 300

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  return typeof source[key] === 'string' ? source[key] : undefined
}

async function resolveSiteTitle(): Promise<string> {
  try {
    const configured = process.env.NEXT_PUBLIC_API_BASE_URL || '/api'
    const apiBase = /^https?:\/\//i.test(configured)
      ? configured.replace(/\/+$/, '')
      : `${(process.env.BACKEND_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '')}/${configured.replace(/^\/+/, '').replace(/\/+$/, '')}`

    const response = await fetch(`${apiBase}/site/settings`, {
      next: { revalidate: SITE_METADATA_REVALIDATE },
    })
    if (!response.ok) return 'AI 创作平台'

    const payload = await response.json()
    const source = isObject(payload) && 'data' in payload && isObject(payload.data)
      ? payload.data
      : payload
    if (!isObject(source)) return 'AI 创作平台'

    return readString(source, 'siteTitle')?.trim() || 'AI 创作平台'
  } catch {
    return 'AI 创作平台'
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const siteTitle = await resolveSiteTitle()
  return {
    title: `${siteTitle} - AI 创作平台`,
    description: `${siteTitle}提供图像生成、视频生成与 AI 对话的一体化创作体验。`,
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: siteTitle,
    },
    icons: {
      icon: [
        { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [
        { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
        { url: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png' },
      ],
    },
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var h=document.head||document.getElementsByTagName('head')[0];d.classList.remove('light','dark');var s=JSON.parse(localStorage.getItem('theme-storage')||'{}');var t=(s.state&&s.state.theme)||'system';if(t==='system'){t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}d.classList.add(t);d.style.colorScheme=t;var m=document.querySelector('meta[name="darkreader-lock"]');if(t==='dark'){if(!m&&h){m=document.createElement('meta');m.name='darkreader-lock';h.appendChild(m)}}else if(m){m.remove()}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="font-ui" suppressHydrationWarning>
        <ThemeProvider>
          <UnauthorizedGuard />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
