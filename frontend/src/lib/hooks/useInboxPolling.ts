/**
 * 收件箱任务通知 Hook
 * 兼容原有调用方，底层已切换为 SSE 事件驱动，不再轮询数据库。
 */

import { useEffect, useRef } from 'react'

import type { InboxStreamEvent } from '../api/types/inbox'
import type { ApiResearchTask } from '../api/types/research'
import type { ApiTask } from '../api/types/task'
import { useInboxStore } from '../store/inboxStore'

interface UseInboxPollingOptions {
  onTaskMessage?: (message: { taskType: 'image' | 'video' | 'research'; taskId: string }) => void
  onTaskUpdated?: (task: ApiTask) => void
  onResearchUpdated?: (task: ApiResearchTask) => void
  enabled?: boolean
}

export const useInboxPolling = ({
  onTaskMessage,
  onTaskUpdated,
  onResearchUpdated,
  enabled = true,
}: UseInboxPollingOptions) => {
  const { latestEvent } = useInboxStore()
  const lastHandledMessageIdRef = useRef<string | null>(null)
  const lastHandledTaskUpdateRef = useRef<string | null>(null)
  const lastHandledResearchUpdateRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !onTaskMessage || !latestEvent) return
    if (latestEvent.type !== 'message_created') return

    const event = latestEvent as Extract<InboxStreamEvent, { type: 'message_created' }>
    const meta = event.message.meta
    const taskType =
      meta && typeof meta === 'object' && 'taskType' in meta ? meta.taskType : undefined
    const taskId =
      meta && typeof meta === 'object' && 'taskId' in meta ? meta.taskId : undefined

    if (
      (taskType !== 'image' && taskType !== 'video' && taskType !== 'research') ||
      typeof taskId !== 'string' ||
      taskId.length === 0
    ) {
      return
    }
    if (lastHandledMessageIdRef.current === event.message.id) return

    lastHandledMessageIdRef.current = event.message.id
    onTaskMessage({ taskType, taskId })
  }, [enabled, latestEvent, onTaskMessage])

  useEffect(() => {
    if (!enabled || !onTaskUpdated || !latestEvent) return
    if (latestEvent.type !== 'task_updated') return

    const event = latestEvent as Extract<InboxStreamEvent, { type: 'task_updated' }>
    const marker = [
      event.task.type,
      event.task.id,
      event.task.status,
      event.task.resultUrl ?? '',
      event.task.errorMessage ?? '',
      event.task.completedAt ?? '',
    ].join(':')

    if (lastHandledTaskUpdateRef.current === marker) return
    lastHandledTaskUpdateRef.current = marker
    onTaskUpdated(event.task)
  }, [enabled, latestEvent, onTaskUpdated])

  useEffect(() => {
    if (!enabled || !onResearchUpdated || !latestEvent) return
    if (latestEvent.type !== 'research_updated') return

    const event = latestEvent as Extract<InboxStreamEvent, { type: 'research_updated' }>
    const marker = [
      event.task.id,
      event.task.status,
      event.task.stage,
      String(event.task.progress),
      event.task.updatedAt,
    ].join(':')

    if (lastHandledResearchUpdateRef.current === marker) return
    lastHandledResearchUpdateRef.current = marker
    onResearchUpdated(event.task)
  }, [enabled, latestEvent, onResearchUpdated])

  return {
    isPolling: enabled,
  }
}
