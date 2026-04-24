'use client'

import { useState, useRef, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { cn } from '@/lib/utils/cn'
import { imageService } from '@/lib/api/services/images'
import { videoService } from '@/lib/api/services/videos'
import { buildImageParameters, fileToBase64 } from '@/lib/utils/toolImageParams'
import { useAuthStore } from '@/lib/store'
import type { Tool } from '@/lib/api/types/tools'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { resolvePurchaseGuideReason, type PurchaseGuideReason } from '@/lib/utils/purchaseGuide'
import { PurchaseGuideModal } from '@/components/shared/PurchaseGuideModal'

interface ToolUseModalProps {
  tool: Tool
  onClose: () => void
}

const MAX_FILE_SIZE_MB = 10
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

export function ToolUseModal({ tool, onClose }: ToolUseModalProps) {
  const t = useTranslations('tools')
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const locale = useLocale()

  const [images, setImages] = useState<(File | null)[]>(Array(tool.imageCount).fill(null))
  const [previews, setPreviews] = useState<(string | null)[]>(Array(tool.imageCount).fill(null))
  const [submitting, setSubmitting] = useState(false)
  const [purchaseGuideReason, setPurchaseGuideReason] = useState<PurchaseGuideReason | null>(null)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // permanentCredits is for display only; actual balance check is done server-side
  const userCredits = user?.permanentCredits ?? 0

  const handleFileChange = useCallback(
    (index: number, file: File | null) => {
      if (!file) return
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(t('error.fileSize', { mb: MAX_FILE_SIZE_MB }))
        return
      }
      const url = URL.createObjectURL(file)
      setImages((prev) => {
        const next = [...prev]
        next[index] = file
        return next
      })
      setPreviews((prev) => {
        const next = [...prev]
        if (prev[index]) URL.revokeObjectURL(prev[index]!)
        next[index] = url
        return next
      })
    },
    [t]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) handleFileChange(index, file)
    },
    [handleFileChange]
  )

  const handleRemove = (index: number) => {
    if (previews[index]) URL.revokeObjectURL(previews[index]!)
    setImages((prev) => { const n = [...prev]; n[index] = null; return n })
    setPreviews((prev) => { const n = [...prev]; n[index] = null; return n })
  }

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      toast.error(t('error.loginRequired'))
      return
    }
    const filled = images.filter(Boolean)
    if (filled.length < tool.imageCount) {
      toast.error(t('error.uploadRequired', { count: tool.imageCount }))
      return
    }

    setSubmitting(true)
    try {
      const base64Array = await Promise.all(
        (images as File[]).map((f) => fileToBase64(f))
      )

      const imageParams = buildImageParameters(
        tool.modelProvider,
        tool.modelKey,
        tool.type,
        base64Array,
      )

      const parameters: Record<string, unknown> = {
        ...(tool.parameters ?? {}),
        ...imageParams,
      }

      if (tool.type === 'image') {
        await imageService.generate({
          modelId: tool.modelId,
          prompt: tool.prompt,
          parameters,
          toolId: tool.id,
        })
      } else {
        await videoService.generate({
          modelId: tool.modelId,
          prompt: tool.prompt,
          parameters,
          toolId: tool.id,
        })
      }

      toast.success(t('success.submitted'))
      onClose()
      router.push(`/${locale}/tasks`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      const reason = resolvePurchaseGuideReason(msg)
      if (reason) {
        setPurchaseGuideReason(reason)
      } else {
        toast.error(t('error.submitFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const labels = tool.imageLabels ?? Array(tool.imageCount).fill(null)

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-stone-100 dark:border-stone-800">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              {tool.title}
            </h2>
            {tool.description && (
              <p className="mt-1 font-ui text-sm text-stone-500 dark:text-stone-400">
                {tool.description}
              </p>
            )}
            {/* Credits cost row */}
            <div className="mt-2 flex items-center gap-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-ui text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-5h2v5zm0-7h-2V7h2v2.5z" />
                </svg>
                {t('creditsPerUse', { n: tool.creditsPerUse })}
              </span>
              {isAuthenticated && (
                <span className="font-ui text-xs text-stone-400 dark:text-stone-500">
                  {t('balance', { balance: userCredits })}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Notes / 注意事项 */}
          {tool.notes && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-ui text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                  {t('notes')}
                </span>
              </div>
              <p className="font-ui text-sm text-amber-800 dark:text-amber-300 whitespace-pre-wrap leading-relaxed">
                {tool.notes}
              </p>
            </div>
          )}

          {/* Image upload slots */}
          <div className={cn(
            'grid gap-4',
            tool.imageCount === 1 ? 'grid-cols-1' : 'grid-cols-2'
          )}>
            {Array.from({ length: tool.imageCount }).map((_, i) => {
              const label = labels[i]
              const preview = previews[i]
              return (
                <div key={i} className="space-y-1.5">
                  {label && (
                    <p className="font-ui text-xs font-medium text-stone-600 dark:text-stone-400 text-center">
                      {`${i + 1}. ${label}`}
                    </p>
                  )}
                  {preview ? (
                    <div className="relative group rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 aspect-square">
                      <img
                        src={preview}
                        alt={label ?? `图片 ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => handleRemove(i)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'aspect-square rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-700',
                        'flex flex-col items-center justify-center gap-2 cursor-pointer',
                        'hover:border-aurora-purple/60 hover:bg-aurora-purple/5 transition-all duration-200'
                      )}
                      onClick={() => fileInputRefs.current[i]?.click()}
                      onDrop={(e) => handleDrop(e, i)}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <svg className="w-8 h-8 text-stone-300 dark:text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="font-ui text-xs text-stone-400 dark:text-stone-500">
                        {t('upload.click')}
                      </span>
                      <input
                        ref={(el) => { fileInputRefs.current[i] = el }}
                        type="file"
                        accept={ACCEPT}
                        className="hidden"
                        onChange={(e) => handleFileChange(i, e.target.files?.[0] ?? null)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Model info */}
          <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
            <span>{tool.modelName}</span>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || images.some((img) => img === null)}
            className={cn(
              'w-full py-3 rounded-xl font-ui text-sm font-semibold transition-all duration-200',
              'bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue text-white',
              'hover:shadow-aurora hover:scale-[1.01]',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none'
            )}
          >
            {submitting ? t('submitting') : t('submit')}
          </button>
        </div>
        </div>
      </div>

      <PurchaseGuideModal
        isOpen={Boolean(purchaseGuideReason)}
        reason={purchaseGuideReason}
        locale={locale}
        onClose={() => setPurchaseGuideReason(null)}
        onAfterNavigate={onClose}
      />
    </>
  )
}
