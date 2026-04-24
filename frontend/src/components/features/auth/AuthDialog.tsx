'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

import { LoginAuthContent } from './LoginAuthContent'
import { RegisterAuthContent } from './RegisterAuthContent'
import { AuthShowcaseGallery } from './AuthShowcaseGallery'
import { AuthShowcaseScenes } from './AuthShowcaseScenes'

import styles from './AuthDialog.module.css'

export type AuthDialogMode = 'login' | 'register'

interface AuthDialogProps {
  isOpen: boolean
  mode: AuthDialogMode
  locale: string
  inviteOnlyRegistration: boolean
  onClose: () => void
  onModeChange: (mode: AuthDialogMode) => void
}

export function AuthDialog({
  isOpen,
  mode,
  locale,
  inviteOnlyRegistration,
  onClose,
  onModeChange,
}: AuthDialogProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  const isZh = locale.toLowerCase().startsWith('zh')
  const closeLabel = isZh ? '关闭' : 'Close'
  const dialogLabel = isZh
    ? mode === 'login' ? '登录' : '注册'
    : mode === 'login' ? 'Login' : 'Register'

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={cn(
          styles.dialog,
          mode === 'login' ? styles.dialogLogin : styles.dialogRegister,
        )}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
      >
        <div className={styles.ambientBg} aria-hidden="true">
          <div className={cn(styles.orb, styles.orbOne)} />
          <div className={cn(styles.orb, styles.orbTwo)} />
        </div>

        <button
          type="button"
          onClick={onClose}
          className={styles.closeButton}
          aria-label={closeLabel}
        >
          <X />
        </button>

        <div className={cn(styles.contentPane, mode === 'login' && styles.contentPaneLogin)}>
          <div
            className={cn(
              styles.contentInner,
              mode === 'login' ? styles.contentInnerLogin : styles.contentInnerRegister,
            )}
          >
            {mode === 'login' ? (
              <LoginAuthContent
                locale={locale}
                redirectOnSuccess={false}
                onSuccess={onClose}
                onRequestRegister={() => onModeChange('register')}
                showTag={false}
                switchCtaVariant="text"
                compact
              />
            ) : (
              <RegisterAuthContent
                locale={locale}
                inviteOnlyRegistration={inviteOnlyRegistration}
                onRequestLogin={() => onModeChange('login')}
                switchCtaVariant="text"
                compact
              />
            )}
          </div>
        </div>

        <div className={styles.showcasePane}>
          {mode === 'login' ? <AuthShowcaseGallery /> : <AuthShowcaseScenes />}
        </div>
      </div>
    </div>,
    document.body
  )
}
