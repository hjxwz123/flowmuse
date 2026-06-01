/**
 * 任务列表内容组件
 */

'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Columns2, Columns4, Images } from 'lucide-react'
import { Button, Card, Loading, SkeletonTaskCard } from '@/components/ui'
import { imageService, videoService, researchService, tasksService } from '@/lib/api/services'
import { useAuth } from '@/lib/hooks/useAuth'
import { useInboxPolling } from '@/lib/hooks/useInboxPolling'
import {
  getTasksViewCache,
  removeTaskFromTasksViewCache,
  setTasksViewCache,
  upsertTaskInTasksViewCache,
} from '@/lib/cache/viewCache'
import { TaskCard } from './TaskCard'
import { ResearchTaskCard } from './ResearchTaskCard'
import type { ApiTask, TaskStatus } from '@/lib/api/types/task'
import type { ApiResearchTask } from '@/lib/api/types/research'
import { cn } from '@/lib/utils/cn'
import { PageTransition } from '@/components/shared/PageTransition'
import { FadeIn } from '@/components/shared/FadeIn'

type TaskFilter = 'all' | TaskStatus
type TaskColumnMode = 2 | 4
type UnifiedTask = ApiTask | ApiResearchTask
type ImageTask = ApiTask & { type: 'image' }
type TaskListEntry =
  | { kind: 'single'; key: string; task: UnifiedTask }
  | { kind: 'group'; key: string; taskGroupId: string; tasks: ImageTask[] }

const TASKS_CACHE_MAX_AGE_MS = 5 * 60 * 1000
const TASKS_CACHE_FRESH_MS = 20 * 1000

function sortTasksByCreatedAtDesc(items: UnifiedTask[]) {
  return [...items].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )
}

function appendTasksStable(prev: UnifiedTask[], incoming: UnifiedTask[]) {
  const existingKeys = new Set(prev.map((task) => `${task.type}-${task.id}`))
  const dedupedIncoming = sortTasksByCreatedAtDesc(incoming).filter((task) => {
    const key = `${task.type}-${task.id}`
    if (existingKeys.has(key)) return false
    existingKeys.add(key)
    return true
  })

  return [...prev, ...dedupedIncoming]
}

function isImageTask(task: UnifiedTask): task is ImageTask {
  return task.type === 'image'
}

function groupTasksForDisplay(items: UnifiedTask[]): TaskListEntry[] {
  const entries: TaskListEntry[] = []
  const groupedIndexes = new Map<string, number>()

  for (const task of items) {
    if (!isImageTask(task) || !task.taskGroupId) {
      entries.push({ kind: 'single', key: `${task.type}-${task.id}`, task })
      continue
    }

    const existingIndex = groupedIndexes.get(task.taskGroupId)
    if (existingIndex === undefined) {
      groupedIndexes.set(task.taskGroupId, entries.length)
      entries.push({
        kind: 'group',
        key: `group-${task.taskGroupId}`,
        taskGroupId: task.taskGroupId,
        tasks: [task],
      })
      continue
    }

    const existingEntry = entries[existingIndex]
    if (existingEntry.kind === 'group') {
      existingEntry.tasks.push(task)
    }
  }

  return entries.map((entry) => {
    if (entry.kind !== 'group' || entry.tasks.length > 1) return entry
    return {
      kind: 'single',
      key: `${entry.tasks[0].type}-${entry.tasks[0].id}`,
      task: entry.tasks[0],
    }
  })
}

function getGroupPreviewTileClass(count: number, index: number) {
  if (count === 1) return 'col-span-2 row-span-2'
  if (count === 2) return 'row-span-2'
  if (count === 3 && index === 0) return 'row-span-2'
  return ''
}

function TaskGroupCard({
  taskGroupId,
  tasks,
  onOpen,
}: {
  taskGroupId: string
  tasks: ImageTask[]
  onOpen: () => void
}) {
  const t = useTranslations('tasks')
  const previewTasks = tasks.slice(0, 4)
  const leadTask = tasks[0]
  const completedCount = tasks.filter((task) => task.status === 'completed').length
  const totalCredits = tasks.reduce((sum, task) => sum + (task.creditsCost || 0), 0)
  const title = leadTask.toolTitle || leadTask.prompt || t('group.untitled')

  return (
    <Card variant="glass" className="overflow-hidden p-0">
      <button
        type="button"
        onClick={onOpen}
        className="group block h-full w-full text-left transition-transform duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-aurora-purple/40"
        aria-label={t('group.openAria', { count: tasks.length })}
      >
        <div className="relative aspect-video overflow-hidden bg-stone-100 dark:bg-stone-800">
          <div className="grid h-full grid-cols-2 grid-rows-2 gap-1 p-1">
            {previewTasks.map((task, index) => {
              const imageUrl = task.thumbnailUrl || task.resultUrl
              return (
                <div
                  key={task.id}
                  className={cn(
                    'relative overflow-hidden rounded-lg bg-stone-200 dark:bg-stone-700',
                    getGroupPreviewTileClass(previewTasks.length, index)
                  )}
                >
                  {task.status === 'completed' && imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={task.prompt || t('group.previewAlt')}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-700">
                      <Images className="h-7 w-7 text-stone-400 dark:text-stone-500" />
                    </div>
                  )}
                  {index === 3 && tasks.length > 4 ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
                      +{tasks.length - 4}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="absolute left-3 top-3 rounded-full border border-white/30 bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {t('group.imageCount', { count: tasks.length })}
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold leading-6 text-stone-950 transition-colors group-hover:text-aurora-purple dark:text-white dark:group-hover:text-aurora-pink">
                {title}
              </p>
              <p className="mt-1 font-mono text-[11px] text-stone-500 dark:text-stone-400">
                {taskGroupId}
              </p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-stone-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-aurora-purple dark:group-hover:text-aurora-pink" />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
            <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 dark:border-stone-700 dark:bg-stone-900">
              {t('group.completedCount', { completed: completedCount, count: tasks.length })}
            </span>
            <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 dark:border-stone-700 dark:bg-stone-900">
              {t('info.cost')}: {totalCredits}
            </span>
            <span className="rounded-full border border-aurora-purple/20 bg-aurora-purple/10 px-2.5 py-1 text-aurora-purple dark:border-aurora-purple/30 dark:bg-aurora-purple/10 dark:text-aurora-pink">
              {t('group.open')}
            </span>
          </div>
        </div>
      </button>
    </Card>
  )
}

export function TasksContent() {
  const t = useTranslations('tasks')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, isReady, requireAuth } = useAuth()
  const taskGroupId = searchParams.get('groupId')?.trim() || ''
  const isGroupView = Boolean(taskGroupId)

  const [tasks, setTasks] = useState<UnifiedTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('all')
  const [taskColumnMode, setTaskColumnMode] = useState<TaskColumnMode>(2)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const loadingRef = useRef(false)
  const tasksRef = useRef<UnifiedTask[]>([])
  const pageRef = useRef(1)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const pageSize = 10
  const userId = user?.id ?? null

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    pageRef.current = page
  }, [page])

  useEffect(() => {
    if (isGroupView) {
      setActiveFilter('all')
    }
  }, [isGroupView, taskGroupId])

  const applyTaskUpdate = useCallback(
    (nextTask: UnifiedTask) => {
      setTasks((prev) => {
        const taskKey = `${nextTask.type}-${nextTask.id}`
        return sortTasksByCreatedAtDesc([
          nextTask,
          ...prev.filter((item) => `${item.type}-${item.id}` !== taskKey),
        ])
      })
      upsertTaskInTasksViewCache(userId, nextTask)
    },
    [userId]
  )

  // 加载任务列表
  const loadTasks = useCallback(
    async (pageNum: number, append: boolean = false, options?: { silent?: boolean }) => {
      if (!isAuthenticated || loadingRef.current) return
      loadingRef.current = true
      const silent = options?.silent ?? false

      try {
        if (append) {
          setIsLoadingMore(true)
        } else if (!silent) {
          setIsLoading(true)
        }

        const feedResult = await tasksService.getFeed({ page: pageNum, limit: pageSize })
        const feedTasks = sortTasksByCreatedAtDesc(feedResult.data || [])
        const nextTasks = append ? appendTasksStable(tasksRef.current, feedTasks) : feedTasks
        setTasks(nextTasks)

        const hasMoreData = Boolean(feedResult.pagination.hasMore)
        setHasMore(hasMoreData)
        setPage(pageNum)
        setError(null)
        setTasksViewCache(userId, {
          tasks: nextTasks,
          page: pageNum,
          hasMore: hasMoreData,
        })
      } catch (err) {
        console.error('[TasksContent] Failed to load tasks:', err)
        if (!silent || tasksRef.current.length === 0) {
          setError(t('errors.load'))
        }
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
        loadingRef.current = false
      }
    },
    [isAuthenticated, t, userId]
  )

  const loadTaskGroup = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isAuthenticated || !taskGroupId || loadingRef.current) return
      loadingRef.current = true
      const silent = options?.silent ?? false

      try {
        if (!silent) {
          setIsLoading(true)
        }

        const groupTasks = await tasksService.getImageGroup(taskGroupId)
        setTasks(sortTasksByCreatedAtDesc(groupTasks))
        setHasMore(false)
        setPage(1)
        setError(null)
      } catch (err) {
        console.error('[TasksContent] Failed to load task group:', err)
        if (!silent || tasksRef.current.length === 0) {
          setError(t('errors.loadGroup'))
        }
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
        loadingRef.current = false
      }
    },
    [isAuthenticated, taskGroupId, t]
  )

  const loadNextPage = useCallback(async () => {
    if (isGroupView || !isAuthenticated || !hasMore || loadingRef.current) return
    await loadTasks(pageRef.current + 1, true)
  }, [hasMore, isAuthenticated, isGroupView, loadTasks])

  // 等待 hydration 完成后再检查认证和加载数据
  useEffect(() => {
    if (!isReady) return

    if (requireAuth()) {
      if (isGroupView) {
        void loadTaskGroup()
        return
      }

      const cached = getTasksViewCache(userId, TASKS_CACHE_MAX_AGE_MS)
      if (cached) {
        setTasks(cached.tasks)
        setPage(cached.page)
        setHasMore(cached.hasMore)
        setError(null)
        setIsLoading(false)

        if (cached.page === 1 && Date.now() - cached.cachedAt > TASKS_CACHE_FRESH_MS) {
          void loadTasks(1, false, { silent: true })
        }
        return
      }

      void loadTasks(1, false)
    }
  }, [isGroupView, isReady, loadTaskGroup, loadTasks, requireAuth, userId])

  // 更新单个任务
  const updateTask = useCallback(
    async (taskType: 'image' | 'video' | 'research', taskId: string) => {
      try {
        // 根据类型获取任务详情
        const taskDetail =
          taskType === 'research'
            ? await researchService.getTask(taskId)
            : taskType === 'image'
            ? await imageService.getTask(taskId)
            : await videoService.getTask(taskId)

        if (isGroupView && (taskDetail.type !== 'image' || taskDetail.taskGroupId !== taskGroupId)) {
          return
        }

        // 更新任务列表中的对应任务
        applyTaskUpdate(taskDetail)
      } catch (error) {
        console.error('[TasksContent] 更新任务失败:', error)
      }
    },
    [applyTaskUpdate, isGroupView, taskGroupId]
  )

  // 收件箱轮询 - 监听任务完成/失败消息
  useInboxPolling({
    onTaskMessage: (message) => {
      updateTask(message.taskType, message.taskId)
    },
    enabled: isAuthenticated,
  })

  // 底部哨兵触发加载更多，避免全局 scroll 监听带来的滚动卡顿
  useEffect(() => {
    if (isGroupView || !hasMore || !isAuthenticated) return
    const sentinel = loadMoreRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        void loadNextPage()
      },
      { root: null, rootMargin: '480px 0px', threshold: 0.01 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isAuthenticated, isGroupView, loadNextPage])

  useEffect(() => {
    if (isGroupView || !hasMore || !isAuthenticated) return

    let ticking = false

    const checkShouldLoadMore = () => {
      ticking = false
      if (loadingRef.current) return

      const doc = document.documentElement
      const remaining = doc.scrollHeight - (window.scrollY + window.innerHeight)
      if (remaining <= 480) {
        void loadNextPage()
      }
    }

    const handleScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(checkShouldLoadMore)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [hasMore, isAuthenticated, isGroupView, loadNextPage])

  // 过滤任务
  const filteredTasks = useMemo(
    () => (activeFilter === 'all' ? tasks : tasks.filter((task) => task.status === activeFilter)),
    [activeFilter, tasks],
  )
  const taskEntries = useMemo(
    () =>
      isGroupView
        ? filteredTasks.map((task) => ({ kind: 'single' as const, key: `${task.type}-${task.id}`, task }))
        : groupTasksForDisplay(filteredTasks),
    [filteredTasks, isGroupView]
  )
  const masonryClassName = cn(
    'gap-6',
    taskColumnMode === 4 ? 'columns-1 xl:columns-4' : 'columns-1 xl:columns-2'
  )
  const skeletonCount = taskColumnMode === 4 ? 8 : 4

  const handleRetryLoad = () => {
    if (isGroupView) {
      void loadTaskGroup()
      return
    }

    void loadTasks(1, false)
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas dark:bg-canvas-dark px-4">
        <Card className="text-center max-w-md">
          <h2 className="font-display text-2xl text-stone-900 dark:text-stone-100 mb-4">
            {t('title')}
          </h2>
          <p className="font-ui text-stone-600 dark:text-stone-400 mb-6">
            {t('auth.required')}
          </p>
          <Button onClick={() => router.push(`/${locale}/auth/login`)}>
            {t('auth.login')}
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <PageTransition className="min-h-screen bg-canvas px-3 py-6 dark:bg-canvas-dark md:px-4 md:py-8">
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6">
        <FadeIn variant="slide">
          <section className="mb-2 flex flex-col gap-4 md:mb-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-stone-950 dark:text-white md:text-4xl">
                  {isGroupView ? t('group.pageTitle') : t('title')}
                </h1>
                {!isGroupView ? (
                  <div
                    className="hidden items-center gap-1 rounded-full border border-stone-200/80 bg-white p-1 shadow-sm dark:border-stone-800/80 dark:bg-stone-950 xl:inline-flex"
                    aria-label={t('view.label')}
                  >
                    {[
                      { value: 2 as const, label: t('view.two'), aria: t('view.twoAria'), icon: Columns2 },
                      { value: 4 as const, label: t('view.four'), aria: t('view.fourAria'), icon: Columns4 },
                    ].map((item) => {
                      const Icon = item.icon
                      const active = taskColumnMode === item.value

                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setTaskColumnMode(item.value)}
                          aria-label={item.aria}
                          aria-pressed={active}
                          title={item.aria}
                          className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-all duration-200',
                            active
                              ? 'theme-toggle-active'
                              : 'text-stone-500 hover:text-stone-950 dark:text-stone-400 dark:hover:text-white'
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
              {isGroupView ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/tasks`)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:border-aurora-purple/35 hover:text-aurora-purple dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300 dark:hover:border-aurora-purple/35 dark:hover:text-aurora-pink"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {t('group.back')}
                  </button>
                  <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 font-mono text-[11px] text-stone-500 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400">
                    {taskGroupId}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="w-full md:max-w-md">
              <div className="overflow-x-auto rounded-[22px] border border-stone-200/80 bg-white p-1 dark:border-stone-800/80 dark:bg-stone-950">
                <div className="inline-flex min-w-full items-center gap-1">
                  {(
                    ['all', 'pending', 'processing', 'completed', 'failed'] as TaskFilter[]
                  ).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      className={cn(
                        'flex-1 whitespace-nowrap rounded-[18px] px-4 py-2.5 text-sm font-medium transition-all duration-200',
                        activeFilter === filter
                          ? 'theme-toggle-active'
                          : 'text-stone-600 hover:text-stone-950 dark:text-stone-300 dark:hover:text-white'
                      )}
                    >
                      {t(`tabs.${filter}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </FadeIn>

        {/* Task List */}
        {isLoading ? (
          <FadeIn variant="fade" delay={0.2}>
            <div className={masonryClassName}>
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <div key={i} className="mb-6 break-inside-avoid">
                  <SkeletonTaskCard />
                </div>
              ))}
            </div>
          </FadeIn>
        ) : error ? (
          <Card className="text-center py-12">
            <p className="font-ui text-red-600 mb-4">{error}</p>
            <Button onClick={handleRetryLoad} variant="secondary">
              重试
            </Button>
          </Card>
        ) : filteredTasks.length === 0 ? (
          <Card className="text-center py-12">
            <h3 className="font-display text-2xl text-stone-900 dark:text-stone-100 mb-2">
              {t('empty.title')}
            </h3>
            <p className="font-ui text-stone-600 dark:text-stone-400 mb-6">
              {t('empty.description')}
            </p>
            <Button onClick={() => router.push(`/${locale}/create`)}>
              {t('empty.action')}
            </Button>
          </Card>
        ) : (
          <>
            <FadeIn variant="fade" delay={0.2}>
              <div className={masonryClassName}>
                {taskEntries.map((entry, index) => (
                  <div key={entry.key} className="mb-6 break-inside-avoid">
                    <FadeIn variant="scale" delay={Math.min(index, 6) * 0.04}>
                      {entry.kind === 'group' ? (
                        <TaskGroupCard
                          taskGroupId={entry.taskGroupId}
                          tasks={entry.tasks}
                          onOpen={() => router.push(`/${locale}/tasks?groupId=${encodeURIComponent(entry.taskGroupId)}`)}
                        />
                      ) : entry.task.type === 'research' ? (
                        <ResearchTaskCard
                          task={entry.task}
                          onRefresh={() => {
                            void updateTask(entry.task.type, entry.task.id)
                          }}
                          onDelete={() => {
                            setTasks((prev) => prev.filter((item) => !(item.type === entry.task.type && item.id === entry.task.id)))
                            removeTaskFromTasksViewCache(userId, entry.task.type, entry.task.id)
                          }}
                        />
                      ) : (
                        <TaskCard
                          task={entry.task}
                          onUpdate={(nextTask) => {
                            if (nextTask) {
                              applyTaskUpdate(nextTask)
                              return
                            }
                            void updateTask(entry.task.type, entry.task.id)
                          }}
                          onDelete={() => {
                            setTasks((prev) => prev.filter((item) => !(item.type === entry.task.type && item.id === entry.task.id)))
                            removeTaskFromTasksViewCache(userId, entry.task.type, entry.task.id)
                          }}
                        />
                      )}
                    </FadeIn>
                  </div>
                ))}
              </div>
            </FadeIn>

            {/* Loading More Indicator */}
            {isLoadingMore && (
              <div className="flex justify-center py-8">
                <Loading />
              </div>
            )}
            {/* No More Data Message */}
            {!isGroupView && !hasMore && tasks.length > 0 && (
              <div className="text-center py-8">
                <p className="font-ui text-sm text-stone-500">
                  已加载全部任务
                </p>
              </div>
            )}
          </>
        )}

        {!isGroupView && !isLoading && !error && hasMore && <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" />}
      </div>
    </PageTransition>
  )
}
