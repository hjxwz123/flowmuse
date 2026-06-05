'use client'

import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/Button'

interface WorkspaceEmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

export function WorkspaceEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: WorkspaceEmptyStateProps) {
  return (
    <section className="rounded-[30px] border border-dashed border-stone-300 bg-white/75 px-6 py-16 text-center shadow-[0_24px_70px_-44px_rgba(28,25,23,0.42)] dark:border-stone-700 dark:bg-stone-900/60">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-400 shadow-sm dark:border-stone-700 dark:bg-stone-950 dark:text-stone-500">
        <Icon className="h-8 w-8" />
      </div>
      <p className="text-lg font-semibold text-stone-900 dark:text-stone-100">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-500 dark:text-stone-400">
        {description}
      </p>
      <div className="mt-6">
        <Button onClick={onAction} className="gap-2 px-5">
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Button>
      </div>
    </section>
  )
}
