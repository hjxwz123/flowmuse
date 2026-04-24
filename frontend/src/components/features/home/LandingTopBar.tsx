'use client'

import { useState } from 'react'

import { useAuthStore } from '@/lib/store/authStore'
import { type LandingHomeCopy } from './landingHomePage.shared'
import { LandingTopBarActions } from './LandingTopBarActions'
import styles from './LandingHomePage.module.css'

export type LandingTopBarProps = {
  locale: string
  registrationEnabled: boolean
  siteTitle: string
  siteIcon: string
  copy: LandingHomeCopy
}

type PersistedAuthSnapshot = {
  state?: {
    isAuthenticated?: boolean
  }
}

function readPersistedIsAuthenticated() {
  if (typeof window === 'undefined') return false

  try {
    const raw = window.localStorage.getItem('auth-storage')
    if (!raw) return false

    const parsed = JSON.parse(raw) as PersistedAuthSnapshot
    return parsed.state?.isAuthenticated === true
  } catch {
    return false
  }
}

export function LandingTopBar({
  locale,
  registrationEnabled,
  siteTitle,
  siteIcon,
  copy,
}: LandingTopBarProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasHydrated = useAuthStore((state) => state._hasHydrated)
  const [persistedAuthenticated] = useState(readPersistedIsAuthenticated)

  const showWorkspace = hasHydrated ? isAuthenticated : persistedAuthenticated
  const showBrand = !showWorkspace

  return (
    <header className={`${styles.topBar} ${showWorkspace ? styles.topBarMenuOnly : ''}`}>
      {showBrand ? (
        <div data-landing-brand className={styles.brand}>
          {siteIcon.trim() ? (
            <img src={siteIcon} alt={siteTitle} className={styles.brandIcon} />
          ) : (
            <span className={styles.brandFallback} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5Z" stroke="currentColor" strokeWidth="1.8" />
                <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          )}
          <span>{siteTitle}</span>
        </div>
      ) : null}

      <LandingTopBarActions
        locale={locale}
        registrationEnabled={registrationEnabled}
        copy={copy}
        showWorkspace={showWorkspace}
        hasHydrated={hasHydrated}
      />
    </header>
  )
}
