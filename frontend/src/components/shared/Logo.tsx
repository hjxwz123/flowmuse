/**
 * Logo 组件
 * Canvas Design System - 品牌标识
 */

'use client'

import Link from 'next/link'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils/cn'
import { useSiteStore } from '@/lib/store'
import Image from 'next/image'

interface LogoProps {
  className?: string
  variant?: 'default' | 'light'
}

export const Logo = ({ className, variant = 'default' }: LogoProps) => {
  const locale = useLocale()
  const { settings } = useSiteStore()

  const siteTitle = settings?.siteTitle?.trim() || 'AI 创作平台'
  const siteIcon = settings?.siteIcon

  return (
    <Link
      href={`/${locale}`}
      className={cn(
        'flex items-center gap-3 transition-all duration-300 ease-out hover:scale-105',
        className
      )}
    >
      {/* Logo Icon */}
      {siteIcon && siteIcon !== '/logo.svg' ? (
        <div className="relative h-10 w-10">
          <Image
            src={siteIcon}
            alt={siteTitle}
            width={40}
            height={40}
            className="rounded-full object-cover"
          />
        </div>
      ) : (
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-aurora-pink via-aurora-purple to-aurora-blue opacity-100" />
          <div className="absolute inset-[2px] rounded-full bg-canvas dark:bg-canvas-dark flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                className="fill-aurora-purple"
              />
              <path
                d="M2 17L12 22L22 17"
                className="stroke-aurora-pink"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M2 12L12 17L22 12"
                className="stroke-aurora-blue"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Brand Name */}
      <span
        className={cn(
          'font-display text-2xl font-bold transition-colors duration-300',
          variant === 'light' ? 'text-white' : 'text-stone-900 dark:text-stone-100'
        )}
      >
        {siteTitle}
      </span>
    </Link>
  )
}
