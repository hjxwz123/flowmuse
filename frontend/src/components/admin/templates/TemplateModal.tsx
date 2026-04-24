/**
 * 模板创建/编辑模态框
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { adminTemplateService } from '@/lib/api/services/admin/templates'
import { adminModelService } from '@/lib/api/services/admin/models'
import type { Template, CreateTemplateRequest } from '@/lib/api/types/templates'
import type { Model } from '@/lib/api/types/admin/models'

interface TemplateModalProps {
  isOpen: boolean
  onClose: () => void
  template?: Template
  onSuccess?: () => void
}

export function TemplateModal({
  isOpen,
  onClose,
  template,
  onSuccess,
}: TemplateModalProps) {
  const t = useTranslations('admin.templates')
  const tCommon = useTranslations('admin.common')

  const isEditMode = !!template

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'image' | 'video'>('image')
  const [category, setCategory] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [prompt, setPrompt] = useState('')
  const [modelId, setModelId] = useState('')
  const [parametersJson, setParametersJson] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [models, setModels] = useState<Model[]>([])

  useEffect(() => {
    if (isOpen) {
      adminModelService.getModels().then((data) => {
        setModels(data.filter((m) => m.isActive))
      }).catch(() => {/* 静默失败，降级为无模型列表 */})
    }
  }, [isOpen])

  const filteredModels = useMemo(
    () => models.filter((m) => m.type === type),
    [models, type]
  )

  useEffect(() => {
    if (template) {
      setTitle(template.title)
      setDescription(template.description || '')
      setType(template.type)
      setCategory(template.category || '')
      setCoverUrl(template.coverUrl || '')
      setPrompt(template.prompt)
      setModelId(template.modelId || '')
      setParametersJson(
        template.parameters ? JSON.stringify(template.parameters, null, 2) : ''
      )
      setSortOrder(template.sortOrder.toString())
      setIsPublic(template.isPublic)
    } else {
      setTitle('')
      setDescription('')
      setType('image')
      setCategory('')
      setCoverUrl('')
      setPrompt('')
      setModelId('')
      setParametersJson('')
      setSortOrder('0')
      setIsPublic(true)
    }
    setError('')
  }, [template, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('请输入模板名称')
      return
    }
    if (!prompt.trim()) {
      setError('请输入预设提示词')
      return
    }

    let parameters: Record<string, unknown> | undefined
    if (parametersJson.trim()) {
      try {
        parameters = JSON.parse(parametersJson)
      } catch {
        setError('参数 JSON 格式不正确')
        return
      }
    }

    const data: CreateTemplateRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      coverUrl: coverUrl.trim() || undefined,
      prompt: prompt.trim(),
      type,
      category: category.trim() || undefined,
      modelId: modelId.trim() || undefined,
      parameters,
      sortOrder: parseInt(sortOrder, 10) || 0,
      isPublic,
    }

    setLoading(true)
    try {
      if (isEditMode && template) {
        await adminTemplateService.updateTemplate(template.id, data)
      } else {
        await adminTemplateService.createTemplate(data)
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? t('edit') : t('add')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 标题 */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
            {t('fields.title')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="如：证件照生成"
          />
        </div>

        {/* 描述 */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
            {t('fields.description')}
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="简短描述此模板的用途"
          />
        </div>

        {/* 类型 + 分类 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
              {t('fields.type')} <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => {
                const newType = e.target.value as 'image' | 'video'
                setType(newType)
                // 若当前选中模型与新类型不匹配则清空
                const currentModel = models.find((m) => m.id === modelId)
                if (currentModel && currentModel.type !== newType) {
                  setModelId('')
                }
              }}
              className={inputClass}
            >
              <option value="image">{t('types.image')}</option>
              <option value="video">{t('types.video')}</option>
            </select>
          </div>
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
              {t('fields.category')}
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
              placeholder="如：证件照、头像"
            />
          </div>
        </div>

        {/* 封面图 URL */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
            {t('fields.coverUrl')}
          </label>
          <input
            type="text"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            className={inputClass}
            placeholder="https://..."
          />
        </div>

        {/* 预设提示词 */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
            {t('fields.prompt')} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className={cn(inputClass, 'resize-none')}
            placeholder="预设的提示词内容..."
          />
        </div>

        {/* 指定模型 + 排序权重 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
              {t('fields.modelId')}
            </label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className={inputClass}
            >
              <option value="">不指定（使用默认模型）</option>
              {filteredModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
              {t('fields.sortOrder')}
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={inputClass}
              min="0"
            />
          </div>
        </div>

        {/* 参数 JSON */}
        <div>
          <label className="block font-ui text-sm font-medium text-stone-700 mb-1">
            {t('fields.parameters')}
          </label>
          <textarea
            value={parametersJson}
            onChange={(e) => setParametersJson(e.target.value)}
            rows={3}
            className={cn(inputClass, 'resize-none font-mono text-xs')}
            placeholder='{"aspectRatio": "9:16"}'
          />
        </div>

        {/* 公开状态 */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="w-4 h-4 rounded border-stone-300 text-aurora-purple"
          />
          <label htmlFor="isPublic" className="font-ui text-sm text-stone-700">
            {t('fields.isPublic')}
          </label>
        </div>

        {error && (
          <p className="font-ui text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
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
