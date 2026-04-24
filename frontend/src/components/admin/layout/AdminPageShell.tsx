'use client'

import type { ReactNode } from 'react'

import { FadeIn } from '@/components/shared/FadeIn'
import { PageTransition } from '@/components/shared/PageTransition'
import { cn } from '@/lib/utils/cn'

type AdminPageShellProps = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  maxWidthClassName?: string
}

export function AdminPageShell({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  maxWidthClassName = 'max-w-[98rem]',
}: AdminPageShellProps) {
  return (
    <PageTransition>
      <div className={cn('mx-auto space-y-6', maxWidthClassName, className)}>
        <FadeIn variant="slide">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <h1 className="font-display text-4xl font-bold text-stone-900">{title}</h1>
                {description ? (
                  <p className="font-ui text-lg text-stone-600">{description}</p>
                ) : null}
              </div>
              {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
            </div>
          </section>
        </FadeIn>

        <FadeIn variant="fade" delay={0.06}>
          <div className={cn('space-y-6', contentClassName)}>{children}</div>
        </FadeIn>
      </div>
    </PageTransition>
  )
}
