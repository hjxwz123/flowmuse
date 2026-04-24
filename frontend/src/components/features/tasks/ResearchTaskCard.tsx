'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Brain, Download, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button, Card } from '@/components/ui'
import { ChatMarkdown } from '@/components/features/chat/ChatMarkdown'
import type { ApiResearchTask } from '@/lib/api/types/research'
import { researchService } from '@/lib/api/services'
import { cn } from '@/lib/utils/cn'
import { exportResearchReportToWord } from '@/lib/utils/exportResearchWord'

interface ResearchTaskCardProps {
  task: ApiResearchTask
  onRefresh: () => void
  onDelete?: () => void
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  processing: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
}

export function ResearchTaskCard({ task, onRefresh, onDelete }: ResearchTaskCardProps) {
  const t = useTranslations('tasks')
  const locale = useLocale()
  const [expanded, setExpanded] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const displayTitle = task.reportTitle?.trim() || task.topic

  const stageMap = useMemo<Record<string, string>>(
    () => ({
      queued: t('research.stages.queued'),
      decomposing: t('research.stages.decomposing'),
      planning_queries: t('research.stages.planningQueries'),
      searching: t('research.stages.searching'),
      writing_report: t('research.stages.writingReport'),
      completed: t('research.stages.completed'),
      failed: t('research.stages.failed'),
    }),
    [t]
  )

  const stageLabel = useMemo(() => {
    return stageMap[task.stage] || task.stage || '-'
  }, [stageMap, task.stage])

  const progressValue = Number.isFinite(task.progress)
    ? Math.max(0, Math.min(100, Math.trunc(task.progress)))
    : 0

  const canRefresh = task.status === 'pending' || task.status === 'processing'
  const showReport = task.status === 'completed' && Boolean(task.report)
  const canExportReport = task.status === 'completed' && Boolean(task.report?.trim())
  const canDeleteTask = task.status !== 'processing'

  const handleExportReport = async () => {
    if (!task.report?.trim()) {
      toast.error(t('research.exportFailed'))
      return
    }

    const ok = await exportResearchReportToWord({
      report: task.report,
      topic: displayTitle,
      taskNo: task.taskNo,
      modelName: task.modelName,
      generatedAt: task.completedAt || task.updatedAt,
      locale,
    })

    if (ok) {
      toast.success(t('research.exportSuccess'))
      return
    }
    toast.error(t('research.exportFailed'))
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await researchService.deleteTask(task.id)
      toast.success(t('success.deleted'))
      setShowConfirmDelete(false)
      onDelete?.()
    } catch (error) {
      console.error('Failed to delete research task:', error)
      const message = error instanceof Error ? error.message : t('errors.delete')
      toast.error(message || t('errors.delete'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="h-full p-4 md:p-5">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              <Brain className="h-3.5 w-3.5" />
              {t('research.badge')}
            </div>
            <h3 className="mt-2 text-base font-semibold text-stone-900 dark:text-stone-100 line-clamp-2">
              {displayTitle}
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              {t('research.taskNo')}: #{task.taskNo}
            </p>
          </div>

          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium',
              statusColors[task.status]
            )}
          >
            {t(`status.${task.status}`)}
          </span>
        </div>

        <div className="space-y-2 text-sm text-stone-600 dark:text-stone-300">
          <div className="flex items-center justify-between gap-2">
            <span>{t('info.model')}</span>
            <span className="font-medium text-stone-800 dark:text-stone-100">
              {task.modelName || '-'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>{t('research.stage')}</span>
            <span className="font-medium text-stone-800 dark:text-stone-100">{stageLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>{t('info.cost')}</span>
            <span className="font-medium text-stone-800 dark:text-stone-100">
              {task.creditsCost ?? 0}
            </span>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
            <span>{t('research.progress')}</span>
            <span>{progressValue}%</span>
          </div>
          <div className="h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-blue-500 to-cyan-500 transition-all duration-300"
              style={{ width: `${progressValue}%` }}
            />
          </div>
        </div>

        {task.status === 'failed' && task.errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {task.errorMessage}
          </div>
        ) : null}

        {showReport ? (
          <div className="space-y-2">
            <button
              type="button"
              className="text-sm font-medium text-aurora-purple hover:text-aurora-purple/80"
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? t('research.hideReport') : t('research.viewReport')}
            </button>

            {expanded ? (
              <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3 dark:border-stone-700 dark:bg-stone-800/50 max-h-[420px] overflow-y-auto">
                <ChatMarkdown content={task.report || ''} />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {canExportReport ? (
            <Button variant="secondary" size="sm" onClick={() => void handleExportReport()}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {t('research.exportWord')}
            </Button>
          ) : null}

          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={!canRefresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t('research.refresh')}
          </Button>

          {!showConfirmDelete ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirmDelete(true)}
              disabled={!canDeleteTask || isDeleting}
              className="shrink-0 whitespace-nowrap text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t('actions.delete')}
            </Button>
          ) : (
            <div className="inline-flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirmDelete(false)}
                disabled={isDeleting}
                className="whitespace-nowrap"
              >
                {t('confirm.delete.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="whitespace-nowrap bg-red-600 text-white hover:bg-red-700"
              >
                {t('confirm.delete.confirm')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
