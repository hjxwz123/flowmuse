import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/config.ts')

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  experimental: {
    // 增加请求体大小限制到 50MB（支持多张压缩图片的 base64）
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async rewrites() {
    // BACKEND_URL 用于配置后端地址（服务器端环境变量）
    // 默认后端和前端在同一服务器，使用 127.0.0.1:3000
    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3000'
    return [
      {
        source: '/cdn-cgi/challenge-platform/:path*',
        destination: 'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/:path*',
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      // PWA 资源文件重写规则：将国际化路径下的请求重定向到根目录
      {
        source: '/:locale/manifest.json',
        destination: '/manifest.json',
      },
      {
        source: '/:locale/icons/:path*',
        destination: '/icons/:path*',
      },
    ]
  },
}

export default withNextIntl(nextConfig)
