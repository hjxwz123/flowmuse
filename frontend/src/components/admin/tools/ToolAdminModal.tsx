'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { adminToolService } from '@/lib/api/services/admin/tools'
import { adminModelService } from '@/lib/api/services/admin/models'
import type { Tool, CreateToolRequest } from '@/lib/api/types/tools'
import type { Model } from '@/lib/api/types/admin/models'

interface ToolAdminModalProps {
  isOpen: boolean
  onClose: () => void
  tool?: Tool
  onSuccess?: () => void
}

export function ToolAdminModal({ isOpen, onClose, tool, onSuccess }: ToolAdminModalProps) {
  const t = useTranslations('admin.tools')
  const tCommon = useTranslations('admin.common')

  const isEdit = !!tool

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [type, setType] = useState<'image' | 'video'>('image')
  const [modelId, setModelId] = useState('')
  const [imageCount, setImageCount] = useState('1')
  const [imageLabelsRaw, setImageLabelsRaw] = useState('')
  const [prompt, setPrompt] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [category, setCategory] = useState('')
  const [parametersJson, setParametersJson] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [models, setModels] = useState<Model[]>([])

  // Load models when modal opens
  useEffect(() => {
    if (isOpen) {
      adminModelService
        .getModels()
        .then((data) => setModels(data.filter((m) => m.isActive)))
        .catch(() => {})
    }
  }, [isOpen])

  const filteredModels = useMemo(
    () => models.filter((m) => m.type === type),
    [models, type]
  )

  // Fill form when editing
  useEffect(() => {
    if (tool) {
      setTitle(tool.title)
      setDescription(tool.description || '')
      setNotes(tool.notes || '')
      setType(tool.type)
      setModelId(tool.modelId || '')
      setImageCount(String(tool.imageCount))
      setImageLabelsRaw(tool.imageLabels?.join('\n') || '')
      setPrompt(tool.prompt)
      setCoverUrl(tool.coverUrl || '')
      setCategory(tool.category || '')
      setParametersJson(tool.parameters ? JSON.stringify(tool.parameters, null, 2) : '')
      setSortOrder(String(tool.sortOrder))
      setIsActive(tool.isActive)
    } else {
      setTitle('')
      setDescription('')
      setNotes('')
      setType('image')
      setModelId('')
      setImageCount('1')
      setImageLabelsRaw('')
      setPrompt('')
      setCoverUrl('')
      setCategory('')
      setParametersJson('')
      setSortOrder('0')
      setIsActive(true)
    }
    setError('')
  }, [tool, isOpen])

  const handleTypeChange = (newType: 'image' | 'video') => {
    setType(newType)
    const current = models.find((m) => m.id === modelId)
    if (current && current.type !== newType) setModelId('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) { setError('请输入工具名称'); return }
    if (!modelId) { setError('请选择模型'); return }
    if (!prompt.trim()) { setError('请输入预设提示词'); return }

    const count = parseInt(imageCount, 10) || 1
    const imageLabels = imageLabelsRaw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    let parameters: Record<string, unknown> | undefined
    if (parametersJson.trim()) {
      try {
        parameters = JSON.parse(parametersJson)
      } catch {
        setError('参数 JSON 格式不正确')
        return
      }
    }

    const data: CreateToolRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      coverUrl: coverUrl.trim() || undefined,
      prompt: prompt.trim(),
      type,
      modelId,
      imageCount: count,
      imageLabels: imageLabels.length ? imageLabels : undefined,
      parameters,
      category: category.trim() || undefined,
      isActive,
      sortOrder: parseInt(sortOrder, 10) || 0,
    }

    setLoading(true)
    try {
      if (isEdit && tool) {
        await adminToolService.updateTool(tool.id, data)
      } else {
        await adminToolService.createTool(data)
      }
      onSuccess?.()
      onClose()
    } catch {
      setError('保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = cn(
    'w-full rounded-xl border border-stone-200 px-4 py-2.5',
    'font-ui text-sm text-stone-900 bg-white',
    'focus:outline-none focus:ring-2 focus:ring-aurora-purple/20 focus:border-aurora-purple',
    'transition-all duration-200'
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? t('edit') : t('add')}>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 标题 */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
            {t('fields.title')} <span className="text-red-500">*</span>
          </label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className={inputClass} placeholder="如：图片变清晰" />
        </div>

        {/* 描述 */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
            {t('fields.description')}
          </label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            className={inputClass} placeholder="简短描述此工具用途" />
        </div>

        {/* 注意事项 */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
            {t('fields.notes')}
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className={cn(inputClass, 'resize-none')}
            placeholder={'如：请上传正脸清晰的照片，背景简洁效果更好\n换脸工具：第1张为原图，第2张为换脸目标图'} />
        </div>

        {/* 类型 + 分类 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
              {t('fields.type')} <span className="text-red-500">*</span>
            </label>
            <select value={type} onChange={(e) => handleTypeChange(e.target.value as 'image' | 'video')}
              className={inputClass}>
              <option value="image">图片</option>
              <option value="video">视频</option>
            </select>
          </div>
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
              {t('fields.category')}
            </label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)}
              className={inputClass} placeholder="如：图像增强、换脸" />
          </div>
        </div>

        {/* 模型 */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
            {t('fields.model')} <span className="text-red-500">*</span>
          </label>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} className={inputClass}>
            <option value="">请选择模型</option>
            {filteredModels.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* 垫图数量 + 垫图标签 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
              {t('fields.imageCount')} <span className="text-red-500">*</span>
            </label>
            <select value={imageCount} onChange={(e) => setImageCount(e.target.value)} className={inputClass}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n} 张</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
              {t('fields.imageLabels')}
              <span className="ml-1 text-xs text-stone-400">（每行一个）</span>
            </label>
            <textarea value={imageLabelsRaw} onChange={(e) => setImageLabelsRaw(e.target.value)}
              rows={parseInt(imageCount, 10) || 1}
              className={cn(inputClass, 'resize-none font-mono text-xs')}
              placeholder={'原始图片\n换脸目标图'} />
          </div>
        </div>

        {/* 封面图 URL */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
            {t('fields.coverUrl')}
          </label>
          <input type="text" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)}
            className={inputClass} placeholder="https://..." />
        </div>

        {/* 预设提示词 */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
            {t('fields.prompt')} <span className="text-red-500">*</span>
          </label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
            className={cn(inputClass, 'resize-none')}
            placeholder="用户不可见的预设提示词..." />
        </div>

        {/* 参数 JSON + 排序 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
              {t('fields.parameters')}
            </label>
            <textarea value={parametersJson} onChange={(e) => setParametersJson(e.target.value)} rows={3}
              className={cn(inputClass, 'resize-none font-mono text-xs')}
              placeholder='{"aspectRatio": "1:1"}' />
          </div>
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
              {t('fields.sortOrder')}
            </label>
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
              className={inputClass} min="0" />
          </div>
        </div>

        {/* 启用状态 */}
        <div className="flex items-center gap-2">
          <input type="checkbox" id="toolIsActive" checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded border-stone-300 text-aurora-purple" />
          <label htmlFor="toolIsActive" className="font-ui text-sm text-stone-700">
            {t('fields.isActive')}
          </label>
        </div>

        {error && (
          <p className="font-ui text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            {tCommon('actions.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? tCommon('status.loading') : tCommon('actions.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
