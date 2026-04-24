'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils/cn'

import styles from './AuthExperience.module.css'

type TurnstileWidgetId = string | number

type TurnstileRenderOptions = {
  sitekey: string
  theme: 'light' | 'dark'
  language: string
  size: 'flexible'
  retry?: 'auto' | 'never'
  'retry-interval'?: number
  callback: (token: string) => void
  'expired-callback': () => void
  'timeout-callback': () => void
  'error-callback': (errorCode: string | number) => boolean
}

type TurnstileApi = {
  ready: (callback: () => void) => void
  render: (container: HTMLElement, options: TurnstileRenderOptions) => TurnstileWidgetId
  reset: (widgetId: TurnstileWidgetId) => void
  remove: (widgetId: TurnstileWidgetId) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

interface AuthTurnstileFieldProps {
  siteKey: string
  locale: string
  label: string
  hint: string
  loadingLabel: string
  unavailableLabel: string
  error?: string
  onTokenChange: (token: string) => void
  resetSignal?: number
}

function resolveTurnstileErrorMessage(errorCode: string | number, locale: string) {
  const code = String(errorCode).trim()
  const isZh = locale.toLowerCase().startsWith('zh')

  if (code === '110200') {
    return isZh
      ? '当前域名未在 Cloudflare Turnstile 的 Hostname Management 中授权，请把当前访问域名加入允许列表。'
      : 'This domain is not authorized in Cloudflare Turnstile Hostname Management. Add the current hostname to the allowed list.'
  }

  if (code === '110100' || code === '110110' || code === '400020') {
    return isZh
      ? 'Turnstile Site Key 无效，请检查后台配置是否填写正确。'
      : 'The Turnstile site key is invalid. Check the configured site key in the admin settings.'
  }

  if (code === '400070') {
    return isZh
      ? 'Turnstile Site Key 已被禁用，请在 Cloudflare 控制台重新启用。'
      : 'The Turnstile site key is disabled. Re-enable it in the Cloudflare dashboard.'
  }

  if (code === '200500') {
    return isZh
      ? 'Turnstile 挑战 iframe 加载失败，请检查网络、代理或浏览器插件是否拦截了 challenges.cloudflare.com。'
      : 'The Turnstile iframe failed to load. Check whether challenges.cloudflare.com is blocked by your network, proxy, or browser extensions.'
  }

  return isZh
    ? `安全验证加载失败（错误码 ${code}），请刷新页面重试。`
    : `The security check failed to load (error code ${code}). Please refresh the page and try again.`
}

export function AuthTurnstileField({
  siteKey,
  locale,
  label,
  hint,
  loadingLabel,
  unavailableLabel,
  error,
  onTokenChange,
  resetSignal = 0,
}: AuthTurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null)
  const [isScriptReady, setIsScriptReady] = useState(false)
  const [hasScriptError, setHasScriptError] = useState(false)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const [widgetError, setWidgetError] = useState<string | null>(null)

  const language = useMemo(() => {
    const normalizedLocale = locale.toLowerCase()
    return normalizedLocale.startsWith('zh') ? 'zh-CN' : 'en'
  }, [locale])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.turnstile) {
      setIsScriptReady(true)
      return
    }

    const SCRIPT_ID = 'cloudflare-turnstile-api'
    const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

    const timeout = setTimeout(() => {
      if (!window.turnstile) setHasScriptError(true)
    }, 12000)

    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      // Script tag already in DOM (e.g. another instance), just poll until ready
      const poll = setInterval(() => {
        if (window.turnstile) {
          clearInterval(poll)
          setIsScriptReady(true)
        }
      }, 100)
      return () => {
        clearInterval(poll)
        clearTimeout(timeout)
      }
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.onload = () => {
      clearTimeout(timeout)
      setHasScriptError(false)
      setIsScriptReady(true)
    }
    script.onerror = () => {
      clearTimeout(timeout)
      setHasScriptError(true)
      setIsScriptReady(false)
    }
    document.head.appendChild(script)

    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = window.document.documentElement
    const updateTheme = () => {
      setResolvedTheme(root.classList.contains('dark') ? 'dark' : 'light')
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!siteKey || hasScriptError || !isScriptReady || !containerRef.current || !window.turnstile) {
      return
    }

    let cancelled = false

    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) {
        return
      }

      if (widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }

      containerRef.current.innerHTML = ''
      onTokenChange('')
      setWidgetError(null)

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: resolvedTheme,
        language,
        size: 'flexible',
        retry: 'auto',
        'retry-interval': 8000,
        callback: (token) => {
          setWidgetError(null)
          onTokenChange(token)
        },
        'expired-callback': () => {
          onTokenChange('')
          setWidgetError(null)
        },
        'timeout-callback': () => {
          onTokenChange('')
          setWidgetError(
            locale.toLowerCase().startsWith('zh')
              ? '安全验证已超时，请重新完成验证。'
              : 'The security check timed out. Please complete it again.'
          )
        },
        'error-callback': (errorCode) => {
          console.warn('Turnstile error occurred:', errorCode)
          onTokenChange('')
          setWidgetError(resolveTurnstileErrorMessage(errorCode, locale))
          return true
        },
      })
    }

    renderWidget()

    return () => {
      cancelled = true
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [hasScriptError, isScriptReady, language, locale, onTokenChange, resolvedTheme, siteKey])

  useEffect(() => {
    if (resetSignal === 0 || widgetIdRef.current === null || !window.turnstile) {
      return
    }

    onTokenChange('')
    setWidgetError(null)
    window.turnstile.reset(widgetIdRef.current)
  }, [onTokenChange, resetSignal])

  return (
    <div className={styles.verificationGroup}>
      <div className={styles.verificationLabelRow}>
        <span className={styles.verificationLabel}>{label}</span>
      </div>

      <div className={cn(styles.verificationWidgetShell, error && styles.verificationWidgetShellError)}>
        {siteKey ? (
          <div ref={containerRef} className={styles.verificationWidgetFrame} />
        ) : (
          <div className={styles.verificationUnavailable}>{unavailableLabel}</div>
        )}

        {siteKey && !hasScriptError && !isScriptReady ? (
          <div className={styles.verificationLoading}>{loadingLabel}</div>
        ) : null}

        {siteKey && hasScriptError ? (
          <div className={styles.verificationUnavailable}>{unavailableLabel}</div>
        ) : null}
      </div>

      <p className={styles.verificationHint}>{hint}</p>
      {widgetError ? <p className={styles.verificationError}>{widgetError}</p> : null}
      {error ? <p className={styles.verificationError}>{error}</p> : null}
    </div>
  )
}
