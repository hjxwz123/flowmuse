/**
 * 公告编辑弹窗
 */

'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type {
  Announcement,
  CreateAnnouncementRequest,
} from '@/lib/api/types/admin/announcements'

interface AnnouncementEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: CreateAnnouncementRequest) => Promise<void>
  announcement?: Announcement | null
}

export const AnnouncementEditor = ({
  isOpen,
  onClose,
  onSave,
  announcement,
}: AnnouncementEditorProps) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    isActive: true,
    isPinned: false,
    sortOrder: 0,
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (announcement) {
      setFormData({
        title: announcement.title,
        content: announcement.content,
        isActive: announcement.isActive,
        isPinned: announcement.isPinned,
        sortOrder: announcement.sortOrder,
      })
    } else {
      setFormData({
        title: '',
        content: '',
        isActive: true,
        isPinned: false,
        sortOrder: 0,
      })
    }
  }, [announcement, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSaving(true)
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Failed to save announcement:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={announcement ? '编辑公告' : '创建公告'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="输入公告标题"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            内容 <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[200px]"
            placeholder="输入公告内容（支持 HTML，可嵌入 iframe/img/a 等）"
          />
          <p className="text-xs text-stone-500 mt-2">
            支持 HTML 渲染；纯文本换行会保留，使用 HTML 时建议用 <code className="px-1 py-0.5 bg-stone-100 rounded">{'<br />'}</code> 或 <code className="px-1 py-0.5 bg-stone-100 rounded">{'<p>'}</code> 控制排版
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            排序顺序
          </label>
          <input
            type="number"
            value={formData.sortOrder}
            onChange={(e) =>
              setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
            }
            className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-stone-500 mt-1">数字越小越靠前</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-stone-700">
              启用公告
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPinned"
              checked={formData.isPinned}
              onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="isPinned" className="text-sm font-medium text-stone-700">
              置顶公告
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
          <Button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors"
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
