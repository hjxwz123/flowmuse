/**
 * 邮箱验证页面 - 现代化设计
 * 路径: /[locale]/auth/verify-email
 * 支持两种模式：
 * 1. 带 token 参数：直接验证
 * 2. 无 token 参数：显示提示信息
 */

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { authService } from '@/lib/api/services/auth'
import { useSiteStore } from '@/lib/store'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token')

  const t = useTranslations('auth.verifyEmail')
  const tErrors = useTranslations('errors.auth')
  const siteTitle = useSiteStore((state) => state.settings?.siteTitle?.trim() || 'AI 创作平台')

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('pending')
  const [error, setError] = useState('')
  const [devToken, setDevToken] = useState<string>('')

  useEffect(() => {
    // 读取开发环境 token（注册页可能写入）
    try {
      const stored = sessionStorage.getItem('dev_verify_email_token') || ''
      if (stored) setDevToken(stored)
    } catch {
      // ignore
    }

    if (token) {
      // 有 token，自动验证
      verifyEmail(token)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const verifyEmail = async (verifyToken: string) => {
    setStatus('loading')
    setError('')

    try {
      await authService.verifyEmail(verifyToken)
      try {
        sessionStorage.removeItem('dev_verify_email_token')
      } catch {
        // ignore
      }
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : tErrors('tokenExpired'))
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-stone-50 via-stone-100 to-stone-50">
      {/* 动态背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        {/* 大型渐变球体 */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-aurora-pink/30 via-aurora-purple/20 to-transparent rounded-full blur-3xl"
        />

        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-aurora-blue/30 via-aurora-purple/20 to-transparent rounded-full blur-3xl"
        />

        {/* 浮动的小装饰元素 */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -30, 0],
              x: [0, Math.random() * 20 - 10, 0],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 5 + i,
              repeat: Infinity,
              delay: i * 0.5,
            }}
            className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-aurora-pink to-aurora-blue"
            style={{
              left: `${20 + i * 15}%`,
              top: `${20 + i * 12}%`,
            }}
          />
        ))}
      </div>

      {/* 主要内容 */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {/* 加载中状态 */}
          {status === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md"
            >
              <div className={cn(
                'relative rounded-3xl p-8 md:p-10',
                'bg-white/80 backdrop-blur-xl',
                'border border-white/50',
                'shadow-2xl shadow-aurora-purple/10',
                'text-center'
              )}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue rounded-full" />

                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 border-4 border-aurora-purple/30 border-t-aurora-purple rounded-full animate-spin mb-6" />
                  <h2 className="font-display text-2xl font-bold text-stone-900 mb-2">
                    {t('verifying')}
                  </h2>
                  <p className="font-ui text-stone-600">
                    {t('verifyingMessage') || '正在验证您的邮箱...'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* 验证成功状态 */}
          {status === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md"
            >
              <div className={cn(
                'relative rounded-3xl p-8 md:p-10',
                'bg-white/80 backdrop-blur-xl',
                'border border-white/50',
                'shadow-2xl shadow-aurora-purple/10',
                'text-center'
              )}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue rounded-full" />

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue flex items-center justify-center"
                >
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>

                <h2 className="font-display text-3xl font-bold text-stone-900 mb-3">
                  {t('successTitle')}
                </h2>
                <p className="font-ui text-stone-600 mb-8">
                  {t('successMessage')}
                </p>

                <Link href="/">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'w-full py-4 rounded-xl font-ui font-semibold text-white',
                      'bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue',
                      'shadow-lg shadow-aurora-purple/30',
                      'transition-all duration-300',
                      'hover:shadow-xl hover:shadow-aurora-purple/40',
                      'relative overflow-hidden group'
                    )}
                  >
                    <span className="relative z-10">{t('backToHome')}</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-aurora-blue via-aurora-purple to-aurora-pink opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          )}

          {/* 验证失败状态 */}
          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md"
            >
              <div className={cn(
                'relative rounded-3xl p-8 md:p-10',
                'bg-white/80 backdrop-blur-xl',
                'border border-white/50',
                'shadow-2xl shadow-red-500/10',
                'text-center'
              )}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-red-400 via-red-500 to-red-600 rounded-full" />

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center"
                >
                  <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.div>

                <h2 className="font-display text-3xl font-bold text-stone-900 mb-3">
                  {t('errorTitle')}
                </h2>
                <p className="font-ui text-stone-600 mb-8">
                  {error}
                </p>

                <Link href="/auth/login">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'w-full py-4 rounded-xl font-ui font-semibold',
                      'bg-stone-100 text-stone-700',
                      'border-2 border-stone-200',
                      'hover:bg-stone-200 hover:border-stone-300',
                      'transition-all duration-300'
                    )}
                  >
                    {t('backToLogin')}
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          )}

          {/* 待验证状态（无 token，显示提示） */}
          {status === 'pending' && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md"
            >
              <div className={cn(
                'relative rounded-3xl p-8 md:p-10',
                'bg-white/80 backdrop-blur-xl',
                'border border-white/50',
                'shadow-2xl shadow-aurora-purple/10',
                'text-center'
              )}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue rounded-full" />

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue flex items-center justify-center"
                >
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </motion.div>

                <h2 className="font-display text-3xl font-bold text-stone-900 mb-3">
                  {t('pendingTitle')}
                </h2>
                <p className="font-ui text-stone-600 mb-8">
                  {t('pendingMessage')}
                </p>

                {/* 开发环境 token 按钮 */}
                {devToken && (
                  <div className="mb-4">
                    <p className="font-ui text-sm text-stone-500 mb-3">
                      {t('devTokenHint')}
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => verifyEmail(devToken)}
                      className={cn(
                        'w-full py-4 rounded-xl font-ui font-semibold text-white mb-3',
                        'bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue',
                        'shadow-lg shadow-aurora-purple/30',
                        'transition-all duration-300',
                        'hover:shadow-xl hover:shadow-aurora-purple/40'
                      )}
                    >
                      {t('useTokenButton')}
                    </motion.button>
                  </div>
                )}

                <Link href="/">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'w-full py-4 rounded-xl font-ui font-semibold',
                      'bg-stone-100 text-stone-700',
                      'border-2 border-stone-200',
                      'hover:bg-stone-200 hover:border-stone-300',
                      'transition-all duration-300'
                    )}
                  >
                    {t('backToHome')}
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 移动端 Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-8 left-1/2 -translate-x-1/2 z-20"
      >
        <h1 className="font-display text-3xl font-bold bg-gradient-to-r from-aurora-pink via-aurora-purple to-aurora-blue bg-clip-text text-transparent">
          {siteTitle}
        </h1>
      </motion.div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-aurora-purple/30 border-t-aurora-purple rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
