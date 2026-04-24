/**
 * Footer 页脚
 * 简洁的页脚设计
 */

'use client'

import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { useSiteStore } from '@/lib/store'

export const Footer = () => {
  const t = useTranslations('nav.footer')
  const locale = useLocale()
  const { settings } = useSiteStore()

  const siteTitle = settings?.siteTitle?.trim() || 'AI 创作平台'
  const currentYear = new Date().getFullYear()
  const siteFooter = settings?.siteFooter?.trim() || `© ${currentYear} ${siteTitle}`

  const footerLinks = [
    { href: `/${locale}/about`, label: t('links.about') },
    { href: `/${locale}/privacy`, label: t('links.privacy') },
    { href: `/${locale}/terms`, label: t('links.terms') },
  ]

  return (
    <footer
      className={cn(
        'w-full border-t pb-16 backdrop-blur-sm md:pb-0',
        'border-stone-200 bg-canvas/95 dark:border-stone-800 dark:bg-canvas-dark/95',
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'font-ui text-sm',
                  'text-stone-600 hover:text-aurora-purple dark:text-stone-400 dark:hover:text-stone-100',
                  'transition-colors duration-300 ease-out',
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <p className="text-center font-ui text-sm text-stone-600 dark:text-stone-400">{siteFooter}</p>
        </div>
      </div>
    </footer>
  )
}
