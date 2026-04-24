'use client'

import { useEffect, useMemo, useState } from 'react'

import { AuthDialog, type AuthDialogMode } from '@/components/features/auth/AuthDialog'
import { useLandingHomePageShell } from './LandingHomePageShellClient'
import { type LandingHomeCopy } from './landingHomePage.shared'
import styles from './LandingHomePage.module.css'

type LandingTopBarActionsProps = {
  locale: string
  registrationEnabled: boolean
  copy: LandingHomeCopy
  showWorkspace: boolean
  hasHydrated: boolean
}

export function LandingTopBarActions({
  locale,
  registrationEnabled,
  copy,
  showWorkspace,
  hasHydrated,
}: LandingTopBarActionsProps) {
  const { navigateWithTransition } = useLandingHomePageShell()
  const [authDialogMode, setAuthDialogMode] = useState<AuthDialogMode | null>(null)

  const inviteOnlyRegistration = !registrationEnabled

  useEffect(() => {
    if (showWorkspace && authDialogMode) {
      setAuthDialogMode(null)
    }
  }, [authDialogMode, showWorkspace])

  const capsuleMenuItems = useMemo(
    () => [
      { key: 'quick', label: copy.quick, href: `/${locale}/create` },
      { key: 'workflow', label: copy.workflow, href: `/${locale}/chat` },
      { key: 'tasks', label: copy.tasks, href: `/${locale}/tasks` },
      { key: 'projects', label: copy.projects, href: `/${locale}/projects` },
    ],
    [copy.projects, copy.quick, copy.tasks, copy.workflow, locale],
  )

  return (
    <>
      <AuthDialog
        isOpen={authDialogMode !== null}
        mode={authDialogMode ?? 'login'}
        locale={locale}
        inviteOnlyRegistration={inviteOnlyRegistration}
        onClose={() => setAuthDialogMode(null)}
        onModeChange={setAuthDialogMode}
      />

      {showWorkspace ? (
        <nav className={styles.capsuleMenu} aria-label={copy.workspace}>
          {capsuleMenuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={styles.capsuleMenuItem}
              onClick={() => navigateWithTransition(item.href)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      ) : hasHydrated ? (
        <div className={styles.authActions}>
          <button
            type="button"
            className={styles.authActionButton}
            onClick={() => setAuthDialogMode('register')}
          >
            {copy.register}
          </button>
          <button
            type="button"
            className={`${styles.authActionButton} ${styles.authActionPrimary}`}
            onClick={() => setAuthDialogMode('login')}
          >
            {copy.login}
          </button>
        </div>
      ) : (
        <div className={styles.authActionsPlaceholder} aria-hidden="true" />
      )}
    </>
  )
}
