'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'

import { FadeIn } from '@/components/shared/FadeIn'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { DataTable, DataTableColumn } from '@/components/admin/tables/DataTable'
import { Pagination } from '@/components/admin/shared/Pagination'
import { Button } from '@/components/ui/Button'
import { adminProjectService } from '@/lib/api/services/admin/projects'
import type { AdminProjectItem } from '@/lib/api/types/admin/projects'
import { cn } from '@/lib/utils'

export default function AdminProjectsPage() {
  // Projects state
  const [projects, setProjects] = useState<AdminProjectItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const totalPages = Math.ceil(total / pageSize)

  // Filters
  const [userIdFilter, setUserIdFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Free quota
  const [freeQuota, setFreeQuota] = useState('')
  const [freeQuotaLoading, setFreeQuotaLoading] = useState(false)
  const [freeQuotaSaving, setFreeQuotaSaving] = useState(false)

  // Fetch projects
  const fetchProjects = async () => {
    setLoading(true)
    try {
      const response = await adminProjectService.getProjects({
        page,
        limit: pageSize,
        userId: userIdFilter.trim() || undefined,
        q: searchQuery.trim() || undefined,
      })
      setProjects(response.items)
      setTotal(response.total)
    } catch (error) {
      console.error('Failed to fetch projects:', error)
      toast.error('加载项目列表失败')
    } finally {
      setLoading(false)
    }
  }

  // Fetch free quota
  const fetchFreeQuota = async () => {
    setFreeQuotaLoading(true)
    try {
      const data = await adminProjectService.getFreeProjectQuota()
      setFreeQuota(String(data.maxCount))
    } catch (error) {
      console.error('Failed to fetch free quota:', error)
    } finally {
      setFreeQuotaLoading(false)
    }
  }

  // Save free quota
  const handleSaveFreeQuota = async () => {
    const raw = freeQuota.trim()
    const parsed = raw ? Number(raw) : null

    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
      toast.error('请输入一个非负整数')
      return
    }

    setFreeQuotaSaving(true)
    try {
      const result = await adminProjectService.updateFreeProjectQuota({
        maxCount: parsed,
      })
      setFreeQuota(String(result.maxCount))
      toast.success('免费用户项目上限已保存')
    } catch (error) {
      console.error('Failed to save free quota:', error)
      toast.error('保存失败')
    } finally {
      setFreeQuotaSaving(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    void fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    void fetchFreeQuota()
  }, [])

  // Handle search
  const handleSearch = () => {
    setPage(1)
    void fetchProjects()
  }

  const handleClearFilters = () => {
    setUserIdFilter('')
    setSearchQuery('')
    setPage(1)
    // Will trigger refetch via the page change if page was already 1, otherwise manual
    setTimeout(() => void fetchProjects(), 0)
  }

  // Columns
  const columns: DataTableColumn<AdminProjectItem>[] = useMemo(
    () => [
      {
        key: 'name',
        label: '项目名称',
        width: '220px',
        render: (project) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-stone-900">{project.name}</p>
            <p className="truncate text-xs text-stone-500">ID: {project.id}</p>
          </div>
        ),
      },
      {
        key: 'user',
        label: '所属用户',
        width: '200px',
        render: (project) => (
          <div className="min-w-0 text-sm">
            <p className="truncate text-stone-900">
              {project.user.username || project.user.email}
            </p>
            {project.user.username && (
              <p className="truncate text-xs text-stone-500">{project.user.email}</p>
            )}
            <p className="text-xs text-stone-400">UID: {project.user.id}</p>
          </div>
        ),
      },
      {
        key: 'concept',
        label: '概念',
        render: (project) => (
          <p className="max-w-xs truncate text-sm text-stone-700">
            {project.concept || '-'}
          </p>
        ),
      },
      {
        key: 'assetCount',
        label: '资源数',
        width: '80px',
        align: 'center',
        render: (project) => (
          <span className="font-medium text-violet-600">{project.assetCount}</span>
        ),
      },
      {
        key: 'inspirationCount',
        label: '灵感数',
        width: '80px',
        align: 'center',
        render: (project) => (
          <span className="font-medium text-amber-600">{project.inspirationCount}</span>
        ),
      },
      {
        key: 'createdAt',
        label: '创建时间',
        width: '160px',
        render: (project) => (
          <span className="text-xs text-stone-600">
            {new Date(project.createdAt).toLocaleString('zh-CN')}
          </span>
        ),
      },
      {
        key: 'updatedAt',
        label: '更新时间',
        width: '160px',
        render: (project) => (
          <span className="text-xs text-stone-600">
            {new Date(project.updatedAt).toLocaleString('zh-CN')}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <AdminPageShell title="项目管理" description="管理所有用户的项目，设置免费用户的项目创建上限">
      {/* Free Quota Config */}
      <FadeIn variant="fade" delay={0.05}>
        <div className="rounded-xl bg-white p-6 border border-stone-200 shadow-sm">
          <h3 className="font-ui text-sm font-semibold text-stone-900 mb-4">
            免费用户项目上限
          </h3>
          <div className="flex items-end gap-4">
            <div className="w-48">
              <label className="block font-ui text-xs font-medium text-stone-600 mb-1.5">
                最大项目数量
              </label>
              {freeQuotaLoading ? (
                <div className="h-10 animate-pulse rounded-lg bg-stone-100" />
              ) : (
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={freeQuota}
                  onChange={(e) => setFreeQuota(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border border-stone-200 px-4 py-2.5',
                    'font-ui text-sm text-stone-900',
                    'placeholder:text-stone-400',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors',
                  )}
                  placeholder="3"
                />
              )}
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSaveFreeQuota()}
              isLoading={freeQuotaSaving}
              disabled={freeQuotaSaving || freeQuotaLoading}
            >
              保存
            </Button>
            <p className="text-xs text-stone-500 pb-1">
              未购买会员的用户可创建的最大项目数量。会员用户的上限在会员等级的权限配置中设置。
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn variant="fade" delay={0.1}>
        <div className="rounded-xl bg-white p-6 border border-stone-200 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Search by project name */}
            <div className="md:col-span-2">
              <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                搜索项目
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="搜索项目名称..."
                  className={cn(
                    'flex-1 rounded-lg border border-stone-200 px-4 py-2',
                    'font-ui text-sm text-stone-900',
                    'placeholder:text-stone-400',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors',
                  )}
                />
                <button
                  onClick={handleSearch}
                  className={cn(
                    'rounded-lg px-6 py-2 font-ui text-sm font-medium',
                    'bg-aurora-purple text-white',
                    'hover:bg-aurora-purple/90',
                    'transition-colors',
                  )}
                >
                  搜索
                </button>
              </div>
            </div>

            {/* Filter by userId */}
            <div>
              <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                按用户 ID 筛选
              </label>
              <input
                type="text"
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="输入用户 ID"
                className={cn(
                  'w-full rounded-lg border border-stone-200 px-4 py-2',
                  'font-ui text-sm text-stone-900',
                  'placeholder:text-stone-400',
                  'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                  'transition-colors',
                )}
              />
            </div>

            {/* Clear */}
            <div className="flex items-end">
              <button
                onClick={handleClearFilters}
                className={cn(
                  'rounded-lg px-4 py-2 font-ui text-sm font-medium',
                  'border border-stone-200 bg-white text-stone-700',
                  'hover:bg-stone-50',
                  'transition-colors',
                )}
              >
                清除筛选
              </button>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Projects Table */}
      <FadeIn variant="fade" delay={0.2}>
        <div className="rounded-xl bg-white border border-stone-200 shadow-sm overflow-hidden">
          <DataTable
            data={projects}
            columns={columns}
            keyExtractor={(project) => project.id}
            loading={loading}
            emptyText="暂无项目"
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
  )
}
