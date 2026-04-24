'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import { ArrowLeftRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface AuthHighlight {
  icon: LucideIcon
  title: string
  description: string
}

interface AuthShellProps {
  locale: string
  siteTitle: string
  badge: string
  title: string
  subtitle: string
  panelLabel: string
  panelTitle: string
  panelDescription: string
  highlights: AuthHighlight[]
  tone?: 'login' | 'register'
  sidePanel?: ReactNode
  lockViewport?: boolean
  children: ReactNode
}

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      staggerChildren: 0.08,
      duration: 0.45,
      ease: 'easeOut',
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

export function AuthShell({
  locale,
  siteTitle,
  badge,
  title,
  subtitle,
  panelLabel,
  panelTitle,
  panelDescription,
  highlights,
  tone = 'login',
  sidePanel,
  lockViewport = false,
  children,
}: AuthShellProps) {
  const palette = {
    login: {
      orbA: 'from-aurora-pink/30 via-aurora-purple/18 to-transparent dark:from-aurora-pink/18 dark:via-aurora-purple/12',
      orbB: 'from-aurora-blue/28 via-aurora-purple/16 to-transparent dark:from-aurora-blue/18 dark:via-aurora-purple/12',
      chip: 'from-aurora-pink/16 via-white/85 to-aurora-blue/16 dark:from-aurora-pink/12 dark:via-stone-900/90 dark:to-aurora-blue/12',
      icon: 'from-aurora-pink via-aurora-purple to-aurora-blue',
      ring: 'from-aurora-pink/35 via-aurora-purple/30 to-aurora-blue/25',
    },
    register: {
      orbA: 'from-aurora-blue/28 via-aurora-purple/18 to-transparent dark:from-aurora-blue/18 dark:via-aurora-purple/12',
      orbB: 'from-aurora-pink/30 via-aurora-purple/16 to-transparent dark:from-aurora-pink/18 dark:via-aurora-purple/12',
      chip: 'from-aurora-blue/16 via-white/85 to-aurora-pink/16 dark:from-aurora-blue/12 dark:via-stone-900/90 dark:to-aurora-pink/12',
      icon: 'from-aurora-blue via-aurora-purple to-aurora-pink',
      ring: 'from-aurora-blue/30 via-aurora-purple/30 to-aurora-pink/25',
    },
  }[tone]

  return (
    <div className={cn(
      'relative overflow-hidden bg-[radial-gradient(circle_at_top,#f8fafc,transparent_42%),linear-gradient(180deg,#eef2ff_0%,#f8fafc_45%,#f5f7fb_100%)] dark:bg-[radial-gradient(circle_at_top,#1e1b4b,transparent_28%),linear-gradient(180deg,#09090b_0%,#0f172a_45%,#020617_100%)]',
      lockViewport ? 'h-[100dvh]' : 'min-h-screen'
    )}>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:34px_34px] opacity-40 [mask-image:radial-gradient(circle_at_center,black,transparent_78%)] dark:opacity-15" />

      <motion.div
        animate={{ scale: [1, 1.12, 1], rotate: [0, 24, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        className={cn('absolute -left-16 top-16 h-72 w-72 rounded-full bg-gradient-to-br blur-3xl', palette.orbA)}
      />
      <motion.div
        animate={{ scale: [1, 1.18, 1], rotate: [0, -28, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
        className={cn('absolute bottom-8 right-0 h-80 w-80 rounded-full bg-gradient-to-br blur-3xl', palette.orbB)}
      />

      <div className={cn(
        'relative z-10 mx-auto flex w-full max-w-7xl items-center px-4 sm:px-6 lg:px-8',
        lockViewport ? 'h-full py-4 sm:py-5' : 'min-h-screen py-6'
      )}>
        <div className={cn(
          'grid w-full gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(430px,480px)] lg:gap-10',
          lockViewport && 'h-full items-center lg:items-stretch'
        )}>
          <motion.section
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className={cn(
              'order-2 hidden rounded-[32px] border border-white/50 bg-white/40 backdrop-blur-xl lg:flex lg:flex-col dark:border-white/10 dark:bg-stone-900/35',
              sidePanel ? 'overflow-hidden p-0' : 'p-8 lg:justify-between',
              lockViewport && sidePanel && 'min-h-0 lg:self-stretch'
            )}
          >
            {sidePanel ? (
              sidePanel
            ) : (
              <>
                <motion.div variants={itemVariants} className="space-y-6">
                  <Link
                    href={`/${locale}`}
                    className="inline-flex items-center gap-3 rounded-full border border-white/65 bg-white/75 px-4 py-2 text-sm font-medium text-stone-700 shadow-sm backdrop-blur-md transition-colors hover:text-stone-950 dark:border-white/10 dark:bg-stone-900/60 dark:text-stone-200 dark:hover:text-white"
                  >
                    <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-semibold text-white shadow-lg', palette.icon)}>
                      {siteTitle.slice(0, 1).toUpperCase()}
                    </span>
                    <span>{siteTitle}</span>
                  </Link>

                  <div className="space-y-4">
                    <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-stone-600 backdrop-blur-md dark:text-stone-300', `bg-gradient-to-r ${palette.chip}`, 'border-white/60 dark:border-white/10')}>
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      {panelLabel}
                    </div>
                    <div className="space-y-3">
                      <h1 className="max-w-2xl font-display text-4xl font-semibold tracking-tight text-stone-950 lg:text-5xl dark:text-stone-50">
                        {panelTitle}
                      </h1>
                      <p className="max-w-2xl text-base leading-7 text-stone-600 dark:text-stone-300">
                        {panelDescription}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {highlights.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-3xl border border-white/65 bg-white/75 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-stone-950/50 dark:shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
                    >
                      <div className={cn('mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md', palette.icon)}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-ui text-base font-semibold text-stone-900 dark:text-stone-100">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-400">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </motion.div>
              </>
            )}
          </motion.section>

          <motion.section
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className={cn('order-1 flex flex-col justify-center', lockViewport && 'min-h-0')}
          >
            <motion.div variants={itemVariants} className="mb-4 flex items-center justify-between lg:hidden">
              <Link
                href={`/${locale}`}
                className="inline-flex items-center gap-3 rounded-full border border-white/60 bg-white/80 px-3.5 py-2 text-sm font-medium text-stone-700 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-stone-900/65 dark:text-stone-200"
              >
                <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-semibold text-white', palette.icon)}>
                  {siteTitle.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">{siteTitle}</span>
              </Link>

              <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-600 backdrop-blur-md dark:text-stone-300', `bg-gradient-to-r ${palette.chip}`, 'border-white/60 dark:border-white/10')}>
                {badge}
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="overflow-hidden rounded-[32px] border border-white/60 bg-white/78 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:p-8 dark:border-white/10 dark:bg-stone-950/70 dark:shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
            >
              <div className="relative">
                <div className={cn('absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-80 blur-2xl', palette.ring)} />
                <div className="relative space-y-6">
                  <div className="space-y-3">
                    <div className={cn('hidden w-max items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-stone-600 lg:inline-flex dark:text-stone-300', `bg-gradient-to-r ${palette.chip}`, 'border-white/60 dark:border-white/10')}>
                      {badge}
                    </div>
                    <div className="space-y-2">
                      <h2 className="font-display text-3xl font-semibold tracking-tight text-stone-950 dark:text-stone-50">
                        {title}
                      </h2>
                      <p className="max-w-md text-sm leading-6 text-stone-600 dark:text-stone-400">
                        {subtitle}
                      </p>
                    </div>
                  </div>

                  {!lockViewport && highlights.length > 0 ? (
                    <div className="grid gap-3 lg:hidden">
                      {highlights.map((item) => (
                        <div
                          key={item.title}
                          className="rounded-2xl border border-white/60 bg-white/75 p-4 backdrop-blur-md dark:border-white/10 dark:bg-stone-900/55"
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn('inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md', palette.icon)}>
                              <item.icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-ui text-sm font-semibold text-stone-900 dark:text-stone-100">
                                {item.title}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {children}
                </div>
              </div>
            </motion.div>
          </motion.section>
        </div>
      </div>
    </div>
  )
}
