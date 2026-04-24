/**
 * 模型管理页面
 * 包含提供商、渠道、模型三个 Tab
 */

'use client'

import { useState, useEffect, type DragEvent } from 'react'
import { useTranslations } from 'next-intl'
import { GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { FadeIn } from '@/components/shared/FadeIn'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { DataTable, DataTableColumn } from '@/components/admin/tables/DataTable'
import { StatusBadge } from '@/components/admin/shared/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Loading } from '@/components/ui/Loading'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Modal } from '@/components/ui/Modal'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProviderModal } from '@/components/admin/forms/ProviderModal'
import { ChannelModal } from '@/components/admin/forms/ChannelModal'
import { ModelModal } from '@/components/admin/forms/ModelModal'
import { adminProviderService } from '@/lib/api/services/admin/providers'
import { adminChannelService } from '@/lib/api/services/admin/channels'
import { adminModelService } from '@/lib/api/services/admin/models'
import type { Provider } from '@/lib/api/types/admin/providers'
import type { Channel } from '@/lib/api/types/admin/channels'
import type { Model } from '@/lib/api/types/admin/models'
import { isAdminModelsHiddenProvider } from '@/lib/constants/providers'
import { cn } from '@/lib/utils'

type TabValue = 'providers' | 'channels' | 'models'
type DropPosition = 'before' | 'after'

const ARCHIVED_MODEL_NAME_PREFIX = '[DELETED#'
const ARCHIVED_MODEL_DESCRIPTION_PREFIX = 'Archived placeholder for deleted model'

function isArchivedModel(model: Model): boolean {
  return (
    model.name.startsWith(ARCHIVED_MODEL_NAME_PREFIX) ||
    (model.description?.startsWith(ARCHIVED_MODEL_DESCRIPTION_PREFIX) ?? false)
  )
}

function applyModelSortOrder(items: Model[]): Model[] {
  return items.map((item, index) => ({
    ...item,
    sortOrder: (index + 1) * 10,
  }))
}

function moveModelInList(
  items: Model[],
  activeId: string,
  overId: string,
  position: DropPosition
): Model[] {
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

export default function AdminModelsPage() {
  const t = useTranslations('admin.models')
  const tCommon = useTranslations('admin.common')

  const [activeTab, setActiveTab] = useState<TabValue>('providers')

  // Providers state
  const [providers, setProviders] = useState<Provider[]>([])
  const [providersLoading, setProvidersLoading] = useState(false)

  // Channels state
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelsLoading, setChannelsLoading] = useState(false)

  // Models state
  const [models, setModels] = useState<Model[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [isSavingModelOrder, setIsSavingModelOrder] = useState(false)
  const [draggingModelId, setDraggingModelId] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{
    modelId: string
    position: DropPosition
  } | null>(null)

  // Provider modal state
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<Provider | undefined>()

  // Channel modal state
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<Channel | undefined>()

  // Model modal state
  const [isModelModalOpen, setIsModelModalOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<Model | undefined>()

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'provider' | 'channel' | 'model'
    id: string
    name: string
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      if (deleteConfirm.type === 'provider') {
        await adminProviderService.deleteProvider(deleteConfirm.id)
        fetchProviders()
      } else if (deleteConfirm.type === 'channel') {
        await adminChannelService.deleteChannel(deleteConfirm.id)
        fetchChannels()
      } else {
        await adminModelService.deleteModel(deleteConfirm.id)
        fetchModels()
      }
      setDeleteConfirm(null)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDeleteError(msg ?? '删除失败，请稍后重试')
    } finally {
      setIsDeleting(false)
    }
  }

  // Fetch providers
  const fetchProviders = async () => {
    setProvidersLoading(true)
    try {
      const response = await adminProviderService.getProviders()
      setProviders(response.filter((provider) => !isAdminModelsHiddenProvider(provider.provider)))
    } catch (error) {
      console.error('Failed to fetch providers:', error)
    } finally {
      setProvidersLoading(false)
    }
  }

  // Fetch channels
  const fetchChannels = async () => {
    setChannelsLoading(true)
    try {
      const response = await adminChannelService.getChannels()
      setChannels(response.filter((channel) => !isAdminModelsHiddenProvider(channel.provider)))
    } catch (error) {
      console.error('Failed to fetch channels:', error)
    } finally {
      setChannelsLoading(false)
    }
  }

  // Fetch models
  const fetchModels = async () => {
    setModelsLoading(true)
    try {
      const response = await adminModelService.getModels()
      setDraggingModelId(null)
      setDropIndicator(null)
      setModels(
        response.filter(
          (model) =>
            !isArchivedModel(model) &&
            model.type !== 'chat' &&
            !isAdminModelsHiddenProvider(model.provider) &&
            !isAdminModelsHiddenProvider(model.channel?.provider),
        ),
      )
    } catch (error) {
      console.error('Failed to fetch models:', error)
    } finally {
      setModelsLoading(false)
    }
  }

  // Initial fetch based on active tab
  useEffect(() => {
    if (activeTab === 'providers') {
      fetchProviders()
    } else if (activeTab === 'channels') {
      fetchChannels()
    } else if (activeTab === 'models') {
      fetchModels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Provider columns
  const providerColumns: DataTableColumn<Provider>[] = [
    {
      key: 'displayName',
      label: t('providers.fields.name'),
      width: '200px',
      render: (provider) => (
        <div>
          <p className="font-medium text-stone-900">{provider.displayName}</p>
          <p className="text-xs text-stone-500">{provider.provider}</p>
        </div>
      ),
    },
    {
      key: 'supportTypes',
      label: t('providers.fields.type'),
      width: '150px',
      render: (provider) => (
        <span className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 px-2.5 py-0.5 font-ui text-xs font-semibold text-stone-700">
          {provider.supportTypes.join(', ')}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: t('providers.fields.enabled'),
      width: '100px',
      align: 'center',
      render: (provider) => (
        <StatusBadge status={provider.isActive ? 'enabled' : 'disabled'} />
      ),
    },
    {
      key: 'sortOrder',
      label: t('providers.fields.sort'),
      width: '80px',
      align: 'center',
      render: (provider) => (
        <span className="font-medium text-stone-900">{provider.sortOrder}</span>
      ),
    },
    {
      key: 'actions',
      label: tCommon('actions.edit'),
      width: '150px',
      align: 'center',
      render: (provider) => (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => {
              setSelectedProvider(provider)
              setIsProviderModalOpen(true)
            }}
            className={cn(
              'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
              'bg-aurora-purple/10 text-aurora-purple',
              'hover:bg-aurora-purple/20',
              'transition-colors duration-300'
            )}
          >
            {tCommon('actions.edit')}
          </button>
          <button
            onClick={() => {
              setDeleteError('')
              setDeleteConfirm({ type: 'provider', id: provider.id, name: provider.displayName })
            }}
            className={cn(
              'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
              'bg-red-50 text-red-600',
              'hover:bg-red-100',
              'transition-colors duration-300'
            )}
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  // Channel columns
  const channelColumns: DataTableColumn<Channel>[] = [
    {
      key: 'name',
      label: t('channels.fields.name'),
      width: '200px',
      render: (channel) => (
        <span className="font-medium text-stone-900">{channel.name}</span>
      ),
    },
    {
      key: 'provider',
      label: t('channels.fields.provider'),
      width: '150px',
      render: (channel) => (
        <span className="text-stone-700">{channel.provider}</span>
      ),
    },
    {
      key: 'baseUrl',
      label: t('channels.fields.baseUrl'),
      render: (channel) => (
        <span className="font-mono text-xs text-stone-600">
          {channel.baseUrl}
        </span>
      ),
    },
    {
      key: 'priority',
      label: t('channels.fields.priority'),
      width: '80px',
      align: 'center',
      render: (channel) => (
        <span className="font-medium text-stone-900">{channel.priority}</span>
      ),
    },
    {
      key: 'status',
      label: t('channels.fields.status'),
      width: '100px',
      align: 'center',
      render: (channel) => (
        <StatusBadge
          status={channel.status === 'active' ? 'enabled' : 'disabled'}
        />
      ),
    },
    {
      key: 'actions',
      label: tCommon('actions.edit'),
      width: '240px',
      align: 'center',
      render: (channel) => (
        <div className="flex items-center justify-center gap-2">
          <button
            className={cn(
              'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
              'bg-blue-100 text-blue-700',
              'hover:bg-blue-200',
              'transition-colors duration-300'
            )}
          >
            {t('channels.actions.testConnection')}
          </button>
          <button
            onClick={() => {
              setSelectedChannel(channel)
              setIsChannelModalOpen(true)
            }}
            className={cn(
              'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
              'bg-aurora-purple/10 text-aurora-purple',
              'hover:bg-aurora-purple/20',
              'transition-colors duration-300'
            )}
          >
            {tCommon('actions.edit')}
          </button>
          <button
            onClick={() => {
              setDeleteError('')
              setDeleteConfirm({ type: 'channel', id: channel.id, name: channel.name })
            }}
            className={cn(
              'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
              'bg-red-50 text-red-600',
              'hover:bg-red-100',
              'transition-colors duration-300'
            )}
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  const clearModelDragState = () => {
    setDraggingModelId(null)
    setDropIndicator(null)
  }

  const getModelDropPosition = (event: DragEvent<HTMLTableRowElement>): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientY - rect.top < rect.height / 2 ? 'before' : 'after'
  }

  const handleModelDragStart = (event: DragEvent<HTMLButtonElement>, modelId: string) => {
    if (isSavingModelOrder) {
      event.preventDefault()
      return
    }

    setDraggingModelId(modelId)
    setDropIndicator(null)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', modelId)
  }

  const handleModelDragOver = (
    event: DragEvent<HTMLTableRowElement>,
    targetModelId: string
  ) => {
    const activeModelId = draggingModelId ?? event.dataTransfer.getData('text/plain')
    if (!activeModelId || activeModelId === targetModelId) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const position = getModelDropPosition(event)
    setDropIndicator((current) => {
      if (current?.modelId === targetModelId && current.position === position) {
        return current
      }
      return { modelId: targetModelId, position }
    })
  }

  const handleModelDrop = async (
    event: DragEvent<HTMLTableRowElement>,
    targetModelId: string
  ) => {
    event.preventDefault()
    const activeModelId = draggingModelId ?? event.dataTransfer.getData('text/plain')
    clearModelDragState()

    if (!activeModelId || activeModelId === targetModelId) {
      return
    }

    const position =
      dropIndicator?.modelId === targetModelId
        ? dropIndicator.position
        : getModelDropPosition(event)
    const previousModels = models
    const reorderedModels = moveModelInList(previousModels, activeModelId, targetModelId, position)

    if (reorderedModels === previousModels) {
      return
    }

    const nextModels = applyModelSortOrder(reorderedModels)
    setModels(nextModels)
    setIsSavingModelOrder(true)

    try {
      await adminModelService.reorderModels(nextModels.map((model) => model.id))
      toast.success(t('models.saveOrderSuccess'))
    } catch (error) {
      console.error('Failed to reorder models:', error)
      setModels(previousModels)
      toast.error(t('models.saveOrderError'))
    } finally {
      setIsSavingModelOrder(false)
    }
  }

  return (
    <>
      <AdminPageShell title={t('title')} description="管理 AI 提供商、API 渠道和模型配置">
        {/* Tabs */}
        <FadeIn variant="fade" delay={0.05}>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabValue)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="providers">{t('tabs.providers')}</TabsTrigger>
              <TabsTrigger value="channels">{t('tabs.channels')}</TabsTrigger>
              <TabsTrigger value="models">{t('tabs.models')}</TabsTrigger>
            </TabsList>

            {/* Providers Tab */}
            <TabsContent value="providers" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-ui text-xl font-semibold text-stone-900">
                  {t('providers.title')}
                </h2>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSelectedProvider(undefined)
                    setIsProviderModalOpen(true)
                  }}
                >
                  {t('providers.add')}
                </Button>
              </div>

              <DataTable
                data={providers}
                columns={providerColumns}
                keyExtractor={(provider) => provider.id}
                loading={providersLoading}
                emptyText={tCommon('status.noData')}
              />
            </TabsContent>

            {/* Channels Tab */}
            <TabsContent value="channels" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-ui text-xl font-semibold text-stone-900">
                  {t('channels.title')}
                </h2>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSelectedChannel(undefined)
                    setIsChannelModalOpen(true)
                  }}
                >
                  {t('channels.add')}
                </Button>
              </div>

              <DataTable
                data={channels}
                columns={channelColumns}
                keyExtractor={(channel) => channel.id}
                loading={channelsLoading}
                emptyText={tCommon('status.noData')}
              />
            </TabsContent>

            {/* Models Tab */}
            <TabsContent value="models" className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <h2 className="font-ui text-xl font-semibold text-stone-900">
                    {t('models.title')}
                  </h2>
                  <p className="text-sm text-stone-500">
                    {isSavingModelOrder ? t('models.savingOrder') : t('models.reorderHint')}
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isSavingModelOrder}
                  onClick={() => {
                    setSelectedModel(undefined)
                    setIsModelModalOpen(true)
                  }}
                >
                  {t('models.add')}
                </Button>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white/80 shadow-canvas backdrop-blur-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-stone-50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-16 font-ui text-sm font-semibold text-stone-700">
                        {t('models.fields.drag')}
                      </TableHead>
                      <TableHead className="w-[240px] font-ui text-sm font-semibold text-stone-700">
                        {t('models.fields.name')}
                      </TableHead>
                      <TableHead className="w-[120px] font-ui text-sm font-semibold text-stone-700">
                        {t('models.fields.type')}
                      </TableHead>
                      <TableHead className="w-[160px] font-ui text-sm font-semibold text-stone-700">
                        {t('models.fields.provider')}
                      </TableHead>
                      <TableHead className="w-[160px] font-ui text-sm font-semibold text-stone-700">
                        {t('models.fields.channel')}
                      </TableHead>
                      <TableHead className="w-[90px] text-center font-ui text-sm font-semibold text-stone-700">
                        {t('models.fields.sortOrder')}
                      </TableHead>
                      <TableHead className="w-[140px] text-right font-ui text-sm font-semibold text-stone-700">
                        {t('models.fields.creditsCost')}
                      </TableHead>
                      <TableHead className="w-[100px] text-center font-ui text-sm font-semibold text-stone-700">
                        {t('models.fields.enabled')}
                      </TableHead>
                      <TableHead className="w-[170px] text-center font-ui text-sm font-semibold text-stone-700">
                        {tCommon('actions.edit')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelsLoading ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={9} className="h-64 text-center">
                          <Loading />
                        </TableCell>
                      </TableRow>
                    ) : models.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={9} className="h-64 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <svg
                              className="h-12 w-12 text-stone-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                              />
                            </svg>
                            <p className="font-ui text-sm text-stone-500">{tCommon('status.noData')}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      models.map((model) => {
                        const specialCredits =
                          typeof model.specialCreditsPerUse === 'number' &&
                          model.specialCreditsPerUse > 0 &&
                          model.specialCreditsPerUse < model.creditsPerUse
                            ? model.specialCreditsPerUse
                            : null
                        const isDragging = draggingModelId === model.id
                        const isDropTarget = dropIndicator?.modelId === model.id

                        return (
                          <TableRow
                            key={model.id}
                            onDragOver={(event) => handleModelDragOver(event, model.id)}
                            onDrop={(event) => void handleModelDrop(event, model.id)}
                            className={cn(
                              'transition-colors hover:bg-stone-50/50',
                              isDragging && 'bg-stone-50 opacity-60',
                              isDropTarget && 'bg-aurora-purple/5'
                            )}
                          >
                            <TableCell className="align-middle">
                              <button
                                type="button"
                                draggable={!isSavingModelOrder}
                                disabled={isSavingModelOrder}
                                onDragStart={(event) => handleModelDragStart(event, model.id)}
                                onDragEnd={clearModelDragState}
                                aria-label={`${t('models.fields.drag')} ${model.name}`}
                                className={cn(
                                  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition-colors',
                                  isSavingModelOrder
                                    ? 'cursor-not-allowed opacity-60'
                                    : 'cursor-grab hover:border-aurora-purple/40 hover:text-aurora-purple active:cursor-grabbing'
                                )}
                              >
                                <GripVertical className="h-4 w-4" />
                              </button>
                            </TableCell>
                            <TableCell className="font-ui text-sm text-stone-700">
                              <div className="flex items-center gap-2">
                                {model.icon ? (
                                  <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-white">
                                    {model.icon.startsWith('data:image') || model.icon.startsWith('http') ? (
                                      <img
                                        src={model.icon}
                                        alt={model.name}
                                        className="h-full w-full object-contain"
                                      />
                                    ) : (
                                      <span className="text-base leading-none">{model.icon}</span>
                                    )}
                                  </span>
                                ) : null}
                                <div>
                                  <p className="font-medium text-stone-900">{model.name}</p>
                                  <p className="font-mono text-xs text-stone-500">{model.modelKey}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-ui text-sm text-stone-700">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-md border px-2.5 py-0.5 font-ui text-xs font-semibold',
                                  model.type === 'image'
                                    ? 'border-blue-200 bg-blue-100 text-blue-700'
                                    : model.type === 'video'
                                      ? 'border-purple-200 bg-purple-100 text-purple-700'
                                      : 'border-emerald-200 bg-emerald-100 text-emerald-700'
                                )}
                              >
                                {model.type === 'image'
                                  ? t('models.types.image')
                                  : model.type === 'video'
                                    ? t('models.types.video')
                                    : t('models.types.chat')}
                              </span>
                            </TableCell>
                            <TableCell className="font-ui text-sm text-stone-700">
                              {model.provider}
                            </TableCell>
                            <TableCell className="font-ui text-sm text-stone-700">
                              {model.channel?.name || '-'}
                            </TableCell>
                            <TableCell className="text-center font-ui text-sm text-stone-700">
                              <span className="font-medium text-stone-900">{model.sortOrder}</span>
                            </TableCell>
                            <TableCell className="text-right font-ui text-sm text-stone-700">
                              <div className="flex flex-col items-end">
                                {specialCredits !== null ? (
                                  <>
                                    <span className="font-semibold text-rose-500">{specialCredits}</span>
                                    <span className="text-xs text-stone-400 line-through">
                                      {model.creditsPerUse}
                                    </span>
                                  </>
                                ) : (
                                  <span className="font-medium text-aurora-purple">
                                    {model.creditsPerUse}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-ui text-sm text-stone-700">
                              <StatusBadge status={model.isActive ? 'enabled' : 'disabled'} />
                            </TableCell>
                            <TableCell className="text-center font-ui text-sm text-stone-700">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedModel(model)
                                    setIsModelModalOpen(true)
                                  }}
                                  className={cn(
                                    'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
                                    'bg-aurora-purple/10 text-aurora-purple',
                                    'hover:bg-aurora-purple/20',
                                    'transition-colors duration-300'
                                  )}
                                >
                                  {tCommon('actions.edit')}
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteError('')
                                    setDeleteConfirm({ type: 'model', id: model.id, name: model.name })
                                  }}
                                  className={cn(
                                    'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
                                    'bg-red-50 text-red-600',
                                    'hover:bg-red-100',
                                    'transition-colors duration-300'
                                  )}
                                >
                                  删除
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </FadeIn>
      </AdminPageShell>

      {/* Provider Modal */}
      <ProviderModal
        isOpen={isProviderModalOpen}
        onClose={() => {
          setIsProviderModalOpen(false)
          setSelectedProvider(undefined)
        }}
        provider={selectedProvider}
        onSuccess={() => {
          fetchProviders()
        }}
      />

      {/* Channel Modal */}
      <ChannelModal
        isOpen={isChannelModalOpen}
        onClose={() => {
          setIsChannelModalOpen(false)
          setSelectedChannel(undefined)
        }}
        channel={selectedChannel}
        onSuccess={() => {
          fetchChannels()
        }}
      />

      {/* Model Modal */}
      <ModelModal
        isOpen={isModelModalOpen}
        onClose={() => {
          setIsModelModalOpen(false)
          setSelectedModel(undefined)
        }}
        allowChatType={false}
        model={selectedModel}
        onSuccess={() => {
          fetchModels()
        }}
      />

      {/* 删除确认弹窗 */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => { if (!isDeleting) { setDeleteConfirm(null); setDeleteError('') } }}
        title="确认删除"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            确定要删除
            <span className="font-semibold text-stone-900 mx-1">
              {deleteConfirm?.name}
            </span>
            吗？此操作不可撤销。
          </p>
          {deleteConfirm?.type === 'provider' && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              ⚠️ 删除提供商将同时影响该提供商下的渠道和模型配置，请谨慎操作。
            </p>
          )}
          {deleteConfirm?.type === 'channel' && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              ⚠️ 删除渠道将同时影响该渠道下的模型配置，请谨慎操作。
            </p>
          )}
          {deleteError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{deleteError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setDeleteConfirm(null); setDeleteError('') }}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 border-red-500"
            >
              {isDeleting ? '删除中...' : '确认删除'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
