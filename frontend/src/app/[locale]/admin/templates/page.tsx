/**
 * 管理员模板管理页面
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { FadeIn } from '@/components/shared/FadeIn'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { DataTable, DataTableColumn } from '@/components/admin/tables/DataTable'
import { StatusBadge } from '@/components/admin/shared/StatusBadge'
import { Button } from '@/components/ui/Button'
import { TemplateModal } from '@/components/admin/templates/TemplateModal'
import { adminTemplateService } from '@/lib/api/services/admin/templates'
import type { Template } from '@/lib/api/types/templates'
import { cn } from '@/lib/utils'

export default function AdminTemplatesPage() {
  const t = useTranslations('admin.templates')
  const tCommon = useTranslations('admin.common')

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | undefined>()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all')

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const data = await adminTemplateService.getTemplates()
      setTemplates(data.sort((a, b) => a.sortOrder - b.sortOrder))
    } catch {
      console.error('Failed to fetch templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const filteredTemplates = useMemo(() => {
    if (typeFilter === 'all') return templates
    return templates.filter((t) => t.type === typeFilter)
  }, [templates, typeFilter])

  const handleCreate = () => {
    setSelectedTemplate(undefined)
    setIsModalOpen(true)
  }

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm.delete'))) return
    setDeletingId(id)
    try {
      await adminTemplateService.deleteTemplate(id)
      await fetchTemplates()
    } catch {
      alert(t('error.delete'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedTemplate(undefined)
  }

  const handleModalSuccess = () => {
    fetchTemplates()
    handleModalClose()
  }

  const columns: DataTableColumn<Template>[] = useMemo(
    () => [
      {
        key: 'cover',
        label: '封面',
        width: '70px',
        render: (tpl) =>
          tpl.coverUrl ? (
            <img
              src={tpl.coverUrl}
              alt={tpl.title}
              className="w-12 h-12 rounded-lg object-cover border border-stone-200"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-aurora-pink/20 via-aurora-purple/20 to-aurora-blue/20 flex items-center justify-center border border-stone-200">
              <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          ),
      },
      {
        key: 'title',
        label: t('fields.title'),
        render: (tpl) => (
          <div>
            <span className="font-medium text-stone-900">{tpl.title}</span>
            {tpl.description && (
              <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{tpl.description}</p>
            )}
          </div>
        ),
      },
      {
        key: 'type',
        label: t('fields.type'),
        width: '90px',
        render: (tpl) => (
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              tpl.type === 'image'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-purple-100 text-purple-800'
            )}
          >
            {t(`types.${tpl.type}`)}
          </span>
        ),
      },
      {
        key: 'category',
        label: t('fields.category'),
        width: '100px',
        render: (tpl) => (
          <span className="text-stone-600 text-sm">{tpl.category || '—'}</span>
        ),
      },
      {
        key: 'isPublic',
        label: t('fields.isPublic'),
        width: '80px',
        render: (tpl) => (
          <StatusBadge
            status={tpl.isPublic ? 'enabled' : 'disabled'}
            customLabel={tpl.isPublic ? '公开' : '隐藏'}
          />
        ),
      },
      {
        key: 'sortOrder',
        label: t('fields.sortOrder'),
        width: '70px',
        align: 'center',
        render: (tpl) => <span className="text-stone-600">{tpl.sortOrder}</span>,
      },
      {
        key: 'actions',
        label: tCommon('actions.edit'),
        width: '140px',
        align: 'center',
        render: (tpl) => (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => handleEdit(tpl)}
              className={cn(
                'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
                'bg-aurora-purple/10 text-aurora-purple hover:bg-aurora-purple/20',
                'transition-colors duration-300'
              )}
            >
              {tCommon('actions.edit')}
            </button>
            <button
              onClick={() => handleDelete(tpl.id)}
              disabled={deletingId === tpl.id}
              className={cn(
                'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
                'bg-red-100 text-red-700 hover:bg-red-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-300'
              )}
            >
              {deletingId === tpl.id ? '删除中...' : tCommon('actions.delete')}
            </button>
          </div>
        ),
      },
    ],
    [t, tCommon, deletingId]
  )

  return (
    <>
      <AdminPageShell
        title={t('title')}
        description={t('description')}
        actions={(
          <Button type="button" variant="primary" onClick={handleCreate} className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {t('add')}
          </Button>
        )}
      >
        {/* 类型筛选 */}
        <FadeIn variant="fade" delay={0.05}>
          <div className="flex gap-2">
            {(['all', 'image', 'video'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={cn(
                  'px-4 py-2 rounded-lg font-ui text-sm font-medium transition-all duration-200',
                  typeFilter === type
                    ? 'bg-aurora-purple text-white shadow-aurora'
                    : 'bg-white text-stone-600 border border-stone-200 hover:border-aurora-purple/50'
                )}
              >
                {type === 'all' ? '全部' : t(`types.${type}`)}
              </button>
            ))}
          </div>
        </FadeIn>

        {/* Table */}
        <FadeIn variant="fade" delay={0.1}>
          <DataTable
            data={filteredTemplates}
            columns={columns}
            keyExtractor={(tpl) => tpl.id}
            loading={loading}
            emptyText={tCommon('status.noData')}
          />
        </FadeIn>
      </AdminPageShell>

      <TemplateModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        template={selectedTemplate}
      />
    </>
  )
}
