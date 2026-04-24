/**
 * 全局错误边界（国际化路由）
 */

'use client'

import { useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const locale = useLocale()
  const t = useTranslations('errors.boundary')

  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-white to-stone-100">
      <div className="text-center px-4 max-w-2xl">
        <div className="w-32 h-32 mx-auto mb-8">
          <svg
            className="w-full h-full text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="font-display text-5xl font-bold text-stone-900 mb-4">
          {t('title')}
        </h1>

        <p className="font-ui text-lg text-stone-600 mb-2">
          {t('description')}
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 p-4 bg-red-50 rounded-xl border border-red-200 text-left">
            <p className="font-mono text-sm text-red-800 break-words">
              {error.message}
            </p>
            {error.digest && (
              <p className="font-mono text-xs text-red-600 mt-2">
                {t('debugId', { id: error.digest })}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-4 justify-center mt-8">
          <Button onClick={() => reset()} variant="primary">
            {t('retry')}
          </Button>
          <Button onClick={() => (window.location.href = `/${locale}`)} variant="secondary">
            {t('home')}
          </Button>
        </div>
      </div>
    </div>
  )
}
