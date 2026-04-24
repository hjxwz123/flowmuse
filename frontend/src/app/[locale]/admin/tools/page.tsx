'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { FadeIn } from '@/components/shared/FadeIn'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { DataTable, DataTableColumn } from '@/components/admin/tables/DataTable'
import { StatusBadge } from '@/components/admin/shared/StatusBadge'
import { Button } from '@/components/ui/Button'
import { ToolAdminModal } from '@/components/admin/tools/ToolAdminModal'
import { adminToolService } from '@/lib/api/services/admin/tools'
import type { Tool } from '@/lib/api/types/tools'
import { cn } from '@/lib/utils'

export default function AdminToolsPage() {
  const t = useTranslations('admin.tools')
  const tCommon = useTranslations('admin.common')

  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTool, setSelectedTool] = useState<Tool | undefined>()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all')

  const fetchTools = async () => {
    setLoading(true)
    try {
      const data = await adminToolService.getTools()
      setTools(data.sort((a, b) => a.sortOrder - b.sortOrder))
    } catch {
      console.error('Failed to fetch tools')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTools() }, [])

  const filteredTools = useMemo(() => {
    if (typeFilter === 'all') return tools
    return tools.filter((t) => t.type === typeFilter)
  }, [tools, typeFilter])

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm.delete'))) return
    setDeletingId(id)
    try {
      await adminToolService.deleteTool(id)
      await fetchTools()
    } catch {
      alert(t('error.delete'))
    } finally {
      setDeletingId(null)
    }
  }

  const columns: DataTableColumn<Tool>[] = useMemo(() => [
    {
      key: 'cover',
      label: '封面',
      width: '70px',
      render: (tool) =>
        tool.coverUrl ? (
          <img src={tool.coverUrl} alt={tool.title}
            className="w-12 h-12 rounded-lg object-cover border border-stone-200" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-aurora-pink/20 via-aurora-purple/20 to-aurora-blue/20 flex items-center justify-center border border-stone-200">
            <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
          </div>
        ),
    },
    {
      key: 'title',
      label: t('fields.title'),
      render: (tool) => (
        <div>
          <span className="font-medium text-stone-900">{tool.title}</span>
          {tool.description && (
            <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{tool.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      label: t('fields.type'),
      width: '90px',
      render: (tool) => (
        <span className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          tool.type === 'image' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
        )}>
          {tool.type === 'image' ? '图片' : '视频'}
        </span>
      ),
    },
    {
      key: 'model',
      label: t('fields.model'),
      width: '120px',
      render: (tool) => <span className="text-stone-600 text-sm">{tool.modelName}</span>,
    },
    {
      key: 'imageCount',
      label: t('fields.imageCount'),
      width: '80px',
      align: 'center',
      render: (tool) => (
        <span className="inline-flex items-center gap-1 text-stone-600 text-sm">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          ×{tool.imageCount}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: t('fields.isActive'),
      width: '80px',
      render: (tool) => (
        <StatusBadge status={tool.isActive ? 'enabled' : 'disabled'}
          customLabel={tool.isActive ? '启用' : '停用'} />
      ),
    },
    {
      key: 'actions',
      label: tCommon('actions.edit'),
      width: '140px',
      align: 'center',
      render: (tool) => (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => { setSelectedTool(tool); setIsModalOpen(true) }}
            className={cn('rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
              'bg-aurora-purple/10 text-aurora-purple hover:bg-aurora-purple/20 transition-colors duration-300')}>
            {tCommon('actions.edit')}
          </button>
          <button onClick={() => handleDelete(tool.id)} disabled={deletingId === tool.id}
            className={cn('rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
              'bg-red-100 text-red-700 hover:bg-red-200',
              'disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300')}>
            {deletingId === tool.id ? '删除中...' : tCommon('actions.delete')}
          </button>
        </div>
      ),
    },
  ], [t, tCommon, deletingId])

  return (
    <>
      <AdminPageShell
        title={t('title')}
        description={t('description')}
        actions={(
          <Button
            type="button"
            variant="primary"
            onClick={() => { setSelectedTool(undefined); setIsModalOpen(true) }}
            className="flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {t('add')}
          </Button>
        )}
      >
        {/* Type filter */}
        <FadeIn variant="fade" delay={0.05}>
          <div className="flex gap-2">
            {(['all', 'image', 'video'] as const).map((type) => (
              <button key={type} onClick={() => setTypeFilter(type)}
                className={cn('px-4 py-2 rounded-lg font-ui text-sm font-medium transition-all duration-200',
                  typeFilter === type
                    ? 'bg-aurora-purple text-white shadow-aurora'
                    : 'bg-white text-stone-600 border border-stone-200 hover:border-aurora-purple/50')}>
                {type === 'all' ? '全部' : type === 'image' ? '图片' : '视频'}
              </button>
            ))}
          </div>
        </FadeIn>

        <FadeIn variant="fade" delay={0.1}>
          <DataTable data={filteredTools} columns={columns} keyExtractor={(t) => t.id}
            loading={loading} emptyText={tCommon('status.noData')} />
        </FadeIn>
      </AdminPageShell>

      <ToolAdminModal isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedTool(undefined) }}
        onSuccess={() => { fetchTools(); setIsModalOpen(false); setSelectedTool(undefined) }}
        tool={selectedTool} />
    </>
  )
}
