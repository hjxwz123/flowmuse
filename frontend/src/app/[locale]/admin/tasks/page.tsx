/**
 * 任务管理页面
 * 包含任务列表、筛选、统计等功能
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { FadeIn } from '@/components/shared/FadeIn'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { DataTable, DataTableColumn } from '@/components/admin/tables/DataTable'
import { StatusBadge } from '@/components/admin/shared/StatusBadge'
import { Pagination } from '@/components/admin/shared/Pagination'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { adminTaskService } from '@/lib/api/services/admin/tasks'
import type { ApiTask, TaskType, TaskStatus, TaskStats, TaskDetailResponse } from '@/lib/api/types/admin/tasks'
import { cn } from '@/lib/utils'

export default function AdminTasksPage() {
  const t = useTranslations('admin.tasks')
  const tCommon = useTranslations('admin.common')

  // Tasks state
  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [taskDetail, setTaskDetail] = useState<TaskDetailResponse | null>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const totalPages = Math.ceil(total / pageSize)

  // Filters
  const [typeFilter, setTypeFilter] = useState<TaskType | ''>('')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch tasks
  const fetchTasks = async () => {
    setLoading(true)
    try {
      // Ensure valid pagination parameters with robust fallbacks
      const validPage = !page || isNaN(page) || page < 1 ? 1 : Math.floor(page)
      const validPageSize = !pageSize || isNaN(pageSize) || pageSize < 1
        ? 20
        : Math.min(100, Math.floor(pageSize))

      const response = await adminTaskService.getTasks({
        page: validPage,
        pageSize: validPageSize,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        q: searchQuery || undefined,
      })
      setTasks(response.items)
      setTotal(response.total)
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch stats
  const fetchStats = async () => {
    try {
      const statsData = await adminTaskService.getTaskStats()
      setStats(statsData)
    } catch (error) {
      console.error('Failed to fetch task stats:', error)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchTasks()
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, typeFilter, statusFilter])

  // Handle search
  const handleSearch = () => {
    setPage(1)
    fetchTasks()
  }

  const openDetail = async (task: ApiTask) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setTaskDetail(null)
    try {
      const detail = await adminTaskService.getTaskDetail(task.id, task.type)
      setTaskDetail(detail)
    } catch (error) {
      console.error('Failed to fetch task detail:', error)
    } finally {
      setDetailLoading(false)
    }
  }

  // Task columns
  const taskColumns: DataTableColumn<ApiTask>[] = [
    {
      key: 'taskNo',
      label: t('fields.taskNo'),
      width: '200px',
      render: (task) => (
        <div>
          <p className="font-mono text-xs text-stone-900">{task.taskNo}</p>
          <p className="text-xs text-stone-500">ID: {task.id}</p>
        </div>
      ),
    },
    {
      key: 'user',
      label: '用户',
      width: '180px',
      render: (task) => (
        <div className="text-sm">
          {task.user ? (
            <>
              <p className="text-stone-900 truncate">
                {task.user.username || task.user.email}
              </p>
              {task.user.username && (
                <p className="text-xs text-stone-500 truncate">{task.user.email}</p>
              )}
            </>
          ) : (
            <span className="text-stone-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      label: t('fields.type'),
      width: '100px',
      render: (task) => (
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2.5 py-0.5 font-ui text-xs font-semibold',
            task.type === 'image'
              ? 'bg-blue-100 text-blue-700 border-blue-200'
              : task.type === 'video'
                ? 'bg-purple-100 text-purple-700 border-purple-200'
                : 'bg-emerald-100 text-emerald-700 border-emerald-200'
          )}
        >
          {task.type === 'image' ? '图片' : task.type === 'video' ? '视频' : '深度研究'}
        </span>
      ),
    },
    {
      key: 'prompt',
      label: t('fields.prompt'),
      render: (task) => (
        <p className="max-w-md truncate text-sm text-stone-700">
          {task.prompt}
        </p>
      ),
    },
    {
      key: 'provider',
      label: t('fields.provider'),
      width: '120px',
      render: (task) => (
        <span className="text-sm text-stone-700">{task.provider}</span>
      ),
    },
    {
      key: 'status',
      label: t('fields.status'),
      width: '100px',
      align: 'center',
      render: (task) => {
        const statusMap: Record<TaskStatus, 'pending' | 'processing' | 'completed' | 'failed'> = {
          pending: 'pending',
          processing: 'processing',
          completed: 'completed',
          failed: 'failed',
        }
        return <StatusBadge status={statusMap[task.status]} />
      },
    },
    {
      key: 'credits',
      label: t('fields.credits'),
      width: '80px',
      align: 'right',
      render: (task) => (
        <span className="font-medium text-aurora-purple">
          {task.creditsCost ?? '-'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: t('fields.createdAt'),
      width: '150px',
      render: (task) => (
        <span className="text-xs text-stone-600">
          {new Date(task.createdAt).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'errorMessage',
      label: '错误',
      render: (task) =>
        task.status === 'failed' ? (
          <span className="text-xs text-red-600 line-clamp-1">{task.errorMessage || '-'}</span>
        ) : (
          <span className="text-xs text-stone-400">-</span>
        ),
    },
    {
      key: 'actions',
      label: '操作',
      width: '120px',
      align: 'center',
      render: (task) => (
        <button
          onClick={() => openDetail(task)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            'bg-stone-100 text-stone-700 hover:bg-stone-200'
          )}
        >
          详情
        </button>
      ),
    },
  ]

  return (
    <>
      <AdminPageShell title={t('title')} description="管理和监控所有 AI 生成任务">
        {/* Stats Cards */}
        {stats && stats.totals && stats.byStatus && (
          <FadeIn variant="fade" delay={0.05}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
              <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4 border border-blue-200">
                <p className="font-ui text-sm text-blue-700">总任务数</p>
                <p className="mt-1 font-display text-2xl font-bold text-blue-900">
                  {stats.totals.all.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 border border-yellow-200">
                <p className="font-ui text-sm text-yellow-700">等待中</p>
                <p className="mt-1 font-display text-2xl font-bold text-yellow-900">
                  {stats.byStatus.all.pending}
                </p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-4 border border-purple-200">
                <p className="font-ui text-sm text-purple-700">处理中</p>
                <p className="mt-1 font-display text-2xl font-bold text-purple-900">
                  {stats.byStatus.all.processing}
                </p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-green-50 to-green-100 p-4 border border-green-200">
                <p className="font-ui text-sm text-green-700">已完成</p>
                <p className="mt-1 font-display text-2xl font-bold text-green-900">
                  {stats.byStatus.all.completed}
                </p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-red-50 to-red-100 p-4 border border-red-200">
                <p className="font-ui text-sm text-red-700">失败</p>
                <p className="mt-1 font-display text-2xl font-bold text-red-900">
                  {stats.byStatus.all.failed}
                </p>
              </div>
            </div>
          </FadeIn>
        )}

        {/* Filters */}
        <FadeIn variant="fade" delay={0.1}>
          <div className="rounded-xl bg-white p-6 border border-stone-200 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  {tCommon('filters.search')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="搜索任务编号或提示词..."
                    className={cn(
                      'flex-1 rounded-lg border border-stone-200 px-4 py-2',
                      'font-ui text-sm text-stone-900',
                      'placeholder:text-stone-400',
                      'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                      'transition-colors'
                    )}
                  />
                  <button
                    onClick={handleSearch}
                    className={cn(
                      'rounded-lg px-6 py-2 font-ui text-sm font-medium',
                      'bg-aurora-purple text-white',
                      'hover:bg-aurora-purple/90',
                      'transition-colors'
                    )}
                  >
                    搜索
                  </button>
                </div>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  {t('filters.type')}
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value as TaskType | '')
                    setPage(1)
                  }}
                  className={cn(
                    'w-full rounded-lg border border-stone-200 px-4 py-2',
                    'font-ui text-sm text-stone-900',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors'
                  )}
                >
                  <option value="">全部类型</option>
                  <option value="image">图片</option>
                  <option value="video">视频</option>
                  <option value="research">深度研究</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  {t('filters.status')}
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as TaskStatus | '')
                    setPage(1)
                  }}
                  className={cn(
                    'w-full rounded-lg border border-stone-200 px-4 py-2',
                    'font-ui text-sm text-stone-900',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors'
                  )}
                >
                  <option value="">全部状态</option>
                  <option value="pending">等待中</option>
                  <option value="processing">处理中</option>
                  <option value="completed">已完成</option>
                  <option value="failed">失败</option>
                </select>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Tasks Table */}
        <FadeIn variant="fade" delay={0.2}>
          <div className="rounded-xl bg-white border border-stone-200 shadow-sm overflow-hidden">
            <DataTable
              data={tasks}
              columns={taskColumns}
              keyExtractor={(task) => task.id}
              loading={loading}
              emptyText={tCommon('status.noData')}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-stone-200 px-6 py-4">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        </FadeIn>
      </AdminPageShell>

      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="任务详情"
        size="lg"
      >
        {detailLoading ? (
          <div className="py-10 text-center text-stone-500">加载中...</div>
        ) : !taskDetail ? (
          <div className="py-10 text-center text-stone-500">暂无详情</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500 mb-1">用户</div>
                <div className="text-sm text-stone-900">{taskDetail.user.email}</div>
                {taskDetail.user.username ? (
                  <div className="text-xs text-stone-500 mt-1">@{taskDetail.user.username}</div>
                ) : null}
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500 mb-1">模型</div>
                <div className="text-sm text-stone-900">{taskDetail.model?.name ?? '-'}</div>
                <div className="text-xs text-stone-500 mt-1">
                  {taskDetail.model?.provider ?? '-'} / {taskDetail.model?.modelKey ?? '-'}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="text-xs text-stone-500 mb-2">
                {taskDetail.task.type === 'research' ? '研究主题' : '提示词'}
              </div>
              <div className="whitespace-pre-wrap text-sm text-stone-900">{taskDetail.task.prompt}</div>
            </div>

            {taskDetail.task.type === 'research' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="text-xs text-stone-500 mb-1">阶段</div>
                  <div className="text-sm text-stone-900">{taskDetail.task.stage ?? '-'}</div>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="text-xs text-stone-500 mb-1">进度</div>
                  <div className="text-sm text-stone-900">{taskDetail.task.progress ?? 0}%</div>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="text-xs text-stone-500 mb-1">报告标题</div>
                  <div className="text-sm text-stone-900">{taskDetail.task.providerData && typeof taskDetail.task.providerData === 'object' && 'reportTitle' in taskDetail.task.providerData ? String(taskDetail.task.providerData.reportTitle ?? '-') : '-'}</div>
                </div>
              </div>
            ) : null}

            {taskDetail.task.type === 'research' && taskDetail.task.report ? (
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500 mb-2">研究报告</div>
                <div className="max-h-[420px] overflow-auto whitespace-pre-wrap text-sm text-stone-900">
                  {taskDetail.task.report}
                </div>
              </div>
            ) : null}

            {taskDetail.task.status === 'failed' ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="text-xs text-red-700 mb-2">错误信息</div>
                <div className="whitespace-pre-wrap text-sm text-red-700">{taskDetail.task.errorMessage ?? '-'}</div>
              </div>
            ) : null}

            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-xs text-stone-500">上游返回（providerData）</div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(JSON.stringify(taskDetail.task.providerData ?? {}, null, 2))
                    } catch {
                      // ignore
                    }
                  }}
                >
                  复制
                </Button>
              </div>
              <pre className="text-xs text-stone-700 bg-stone-50 border border-stone-200 rounded-xl p-4 overflow-auto max-h-[420px]">
                {JSON.stringify(taskDetail.task.providerData ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
