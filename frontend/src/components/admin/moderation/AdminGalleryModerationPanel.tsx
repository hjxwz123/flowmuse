/**
 * 内容审核面板
 * 用于统一审核中心内嵌的公开内容审核功能
 */

'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FadeIn } from '@/components/shared/FadeIn'
import { StatusBadge } from '@/components/admin/shared/StatusBadge'
import { Pagination } from '@/components/admin/shared/Pagination'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MasonryGrid, MasonryItem } from '@/components/ui/MasonryGrid'
import { adminGalleryService } from '@/lib/api/services/admin/gallery'
import type { ImageTask } from '@/lib/api/types/images'
import type { VideoTask } from '@/lib/api/types/videos'
import { cn } from '@/lib/utils'

type GalleryItem = (ImageTask & { type: 'image' }) | (VideoTask & { type: 'video' })

function matchesGalleryItemKey(item: GalleryItem, target: Pick<GalleryItem, 'type' | 'id'>) {
  return item.type === target.type && item.id === target.id
}

export function AdminGalleryModerationPanel() {
  const t = useTranslations('admin.gallery')
  const tCommon = useTranslations('admin.common')
  const locale = useLocale()

  // Gallery state
  const [allItems, setAllItems] = useState<GalleryItem[]>([])
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null)
  const [filteredTotal, setFilteredTotal] = useState(0)

  // Action Modal state
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'hide' | 'delete' | null>(null)
  const [actionItem, setActionItem] = useState<GalleryItem | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Pagination (client-side)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(24)

  // Filters
  const [typeFilter, setTypeFilter] = useState<'image' | 'video' | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [usernameQuery, setUsernameQuery] = useState('')
  const [isPublicFilter, setIsPublicFilter] = useState<'true' | 'false' | ''>('')
  const [moderationStatusFilter, setModerationStatusFilter] = useState<
    'pending' | 'approved' | 'rejected' | 'private' | ''
  >('')

  // Fetch gallery items（server-side: username + isPublic 筛选）
  const fetchGalleryItems = async (params?: {
    username?: string
    isPublic?: string
    moderationStatus?: string
  }) => {
    setLoading(true)
    try {
      const [images, videos] = await Promise.all([
        adminGalleryService.getImages(params),
        adminGalleryService.getVideos(params),
      ])

      const combined: GalleryItem[] = [
        ...images.map((img) => ({ ...img, type: 'image' as const })),
        ...videos.map((vid) => ({ ...vid, type: 'video' as const })),
      ]

      combined.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      setAllItems(combined)
    } catch (error) {
      console.error('Failed to fetch gallery items:', error)
    } finally {
      setLoading(false)
    }
  }

  // Apply filters and pagination
  useEffect(() => {
    let filtered = [...allItems]

    // Filter by type
    if (typeFilter) {
      filtered = filtered.filter((item) => item.type === typeFilter)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.prompt?.toLowerCase().includes(query) ||
          item.taskNo.toLowerCase().includes(query)
      )
    }

    if (moderationStatusFilter) {
      filtered = filtered.filter((item) => item.publicModerationStatus === moderationStatusFilter)
    }

    if (isPublicFilter) {
      filtered = filtered.filter((item) => String(item.isPublic) === isPublicFilter)
    }

    // Paginate
    setFilteredTotal(filtered.length)
    const start = (page - 1) * pageSize
    const end = start + pageSize
    setItems(filtered.slice(start, end))
  }, [allItems, typeFilter, searchQuery, page, pageSize, moderationStatusFilter, isPublicFilter])

  const total = filteredTotal
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    if (page <= totalPages) return
    setPage(totalPages)
  }, [page, totalPages])

  // Initial fetch
  useEffect(() => {
    fetchGalleryItems({
      username: usernameQuery.trim() || undefined,
      isPublic: isPublicFilter || undefined,
      moderationStatus: moderationStatusFilter || undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle search (client-side: prompt/taskNo)
  const handleSearch = () => {
    setPage(1)
  }

  // Handle server-side filters (username + isPublic)
  const handleFilter = () => {
    setPage(1)
    fetchGalleryItems({
      username: usernameQuery.trim() || undefined,
      isPublic: isPublicFilter || undefined,
      moderationStatus: moderationStatusFilter || undefined,
    })
  }

  // Open action modal
  const openActionModal = (item: GalleryItem, type: 'approve' | 'reject' | 'hide' | 'delete') => {
    setActionItem(item)
    setActionType(type)
    setActionMessage('')
    setActionModalOpen(true)
  }

  // Close action modal
  const closeActionModal = () => {
    setActionModalOpen(false)
    setActionItem(null)
    setActionType(null)
    setActionMessage('')
    setActionLoading(false)
  }

  const upsertGalleryItem = (nextItem: GalleryItem) => {
    setAllItems((prev) =>
      prev.map((item) => (matchesGalleryItemKey(item, nextItem) ? nextItem : item))
    )
    setPreviewItem((prev) => (prev && matchesGalleryItemKey(prev, nextItem) ? nextItem : prev))
  }

  const removeGalleryItem = (target: Pick<GalleryItem, 'type' | 'id'>) => {
    setAllItems((prev) => prev.filter((item) => !matchesGalleryItemKey(item, target)))
    setPreviewItem((prev) => (prev && matchesGalleryItemKey(prev, target) ? null : prev))
  }

  // Confirm action
  const confirmAction = async () => {
    if (!actionItem || !actionType) return

    setActionLoading(true)
    try {
      if (actionType === 'approve' || actionType === 'reject') {
        const updated = await adminGalleryService.moderateItem(
          actionItem.type,
          actionItem.id,
          {
            status: actionType === 'approve' ? 'approved' : 'rejected',
            message: actionMessage.trim() || undefined,
          }
        )
        upsertGalleryItem({ ...updated, type: actionItem.type } as GalleryItem)
      } else if (actionType === 'hide') {
        const updated = await adminGalleryService.hideItem(
          actionItem.type,
          actionItem.id,
          actionMessage.trim() ? { message: actionMessage.trim() } : {}
        )
        upsertGalleryItem({ ...updated, type: actionItem.type } as GalleryItem)
      } else {
        await adminGalleryService.deleteItem(
          actionItem.type,
          actionItem.id,
          actionMessage.trim() ? { message: actionMessage.trim() } : {}
        )
        removeGalleryItem(actionItem)
      }
      setPreviewItem(null)
      closeActionModal()
    } catch (error) {
      console.error(`Failed to ${actionType} item:`, error)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle hide item
  const handleHide = (item: GalleryItem) => {
    openActionModal(item, 'hide')
  }

  const handleApprove = (item: GalleryItem) => {
    openActionModal(item, 'approve')
  }

  const handleReject = (item: GalleryItem) => {
    openActionModal(item, 'reject')
  }

  // Handle delete item
  const handleDelete = (item: GalleryItem) => {
    openActionModal(item, 'delete')
  }

  return (
    <>
      {/* Filters and Actions */}
      <FadeIn variant="fade" delay={0.05}>
        <div className="rounded-xl bg-white p-6 border border-stone-200 shadow-sm space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Search (client-side: prompt / taskNo) */}
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
                    setTypeFilter(e.target.value as 'image' | 'video' | '')
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
                </select>
              </div>
            </div>

            {/* 第二行：用户名 + 公开状态（服务端筛选） */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 pt-2 border-t border-stone-100">
              {/* 用户名搜索 */}
              <div className="md:col-span-2">
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  用户名 / 邮箱
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={usernameQuery}
                    onChange={(e) => setUsernameQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                    placeholder="搜索用户名或邮箱..."
                    className={cn(
                      'flex-1 rounded-lg border border-stone-200 px-4 py-2',
                      'font-ui text-sm text-stone-900',
                      'placeholder:text-stone-400',
                      'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                      'transition-colors'
                    )}
                  />
                  <button
                    onClick={handleFilter}
                    className={cn(
                      'rounded-lg px-6 py-2 font-ui text-sm font-medium',
                      'bg-stone-700 text-white',
                      'hover:bg-stone-800',
                      'transition-colors'
                    )}
                  >
                    筛选
                  </button>
                </div>
              </div>

              {/* 公开状态筛选 */}
              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  公开状态
                </label>
                <select
                  value={isPublicFilter}
                  onChange={(e) => {
                    setIsPublicFilter(e.target.value as 'true' | 'false' | '')
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
                  <option value="true">已公开</option>
                  <option value="false">未公开</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  审核状态
                </label>
                <select
                  value={moderationStatusFilter}
                  onChange={(e) => {
                    setModerationStatusFilter(
                      e.target.value as 'pending' | 'approved' | 'rejected' | 'private' | ''
                    )
                    setPage(1)
                  }}
                  className={cn(
                    'w-full rounded-lg border border-stone-200 px-4 py-2',
                    'font-ui text-sm text-stone-900',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors'
                  )}
                >
                  <option value="">全部审核状态</option>
                  <option value="pending">待审核</option>
                  <option value="approved">已通过</option>
                  <option value="rejected">已拒绝</option>
                  <option value="private">未申请</option>
                </select>
              </div>
            </div>
        </div>
      </FadeIn>

      {/* Gallery Grid */}
      <FadeIn variant="fade" delay={0.1}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-aurora-purple border-r-transparent" />
              <p className="mt-4 font-ui text-sm text-stone-600">加载中...</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-white p-20 border border-stone-200 text-center">
            <p className="font-ui text-stone-500">{tCommon('status.noData')}</p>
          </div>
        ) : (
          <MasonryGrid columns={4}>
            {items.map((item) => (
              <MasonryItem key={item.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setPreviewItem(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setPreviewItem(item)
                  }}
                  className={cn(
                    'group relative rounded-xl overflow-hidden border-2 border-stone-200 transition-all',
                    'hover:border-stone-300 hover:shadow-canvas-lg hover:z-10',
                    'cursor-pointer focus:outline-none focus:ring-2 focus:ring-aurora-purple/40',
                    'bg-white'
                  )}
                >
                  {/* Image/Video - 使用缩略图 */}
                  <div className="relative w-full bg-stone-100">
                    {(item.thumbnailUrl || item.resultUrl) ? (
                      <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.thumbnailUrl || item.resultUrl || ''}
                          alt={item.prompt}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                        <div className="absolute inset-0 flex items-center justify-center text-stone-400">
                          <div className="text-center p-6">
                            <div className="text-4xl mb-2">
                              {item.type === 'image' ? '🖼️' : '🎬'}
                            </div>
                            <div className="text-sm">
                              {item.type === 'image' ? '图片' : '视频'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Type Badge */}
                    <div className="absolute top-2 left-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border px-2 py-1 font-ui text-xs font-semibold shadow-sm',
                          item.type === 'image'
                            ? 'bg-blue-500 text-white border-blue-600'
                            : 'bg-purple-500 text-white border-purple-600'
                        )}
                      >
                        {item.type === 'image' ? '图片' : '视频'}
                      </span>
                    </div>

                    {/* Public Badge */}
                    {item.isPublic && (
                      <div className="absolute top-2 right-2 rounded-md bg-green-500 px-2 py-1 text-xs font-semibold text-white shadow-sm">
                        公开
                      </div>
                    )}

                    <div className="absolute bottom-2 left-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold shadow-sm',
                          item.publicModerationStatus === 'pending'
                            ? 'border-amber-300 bg-amber-100 text-amber-800'
                            : item.publicModerationStatus === 'approved'
                            ? 'border-green-300 bg-green-100 text-green-800'
                            : item.publicModerationStatus === 'rejected'
                            ? 'border-red-300 bg-red-100 text-red-800'
                            : 'border-stone-300 bg-white/90 text-stone-600'
                        )}
                      >
                        {item.publicModerationStatus === 'pending'
                          ? '待审核'
                          : item.publicModerationStatus === 'approved'
                          ? '已通过'
                          : item.publicModerationStatus === 'rejected'
                          ? '已拒绝'
                          : '未申请'}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute bottom-2 right-2">
                      <StatusBadge
                        status={
                          item.status === 'completed'
                            ? 'completed'
                            : item.status === 'failed'
                            ? 'failed'
                            : item.status === 'processing'
                            ? 'processing'
                            : 'pending'
                        }
                      />
                    </div>

                    {/* Action Buttons (visible on hover) */}
                    <div
                      className={cn(
                        'absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent',
                        'opacity-0 group-hover:opacity-100 transition-opacity',
                        'flex items-end justify-center p-3'
                      )}
                    >
                      <div className="w-full flex flex-col gap-2">
                        {item.publicModerationStatus === 'pending' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleApprove(item)
                              }}
                              className="w-full rounded-lg px-3 py-2 bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors"
                            >
                              通过公开
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleReject(item)
                              }}
                              className="w-full rounded-lg px-3 py-2 bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition-colors"
                            >
                              拒绝公开
                            </button>
                          </>
                        )}
                        {item.isPublic && item.publicModerationStatus !== 'pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleHide(item)
                            }}
                            className="w-full rounded-lg px-3 py-2 bg-yellow-500 text-white text-xs font-medium hover:bg-yellow-600 transition-colors"
                          >
                            隐藏
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(item)
                          }}
                          className="w-full rounded-lg px-3 py-2 bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 bg-white">
                    <p className="font-mono text-xs text-stone-500 truncate mb-1">
                      {item.taskNo}
                    </p>
                    <p className="text-sm text-stone-900 line-clamp-2 mb-2 min-h-[2.5rem]">
                      {item.prompt}
                    </p>
                    {/* User Info */}
                    {item.user && (
                      <p className="text-xs text-stone-600 truncate mb-1">
                        👤 {item.user.username || item.user.email}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-stone-600">
                      <span className="truncate">{item.provider}</span>
                      <span className="font-medium text-aurora-purple ml-2 flex-shrink-0">
                        {item.creditsCost || 0} 点
                      </span>
                    </div>
                    {item.publicModerationNote ? (
                      <p className="mt-2 line-clamp-2 text-xs text-stone-500">
                        备注：{item.publicModerationNote}
                      </p>
                    ) : null}
                  </div>
                </div>
              </MasonryItem>
            ))}
          </MasonryGrid>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </FadeIn>

      <Modal
        isOpen={!!previewItem}
        onClose={() => setPreviewItem(null)}
        title={previewItem ? `内容预览 - ${previewItem.taskNo}` : '内容预览'}
        size="lg"
      >
        {!previewItem ? null : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-stone-500">
                <span className="mr-3">类型：{previewItem.type === 'image' ? '图片' : '视频'}</span>
                <span className="mr-3">状态：{previewItem.status}</span>
                <span className="mr-3">Provider：{previewItem.provider}</span>
                <span>公开：{previewItem.isPublic ? '是' : '否'}</span>
                <span className="ml-3">
                  审核：{
                    previewItem.publicModerationStatus === 'pending'
                      ? '待审核'
                      : previewItem.publicModerationStatus === 'approved'
                      ? '已通过'
                      : previewItem.publicModerationStatus === 'rejected'
                      ? '已拒绝'
                      : '未申请'
                  }
                </span>
              </div>
              <div className="flex items-center gap-2">
                {previewItem.publicModerationStatus === 'pending' ? (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => handleApprove(previewItem)}
                    >
                      通过公开
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleReject(previewItem)}
                      className="text-orange-600"
                    >
                      拒绝公开
                    </Button>
                  </>
                ) : null}
                {previewItem.isPublic ? (
                  <Button
                    variant="secondary"
                    onClick={() => handleHide(previewItem)}
                  >
                    隐藏
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  onClick={() => handleDelete(previewItem)}
                  className="text-red-600"
                >
                  删除
                </Button>
              </div>
            </div>

            {/* User Info */}
            {previewItem.user && (
              <div className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500 mb-1">创建用户</div>
                <div className="text-sm text-stone-900 font-medium">
                  {previewItem.user.username || previewItem.user.email}
                </div>
                {previewItem.user.username && (
                  <div className="text-xs text-stone-500 mt-1">{previewItem.user.email}</div>
                )}
              </div>
            )}

            {previewItem.type === 'image' ? (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
                {(previewItem.thumbnailUrl || previewItem.resultUrl) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewItem.thumbnailUrl || previewItem.resultUrl || ''}
                    alt={previewItem.prompt}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-stone-400">暂无图片</div>
                )}
              </div>
            ) : previewItem.resultUrl ? (
              <video
                src={previewItem.resultUrl}
                controls
                className="w-full rounded-2xl border border-stone-200 bg-black"
              />
            ) : previewItem.thumbnailUrl ? (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewItem.thumbnailUrl}
                  alt={previewItem.prompt}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-64 w-full items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-400">
                暂无视频
              </div>
            )}

            <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
              <div className="text-xs text-stone-500">提示词</div>
              <div className="whitespace-pre-wrap text-sm text-stone-900">{previewItem.prompt}</div>
              <div className="text-xs text-stone-500 pt-2">
                创建时间：{new Date(previewItem.createdAt).toLocaleString('zh-CN')} · 点数：{previewItem.creditsCost || 0}
              </div>
              {previewItem.publicRequestedAt ? (
                <div className="text-xs text-stone-500">
                  申请时间：{new Date(previewItem.publicRequestedAt).toLocaleString('zh-CN')}
                </div>
              ) : null}
              {previewItem.publicModeratedAt ? (
                <div className="text-xs text-stone-500">
                  审核时间：{new Date(previewItem.publicModeratedAt).toLocaleString('zh-CN')}
                  {previewItem.publicModeratedBy ? ` · 审核人：${previewItem.publicModeratedBy}` : ''}
                </div>
              ) : null}
              {previewItem.publicModerationNote ? (
                <div className="text-xs text-stone-600">
                  审核备注：{previewItem.publicModerationNote}
                </div>
              ) : null}
            </div>

            {previewItem.resultUrl ? (
              <div className="flex justify-end">
                <a href={`/${locale}/gallery/${previewItem.type}/${previewItem.id}`} target="_blank" rel="noreferrer">
                  <Button variant="secondary">在新窗口打开</Button>
                </a>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {/* Action Modal */}
      <Modal
        isOpen={actionModalOpen}
        onClose={closeActionModal}
        title={
          actionType === 'approve'
            ? '通过公开申请'
            : actionType === 'reject'
            ? '拒绝公开申请'
            : actionType === 'hide'
            ? '隐藏内容'
            : '删除内容'
        }
        size="md"
      >
        <div className="space-y-4">
          {actionType === 'delete' && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <p className="font-ui text-sm text-red-800">
                <span className="font-semibold">警告：</span>删除操作无法撤销，确定要删除这个内容吗？
              </p>
            </div>
          )}

          {actionType === 'reject' && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-4">
              <p className="font-ui text-sm text-orange-800">
                可以填写拒绝原因，用户会在收件箱里收到这条审核说明。
              </p>
            </div>
          )}

          {actionItem && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <p className="font-mono text-xs text-stone-500 mb-2">{actionItem.taskNo}</p>
              <p className="text-sm text-stone-900 line-clamp-2">{actionItem.prompt}</p>
            </div>
          )}

          <div>
            <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
              向用户发送消息（可选）
            </label>
            <textarea
              value={actionMessage}
              onChange={(e) => setActionMessage(e.target.value)}
              placeholder="留空将使用默认提示消息..."
              rows={3}
              className={cn(
                'w-full rounded-lg border border-stone-200 px-4 py-3',
                'font-ui text-sm text-stone-900',
                'placeholder:text-stone-400',
                'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                'transition-colors resize-none'
              )}
            />
            <p className="mt-1 text-xs text-stone-500">
              此消息将发送给内容创建者
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={closeActionModal}
              disabled={actionLoading}
              className="flex-1"
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={confirmAction}
              disabled={actionLoading}
              className={cn(
                'flex-1',
                actionType === 'delete' && 'bg-red-500 hover:bg-red-600',
                actionType === 'approve' && 'bg-emerald-500 hover:bg-emerald-600',
                actionType === 'reject' && 'bg-orange-500 hover:bg-orange-600'
              )}
            >
              {actionLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
                  处理中...
                </span>
              ) : (
                <span>
                  {actionType === 'approve'
                    ? '确认通过'
                    : actionType === 'reject'
                    ? '确认拒绝'
                    : actionType === 'hide'
                    ? '确认隐藏'
                    : '确认删除'}
                </span>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
