'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { QRCodeSVG } from 'qrcode.react'
import { paymentService } from '@/lib/api/services/payment'

// 三种模式：套餐购买 / 自定义积分购买 / 会员购买
type WechatPayDialogProps = {
  title: string
  price: number  // 元（展示用）
  onClose: () => void
  onSuccess: () => void
} & (
  | { packageId: string; credits?: never; membershipLevelId?: never; membershipPeriod?: never }
  | { credits: number; packageId?: never; membershipLevelId?: never; membershipPeriod?: never }
  | { membershipLevelId: string; membershipPeriod: 'monthly' | 'yearly'; packageId?: never; credits?: never }
)

export function WechatPayDialog({
  title,
  price,
  packageId,
  credits,
  membershipLevelId,
  membershipPeriod,
  onClose,
  onSuccess,
}: WechatPayDialogProps) {
  const locale = useLocale()
  const t = useTranslations('packages')
  const createFailedText = t('payDialog.errors.createFailed')
  const expiredText = t('payDialog.errors.expired')
  const [step, setStep] = useState<'loading' | 'qr' | 'success' | 'error'>('loading')
  const [orderNo, setOrderNo] = useState('')
  const [codeUrl, setCodeUrl] = useState('')
  const [expireAt, setExpireAt] = useState<Date | null>(null)
  const [errMsg, setErrMsg] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 创建订单
  useEffect(() => {
    let cancelled = false
    const createFn = packageId
      ? paymentService.createOrder(packageId)
      : typeof credits === 'number'
        ? paymentService.createCreditsOrder(credits)
        : paymentService.createMembershipOrder(membershipLevelId!, membershipPeriod!)

    createFn
      .then(res => {
        if (cancelled) return
        setOrderNo(res.orderNo)
        setCodeUrl(res.codeUrl)
        setExpireAt(new Date(res.expireAt))
        setStep('qr')
      })
      .catch(() => {
        if (cancelled) return
        setErrMsg(createFailedText)
        setStep('error')
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 轮询订单状态
  useEffect(() => {
    if (step !== 'qr' || !orderNo) return
    pollRef.current = setInterval(async () => {
      try {
        const info = await paymentService.getOrder(orderNo)
        if (info.status === 'paid') {
          clearInterval(pollRef.current!)
          setStep('success')
          setTimeout(onSuccess, 1500)
        } else if (info.status === 'expired' || info.status === 'failed') {
          clearInterval(pollRef.current!)
          setErrMsg(expiredText)
          setStep('error')
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(pollRef.current!)
  }, [step, orderNo, onSuccess, expiredText])

  const isMembershipOrder = Boolean(membershipLevelId)
  const isCreditsOrder = typeof credits === 'number'
  const pendingTip = isMembershipOrder
    ? t('payDialog.pending.membership')
    : isCreditsOrder
      ? t('payDialog.pending.credits')
      : t('payDialog.pending.package')

  const successTip = isMembershipOrder
    ? t('payDialog.success.membership')
    : isCreditsOrder
      ? t('payDialog.success.credits')
      : t('payDialog.success.package')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm dark:bg-black/70" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:border dark:border-stone-700 dark:bg-stone-900"
        onClick={e => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button onClick={onClose} className="absolute right-4 top-4 text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-200">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 标题 */}
        <div className="text-center mb-5">
          <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">{t('payDialog.title')}</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{title}</p>
          <p className="text-3xl font-bold text-aurora-purple mt-2">¥{price.toFixed(2)}</p>
        </div>

        {/* 内容区 */}
        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-aurora-purple dark:border-stone-700" />
            <p className="text-sm text-stone-500 dark:text-stone-400">{t('payDialog.loading')}</p>
          </div>
        )}

        {step === 'qr' && codeUrl && (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border-2 border-aurora-purple/20 bg-aurora-purple/5 p-3 dark:border-aurora-purple/30 dark:bg-stone-800">
              <QRCodeSVG value={codeUrl} size={200} level="M" />
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
              <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.688 7.655C8.108 7.21 7.408 6.966 6.696 6.966... M19.2 12c0 3.974-3.182 7.2-7.2 7.2S4.8 15.974 4.8 12 7.982 4.8 12 4.8s7.2 3.226 7.2 7.2z" />
              </svg>
              <span>{t('payDialog.scanInstruction')}</span>
            </div>
            {expireAt && (
              <p className="text-xs text-stone-400 dark:text-stone-500">
                {t('payDialog.expiresAt', { time: expireAt.toLocaleTimeString(locale) })}
              </p>
            )}
            <div className="flex w-full items-center gap-2 rounded-xl bg-stone-50 p-3 text-xs text-stone-400 dark:bg-stone-800 dark:text-stone-400">
              <div className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-green-400" />
              <span>{pendingTip}</span>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg className="w-9 h-9 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-stone-900 dark:text-stone-100">{t('payDialog.successTitle')}</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">{successTip}</p>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-center text-sm text-red-600 dark:text-red-300">{errMsg}</p>
            <button
              onClick={onClose}
              className="rounded-xl bg-stone-100 px-6 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              {t('payDialog.close')}
            </button>
          </div>
        )}

        {/* 底部安全提示 */}
        {step === 'qr' && (
          <p className="mt-4 text-center text-xs text-stone-400 dark:text-stone-500">
            {t('payDialog.safeTip')}
          </p>
        )}
      </div>
    </div>
  )
}
