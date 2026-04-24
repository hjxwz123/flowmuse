'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

import styles from './AuthExperience.module.css'

interface AuthImmersiveShellProps {
  locale: string
  siteTitle: string
  variant?: 'login' | 'wide'
  showBrand?: boolean
  showcase: ReactNode
  children: ReactNode
}

function BrandGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2L2 7l10 5 10-5-10-5Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 17l10 5 10-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 12l10 5 10-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AuthImmersiveShell({
  locale,
  siteTitle,
  variant = 'login',
  showBrand = true,
  showcase,
  children,
}: AuthImmersiveShellProps) {
  return (
    <div className={styles.viewport}>
      <div className={styles.ambientBg} aria-hidden="true">
        <div className={cn(styles.orb, styles.orbOne)} />
        <div className={cn(styles.orb, styles.orbTwo)} />
      </div>

      <section
        className={cn(
          styles.authSection,
          variant === 'wide' && styles.authSectionWide,
          !showBrand && styles.authSectionNoBrand,
        )}
      >
        {showBrand ? (
          <Link href={`/${locale}`} className={styles.brandLogo} aria-label={siteTitle}>
            <span className={styles.brandMark}>
              <BrandGlyph />
            </span>
            <span className={styles.brandLogoText}>{siteTitle}</span>
          </Link>
        ) : null}

        <div className={cn(styles.authScroll, !showBrand && styles.authScrollNoBrand)}>
          {children}
        </div>
      </section>

      <aside className={styles.showcaseSection}>{showcase}</aside>
    </div>
  )
}
