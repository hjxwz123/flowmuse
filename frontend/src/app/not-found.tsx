/**
 * 404 Not Found 页面
 */

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui'

export default function NotFound() {
  const t = useTranslations('common')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-white to-stone-100">
      <div className="text-center px-4">
        {/* 404 大字 */}
        <h1 className="font-display text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue mb-4">
          404
        </h1>

        {/* 标题 */}
        <h2 className="font-display text-4xl font-bold text-stone-900 mb-4">
          页面未找到
        </h2>

        {/* 描述 */}
        <p className="font-ui text-lg text-stone-600 mb-8 max-w-md mx-auto">
          抱歉，您访问的页面不存在或已被移除。
        </p>

        {/* 插图 */}
        <div className="w-64 h-64 mx-auto mb-8">
          <svg
            className="w-full h-full text-stone-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* 返回首页按钮 */}
        <Link href="/">
          <Button size="lg">返回首页</Button>
        </Link>
      </div>
    </div>
  )
}
