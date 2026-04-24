'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { AdminPageLoading } from '@/components/admin/layout/AdminPageLoading'
import { adminAnnouncementsService } from '@/lib/api/services/admin/announcements'
import { AnnouncementEditor } from '@/components/admin/forms/AnnouncementEditor'
import type {
  Announcement,
  CreateAnnouncementRequest,
} from '@/lib/api/types/admin/announcements'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Plus, Edit, Trash2, Pin, Check, X } from 'lucide-react'

export default function AdminAnnouncementsPage() {
  const t = useTranslations('admin')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  useEffect(() => {
    loadAnnouncements()
  }, [pagination.page])

  const loadAnnouncements = async () => {
    try {
      setIsLoading(true)
      const response = await adminAnnouncementsService.getList({
        page: pagination.page,
        limit: pagination.limit,
      })
      setAnnouncements(response.data)
      setPagination((prev) => ({ ...prev, ...response.pagination }))
    } catch (error) {
      console.error('Failed to load announcements:', error)
      toast.error('加载公告失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingAnnouncement(null)
    setShowEditor(true)
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setShowEditor(true)
  }

  const handleSave = async (data: CreateAnnouncementRequest) => {
    try {
      if (editingAnnouncement) {
        await adminAnnouncementsService.update(editingAnnouncement.id, data)
        toast.success('公告已更新')
      } else {
        await adminAnnouncementsService.create(data)
        toast.success('公告已创建')
      }
      loadAnnouncements()
    } catch (error) {
      console.error('Failed to save announcement:', error)
      toast.error('保存公告失败')
      throw error
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条公告吗？')) return

    try {
      await adminAnnouncementsService.delete(id)
      toast.success('公告已删除')
      loadAnnouncements()
    } catch (error) {
      console.error('Failed to delete announcement:', error)
      toast.error('删除公告失败')
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd HH:mm', { locale: zhCN })
    } catch {
      return '-'
    }
  }

  const stripHtml = (html: string) => {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .trim()
  }

  if (isLoading && announcements.length === 0) {
    return <AdminPageLoading text="加载公告列表中..." />
  }

  return (
    <AdminPageShell
      title="公告管理"
      description="管理系统公告和通知"
      actions={
        <Button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          创建公告
        </Button>
      }
      maxWidthClassName="max-w-6xl"
    >

      {announcements.length === 0 ? (
        <Card className="border border-stone-200 !bg-white p-12 text-center !shadow-sm">
          <p className="text-stone-400">暂无公告</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <Card key={announcement.id} className="border border-stone-200 !bg-white p-4 !shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {announcement.isPinned && (
                      <Pin className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    )}
                    <h3 className="font-semibold text-stone-900 truncate">
                      {announcement.title}
                    </h3>
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${
                        announcement.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {announcement.isActive ? (
                        <span className="flex items-center gap-1">
                          <Check className="w-3 h-3" /> 启用
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <X className="w-3 h-3" /> 停用
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-stone-600 line-clamp-2 mb-2 whitespace-pre-wrap">
                    {stripHtml(announcement.content)}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-stone-400">
                    <span>创建：{formatDate(announcement.createdAt)}</span>
                    <span>排序：{announcement.sortOrder}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(announcement)}
                    className="p-2 text-stone-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(announcement.id)}
                    className="p-2 text-stone-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
            }
            disabled={pagination.page === 1}
            className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            上一页
          </Button>
          <span className="text-sm text-stone-600">
            第 {pagination.page} / {pagination.totalPages} 页
          </span>
          <Button
            onClick={() =>
              setPagination((prev) => ({
                ...prev,
                page: Math.min(prev.totalPages, prev.page + 1),
              }))
            }
            disabled={pagination.page >= pagination.totalPages}
            className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            下一页
          </Button>
        </div>
      )}

      <AnnouncementEditor
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        onSave={handleSave}
        announcement={editingAnnouncement}
      />
    </AdminPageShell>
  )
}
