'use client'

import { useEffect, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { GripVertical, PencilLine, Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import {
  adminAiService,
  type ChatModelItem,
} from '@/lib/api/services/admin/ai'
import { cn } from '@/lib/utils/cn'

type ChatModelDraft = {
  name: string
  modelKey: string
  icon: string
  description: string
  systemPrompt: string
  supportsImageInput: boolean
  freeUserDailyQuestionLimit: string
  maxContextRounds: string
  deepResearchCreditsCost: string
  isActive: boolean
  sortOrder: string
}

type DropPosition = 'before' | 'after'

const MAX_ICON_FILE_BYTES = 1024 * 1024

function toDraft(item: ChatModelItem): ChatModelDraft {
  return {
    name: item.name,
    modelKey: item.modelKey,
    icon: item.icon || '',
    description: item.description || '',
    systemPrompt: item.systemPrompt || '',
    supportsImageInput: Boolean(item.supportsImageInput),
    freeUserDailyQuestionLimit:
      item.freeUserDailyQuestionLimit === null || item.freeUserDailyQuestionLimit === undefined
        ? ''
        : String(item.freeUserDailyQuestionLimit),
    maxContextRounds:
      item.maxContextRounds === null || item.maxContextRounds === undefined
        ? ''
        : String(item.maxContextRounds),
    deepResearchCreditsCost:
      item.deepResearchCreditsCost === null || item.deepResearchCreditsCost === undefined
        ? ''
        : String(item.deepResearchCreditsCost),
    isActive: item.isActive,
    sortOrder: String(item.sortOrder),
  }
}

function createEmptyDraft(nextSortOrder: number): ChatModelDraft {
  return {
    name: '',
    modelKey: '',
    icon: '',
    description: '',
    systemPrompt: '',
    supportsImageInput: false,
    freeUserDailyQuestionLimit: '',
    maxContextRounds: '',
    deepResearchCreditsCost: '',
    isActive: true,
    sortOrder: String(nextSortOrder),
  }
}

function sortChatModels(items: ChatModelItem[]) {
  return [...items].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

function applyChatModelSortOrder(items: ChatModelItem[]) {
  return items.map((item, index) => ({
    ...item,
    sortOrder: (index + 1) * 10,
  }))
}

function moveChatModelInList(
  items: ChatModelItem[],
  activeId: string,
  overId: string,
  position: DropPosition,
) {
  const fromIndex = items.findIndex((item) => item.id === activeId)
  const overIndex = items.findIndex((item) => item.id === overId)

  if (fromIndex === -1 || overIndex === -1) {
    return items
  }

  let insertionIndex = position === 'before' ? overIndex : overIndex + 1
  if (fromIndex < insertionIndex) {
    insertionIndex -= 1
  }

  if (insertionIndex === fromIndex) {
    return items
  }

  const nextItems = [...items]
  const [movedItem] = nextItems.splice(fromIndex, 1)
  nextItems.splice(insertionIndex, 0, movedItem)
  return nextItems
}

function getNextSortOrder(items: ChatModelItem[]) {
  const maxSortOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), 0)
  return maxSortOrder + 10
}

function isImageIcon(icon: string) {
  return icon.startsWith('data:image') || /^https?:\/\//i.test(icon)
}

function getIconInitial(name: string) {
  const normalized = name.trim()
  return normalized ? normalized[0].toUpperCase() : 'M'
}

function ChatModelIcon({
  icon,
  name,
  className,
}: {
  icon: string | null | undefined
  name: string
  className?: string
}) {
  const normalizedIcon = String(icon || '').trim()

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 text-stone-700',
        className,
      )}
    >
      {normalizedIcon ? (
        isImageIcon(normalizedIcon) ? (
          <img
            src={normalizedIcon}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xl leading-none">{normalizedIcon}</span>
        )
      ) : (
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
          {getIconInitial(name)}
        </span>
      )}
    </div>
  )
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('READ_ICON_FAILED'))
    reader.readAsDataURL(file)
  })
}

export function ChatModelManagerSection({ apiConfigured }: { apiConfigured: boolean }) {
  const [models, setModels] = useState<ChatModelItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ChatModelDraft>(() => createEmptyDraft(10))
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [draggingModelId, setDraggingModelId] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{
    modelId: string
    position: DropPosition
  } | null>(null)

  useEffect(() => {
    void loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const chatModels = await adminAiService.listChatModels()
      setDraggingModelId(null)
      setDropIndicator(null)
      setModels(sortChatModels(chatModels))
    } catch (error) {
      console.error('Failed to load chat model page data:', error)
      toast.error('加载对话模型配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  const setDraftField = <K extends keyof ChatModelDraft>(
    key: K,
    value: ChatModelDraft[K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const resetModalState = () => {
    setIsModalOpen(false)
    setEditingModelId(null)
    setFormError('')
  }

  const handleCloseModal = () => {
    if (isSaving) return
    resetModalState()
  }

  const handleOpenCreateModal = () => {
    setDraft(createEmptyDraft(getNextSortOrder(models)))
    setEditingModelId(null)
    setFormError('')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (item: ChatModelItem) => {
    setDraft(toDraft(item))
    setEditingModelId(item.id)
    setFormError('')
    setIsModalOpen(true)
  }

  const parseOptionalLimit = (raw: string, label: string): number | null | undefined => {
    const value = raw.trim()
    if (!value) return null

    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 0) {
      setFormError(`${label}必须是非负整数`)
      return undefined
    }
    return parsed
  }

  const parseOptionalPositiveInt = (raw: string, label: string): number | null | undefined => {
    const value = raw.trim()
    if (!value) return null

    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1) {
      setFormError(`${label}必须是正整数`)
      return undefined
    }
    return parsed
  }

  const parseSortOrder = (
    raw: string,
    currentModel: ChatModelItem | null,
  ): number | undefined => {
    const value = raw.trim()
    if (!value) {
      return currentModel ? currentModel.sortOrder : undefined
    }

    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 0) {
      setFormError('排序必须是非负整数')
      return undefined
    }
    return parsed
  }

  const handleIconFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setFormError('请选择图片文件')
      return
    }

    if (file.size > MAX_ICON_FILE_BYTES) {
      setFormError('图片文件大小不能超过 1MB')
      return
    }

    try {
      const dataUrl = await readImageAsDataUrl(file)
      setDraftField('icon', dataUrl)
      setFormError('')
    } catch {
      setFormError('读取图片失败')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')

    const currentModel = editingModelId
      ? models.find((item) => item.id === editingModelId) ?? null
      : null
    const isEditMode = Boolean(currentModel)

    const name = draft.name.trim()
    const modelKey = draft.modelKey.trim()
    const icon = draft.icon.trim()
    const description = draft.description.trim()
    const systemPrompt = draft.systemPrompt.trim()

    if (!name) {
      setFormError('请输入模型显示名称')
      return
    }
    if (!modelKey) {
      setFormError('请输入实际请求模型名')
      return
    }
    if (!apiConfigured && !isEditMode) {
      setFormError('请先完成 AI 配置')
      return
    }

    const freeUserDailyQuestionLimit = parseOptionalLimit(draft.freeUserDailyQuestionLimit, '免费用户每日提问上限')
    if (freeUserDailyQuestionLimit === undefined) return

    const maxContextRounds = parseOptionalPositiveInt(draft.maxContextRounds, '最大上下文轮数')
    if (maxContextRounds === undefined) return

    const deepResearchCreditsCost = parseOptionalLimit(draft.deepResearchCreditsCost, '深度研究积分消耗')
    if (deepResearchCreditsCost === undefined) return

    const sortOrder = parseSortOrder(draft.sortOrder, currentModel)
    if (draft.sortOrder.trim() && sortOrder === undefined) return

    try {
      setIsSaving(true)

      const payload = {
        name,
        modelKey,
        icon,
        description,
        systemPrompt,
        supportsImageInput: draft.supportsImageInput,
        freeUserDailyQuestionLimit,
        maxContextRounds,
        deepResearchCreditsCost,
        isActive: draft.isActive,
        sortOrder,
      }

      const saved = currentModel
        ? await adminAiService.updateChatModel(currentModel.id, payload)
        : await adminAiService.createChatModel(payload)

      setModels((prev) => sortChatModels([
        ...prev.filter((item) => item.id !== saved.id),
        saved,
      ]))

      resetModalState()
      toast.success(currentModel ? '对话模型已更新' : '对话模型已添加')
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      const normalizedMessage = Array.isArray(message) ? message.join('；') : message
      setFormError(normalizedMessage || (currentModel ? '更新对话模型失败' : '添加对话模型失败'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (model: ChatModelItem) => {
    const confirmed = window.confirm(`确认删除对话模型「${model.name}」吗？`)
    if (!confirmed) return

    try {
      setDeletingId(model.id)
      await adminAiService.removeChatModel(model.id)
      setModels((prev) => prev.filter((item) => item.id !== model.id))
      toast.success('对话模型已删除')
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      const normalizedMessage = Array.isArray(message) ? message.join('；') : message
      toast.error(normalizedMessage || '删除对话模型失败')
    } finally {
      setDeletingId(null)
    }
  }

  const clearDragState = () => {
    setDraggingModelId(null)
    setDropIndicator(null)
  }

  const getDropPosition = (event: DragEvent<HTMLDivElement>): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientY - rect.top < rect.height / 2 ? 'before' : 'after'
  }

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, modelId: string) => {
    if (isSavingOrder) {
      event.preventDefault()
      return
    }

    setDraggingModelId(modelId)
    setDropIndicator(null)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', modelId)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>, targetModelId: string) => {
    const activeModelId = draggingModelId ?? event.dataTransfer.getData('text/plain')
    if (!activeModelId || activeModelId === targetModelId) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const position = getDropPosition(event)
    setDropIndicator((current) => {
      if (current?.modelId === targetModelId && current.position === position) {
        return current
      }
      return {
        modelId: targetModelId,
        position,
      }
    })
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>, targetModelId: string) => {
    event.preventDefault()
    const activeModelId = draggingModelId ?? event.dataTransfer.getData('text/plain')
    clearDragState()

    if (!activeModelId || activeModelId === targetModelId) {
      return
    }

    const position =
      dropIndicator?.modelId === targetModelId
        ? dropIndicator.position
        : getDropPosition(event)
    const previousModels = models
    const reorderedModels = moveChatModelInList(previousModels, activeModelId, targetModelId, position)

    if (reorderedModels === previousModels) {
      return
    }

    const nextModels = applyChatModelSortOrder(reorderedModels)
    setModels(nextModels)
    setIsSavingOrder(true)

    try {
      await adminAiService.reorderChatModels(nextModels.map((item) => item.id))
      toast.success('对话模型排序已更新')
    } catch (error) {
      console.error('Failed to reorder chat models:', error)
      setModels(previousModels)
      toast.error('保存对话模型排序失败')
    } finally {
      setIsSavingOrder(false)
    }
  }

  const inputClassName = cn(
    'w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900',
    'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
  )

  if (isLoading) {
    return (
      <Card className="border border-stone-200 !bg-white p-8 !shadow-sm">
        <div className="flex min-h-[220px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-aurora-purple" />
        </div>
      </Card>
    )
  }

  return (
    <div id="chat-models" className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-semibold text-stone-900">对话模型配置</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void loadData()}
            disabled={isSavingOrder}
            className="!rounded-xl !border-stone-200 !bg-white !px-4 !py-2.5 !text-stone-700 !shadow-none hover:!border-stone-300 hover:!bg-stone-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button
            type="button"
            onClick={handleOpenCreateModal}
            disabled={!apiConfigured || isSavingOrder}
            className="!rounded-xl !px-4 !py-2.5"
          >
            <Plus className="mr-2 h-4 w-4" />
            新增对话模型
          </Button>
        </div>
      </div>

      <Card className="border border-stone-200 !bg-white p-0 !shadow-sm">
        {models.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-stone-500">
            暂无对话模型
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {models.map((item) => {
              const isDragging = draggingModelId === item.id
              const isDropTarget = dropIndicator?.modelId === item.id
              const isDropBefore = isDropTarget && dropIndicator?.position === 'before'
              const isDropAfter = isDropTarget && dropIndicator?.position === 'after'

              return (
                <div
                  key={item.id}
                  onDragOver={(event) => handleDragOver(event, item.id)}
                  onDrop={(event) => void handleDrop(event, item.id)}
                  className={cn(
                    'flex flex-col gap-4 border-transparent px-5 py-4 transition-colors sm:flex-row sm:items-center',
                    isDragging && 'bg-stone-50 opacity-60',
                    isDropTarget && 'bg-aurora-purple/5',
                    isDropBefore && 'border-t-2 border-t-aurora-purple',
                    isDropAfter && 'border-b-2 border-b-aurora-purple',
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <button
                      type="button"
                      draggable={!isSavingOrder}
                      disabled={isSavingOrder}
                      onDragStart={(event) => handleDragStart(event, item.id)}
                      onDragEnd={clearDragState}
                      aria-label={`拖拽排序 ${item.name}`}
                      className={cn(
                        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors',
                        isSavingOrder
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-grab hover:border-aurora-purple/40 hover:text-aurora-purple active:cursor-grabbing',
                      )}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <ChatModelIcon
                      icon={item.icon}
                      name={item.name}
                      className="h-12 w-12 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {item.name}
                      </p>
                      <p className="truncate font-mono text-xs text-stone-500">
                        {item.modelKey}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
                      #{item.sortOrder}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      disabled={isSavingOrder}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-aurora-purple hover:text-aurora-purple',
                        isSavingOrder && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <PencilLine className="h-4 w-4" />
                      配置
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      disabled={isSavingOrder || deletingId === item.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50',
                        (isSavingOrder || deletingId === item.id) && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingModelId ? '配置对话模型' : '新增对话模型'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">
                模型显示名称
              </label>
              <input
                type="text"
                value={draft.name}
                onChange={(event) => setDraftField('name', event.target.value)}
                className={inputClassName}
                maxLength={100}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">
                实际请求模型名
              </label>
              <input
                type="text"
                value={draft.modelKey}
                onChange={(event) => setDraftField('modelKey', event.target.value)}
                className={cn(inputClassName, 'font-mono')}
                maxLength={100}
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-stone-700">
              图标
            </label>
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={draft.icon}
                    onChange={(event) => setDraftField('icon', event.target.value)}
                    className={inputClassName}
                    placeholder="https://example.com/icon.png 或 data:image/..."
                  />
                  {draft.icon ? (
                    <button
                      type="button"
                      onClick={() => setDraftField('icon', '')}
                      className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:border-red-200 hover:text-red-600"
                    >
                      清除
                    </button>
                  ) : null}
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:border-aurora-purple hover:text-aurora-purple">
                  <Upload className="h-4 w-4" />
                  上传图片
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleIconFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 p-3">
                <ChatModelIcon
                  icon={draft.icon}
                  name={draft.name || draft.modelKey}
                  className="h-16 w-16"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              模型描述
            </label>
            <textarea
              value={draft.description}
              onChange={(event) => setDraftField('description', event.target.value)}
              className={cn(inputClassName, 'min-h-[96px] resize-y')}
              maxLength={10000}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              系统消息
            </label>
            <textarea
              value={draft.systemPrompt}
              onChange={(event) => setDraftField('systemPrompt', event.target.value)}
              className={cn(inputClassName, 'min-h-[160px] resize-y font-mono text-xs')}
              maxLength={10000}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">
                免费每日上限
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={draft.freeUserDailyQuestionLimit}
                onChange={(event) => setDraftField('freeUserDailyQuestionLimit', event.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">
                上下文轮数
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={draft.maxContextRounds}
                onChange={(event) => setDraftField('maxContextRounds', event.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">
                深度研究积分
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={draft.deepResearchCreditsCost}
                onChange={(event) => setDraftField('deepResearchCreditsCost', event.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">
                排序
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={draft.sortOrder}
                onChange={(event) => setDraftField('sortOrder', event.target.value)}
                className={inputClassName}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setDraftField('supportsImageInput', !draft.supportsImageInput)}
              className={cn(
                'rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-all',
                draft.supportsImageInput
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-stone-300 bg-stone-50 text-stone-600',
              )}
            >
              {draft.supportsImageInput ? '支持识图' : '不支持识图'}
            </button>

            <button
              type="button"
              onClick={() => setDraftField('isActive', !draft.isActive)}
              className={cn(
                'rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-all',
                draft.isActive
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-stone-300 bg-stone-50 text-stone-600',
              )}
            >
              {draft.isActive ? '启用' : '禁用'}
            </button>
          </div>

          {formError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              disabled={isSaving}
              className="flex-1"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSaving || (!apiConfigured && !editingModelId)}
              isLoading={isSaving}
              className="flex-1"
            >
              {editingModelId ? '保存配置' : '创建模型'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
