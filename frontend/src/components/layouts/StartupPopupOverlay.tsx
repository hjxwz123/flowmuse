'use client'

import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'

interface StartupPopupOverlayProps {
  type: 'image' | 'html'
  imageUrl?: string
  htmlContent?: string
  targetUrl?: string
  widthPx?: number
  heightPx?: number
  isOpen: boolean
  onClose: () => void
}

const DEFAULT_POPUP_WIDTH = 720

export function StartupPopupOverlay({
  type,
  imageUrl = '',
  htmlContent = '',
  targetUrl,
  widthPx = DEFAULT_POPUP_WIDTH,
  heightPx = 0,
  isOpen,
  onClose,
}: StartupPopupOverlayProps) {
  const router = useRouter()
  const trimmedImageUrl = imageUrl.trim()
  const trimmedHtmlContent = htmlContent.trim()
  const trimmedTargetUrl = targetUrl?.trim() || ''
  const normalizedWidthPx = Number.isFinite(widthPx) ? Math.max(240, Math.trunc(widthPx)) : DEFAULT_POPUP_WIDTH
  const normalizedHeightPx = Number.isFinite(heightPx) ? Math.max(0, Math.trunc(heightPx)) : 0
  const isHtmlMode = type === 'html'
  const hasContent = isHtmlMode ? Boolean(trimmedHtmlContent) : Boolean(trimmedImageUrl)

  if (!isOpen || !hasContent) return null

  const handleNavigate = () => {
    if (!trimmedTargetUrl) return

    if (/^https?:\/\//i.test(trimmedTargetUrl)) {
      window.location.href = trimmedTargetUrl
      return
    }

    router.push(trimmedTargetUrl)
  }

  const imageShellStyle: CSSProperties = {
    width: `min(92vw, ${normalizedWidthPx}px)`,
    maxWidth: '92vw',
    maxHeight: normalizedHeightPx > 0 ? `min(82vh, ${normalizedHeightPx}px)` : '82vh',
    height: normalizedHeightPx > 0 ? `min(82vh, ${normalizedHeightPx}px)` : 'auto',
  }

  const htmlShellStyle: CSSProperties = {
    width: `min(92vw, ${normalizedWidthPx}px)`,
    maxWidth: '92vw',
    height: normalizedHeightPx > 0 ? `min(82vh, ${normalizedHeightPx}px)` : 'auto',
  }

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-stone-950/72 px-4 py-6 backdrop-blur-sm">
      <div
        className="flex min-h-full items-center justify-center"
      >
        <div
          className="relative flex items-start justify-center"
          style={isHtmlMode ? htmlShellStyle : imageShellStyle}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/88 text-stone-900 backdrop-blur-sm transition-colors hover:bg-white dark:bg-stone-950/82 dark:text-stone-100 dark:hover:bg-stone-900"
            aria-label="Close startup popup"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {isHtmlMode ? (
            <div
              className="w-full"
              style={{
                width: '100%',
                height: normalizedHeightPx > 0 ? '100%' : 'auto',
              }}
              dangerouslySetInnerHTML={{ __html: trimmedHtmlContent }}
            />
          ) : trimmedTargetUrl ? (
            <button
              type="button"
              onClick={handleNavigate}
              className="block overflow-hidden transition-transform hover:scale-[1.01]"
            >
              <img
                src={trimmedImageUrl}
                alt="startup-popup"
                className="block h-auto max-h-[82vh] w-auto max-w-full object-contain"
                style={{
                  maxWidth: `min(92vw, ${normalizedWidthPx}px)`,
                  maxHeight: normalizedHeightPx > 0 ? `min(82vh, ${normalizedHeightPx}px)` : '82vh',
                }}
              />
            </button>
          ) : (
            <img
              src={trimmedImageUrl}
              alt="startup-popup"
              className="block h-auto max-h-[82vh] w-auto max-w-full object-contain"
              style={{
                maxWidth: `min(92vw, ${normalizedWidthPx}px)`,
                maxHeight: normalizedHeightPx > 0 ? `min(82vh, ${normalizedHeightPx}px)` : '82vh',
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
