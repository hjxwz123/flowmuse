/**
 * 兑换码管理列表页面
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { FadeIn } from '@/components/shared/FadeIn'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { DataTable, DataTableColumn } from '@/components/admin/tables/DataTable'
import { StatusBadge } from '@/components/admin/shared/StatusBadge'
import { Button } from '@/components/ui/Button'
import { RedeemCodeModal } from '@/components/admin/forms/RedeemCodeModal'
import { BatchRedeemCodeModal } from '@/components/admin/forms/BatchRedeemCodeModal'
import { RedeemLogsModal } from '@/components/admin/forms/RedeemLogsModal'
import { adminRedeemCodeService } from '@/lib/api/services/admin/redeemCodes'
import { adminMembershipService } from '@/lib/api/services/admin/memberships'
import type {
  AdminRedeemCode,
  RedeemCodeType,
  RedeemCodeStatus,
} from '@/lib/api/types/admin/redeemCodes'
import type { AdminMembershipLevel } from '@/lib/api/types/admin/memberships'
import { cn } from '@/lib/utils'

export default function AdminRedeemCodesPage() {
  const t = useTranslations('admin.redeemCodes')
  const tCommon = useTranslations('admin.common')

  const [codes, setCodes] = useState<AdminRedeemCode[]>([])
  const [membershipLevels, setMembershipLevels] = useState<AdminMembershipLevel[]>([])
  const [loading, setLoading] = useState(true)

  const [typeFilter, setTypeFilter] = useState<RedeemCodeType | ''>('')
  const [statusFilter, setStatusFilter] = useState<RedeemCodeStatus | ''>('')
  const [searchQuery, setSearchQuery] = useState('')

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false)
  const [selectedCode, setSelectedCode] = useState<AdminRedeemCode | undefined>()
  const [selectedCodeForLogs, setSelectedCodeForLogs] = useState<{
    id: string
    code: string
  } | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchRedeemCodes = async () => {
    setLoading(true)
    try {
      const data = await adminRedeemCodeService.getRedeemCodes()
      setCodes(data)
    } catch (error) {
      console.error('Failed to fetch redeem codes:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMembershipLevels = async () => {
    try {
      const data = await adminMembershipService.getMembershipLevels()
      setMembershipLevels(data)
    } catch (error) {
      console.error('Failed to fetch membership levels:', error)
    }
  }

  useEffect(() => {
    fetchRedeemCodes()
    fetchMembershipLevels()
  }, [])

  const filteredCodes = useMemo(() => {
    return codes.filter((code) => {
      if (typeFilter && code.type !== typeFilter) return false
      if (statusFilter && code.status !== statusFilter) return false
      if (
        searchQuery &&
        !code.code.toLowerCase().includes(searchQuery.toLowerCase())
      ) return false
      return true
    })
  }, [codes, typeFilter, statusFilter, searchQuery])

  const handleCreate = () => {
    setSelectedCode(undefined)
    setIsCreateModalOpen(true)
  }

  const handleBatchCreate = () => {
    setIsBatchModalOpen(true)
  }

  const handleEdit = (code: AdminRedeemCode) => {
    setSelectedCode(code)
    setIsCreateModalOpen(true)
  }

  const handleViewLogs = (code: AdminRedeemCode) => {
    setSelectedCodeForLogs({ id: code.id, code: code.code })
    setIsLogsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm.delete'))) {
      return
    }

    setDeletingId(id)
    try {
      await adminRedeemCodeService.deleteRedeemCode(id)
      await fetchRedeemCodes()
    } catch (error) {
      console.error('Failed to delete redeem code:', error)
      alert('删除失败，请重试')
    } finally {
      setDeletingId(null)
    }
  }

  const handleExport = async () => {
    try {
      const allCodes = await adminRedeemCodeService.exportRedeemCodes()

      const csvContent = [
        [
          '兑换码',
          '类型',
          '会员等级',
          '会员周期',
          '会员期数',
          '点数',
          '最大使用次数',
          '已使用',
          '过期时间',
          '状态',
          '创建时间',
        ].join(','),
        ...allCodes.map((code) =>
          [
            code.code,
            code.type,
            code.membershipLevel?.name || '',
            code.membershipPeriod || '',
            code.membershipCycles || '',
            code.credits || '',
            code.maxUseCount,
            code.usedCount,
            code.expireDate || '',
            code.status,
            code.createdAt,
          ].join(',')
        ),
      ].join('\n')

      const blob = new Blob(['\uFEFF' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `redeem-codes-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
      alert('导出失败，请重试')
    }
  }

  const handleModalClose = () => {
    setIsCreateModalOpen(false)
    setIsBatchModalOpen(false)
    setIsLogsModalOpen(false)
    setSelectedCode(undefined)
    setSelectedCodeForLogs(null)
  }

  const handleModalSuccess = () => {
    fetchRedeemCodes()
    handleModalClose()
  }

  const getMembershipName = (code: AdminRedeemCode) => {
    if (!code.membershipLevelId) return null
    if (code.membershipLevel?.name) return code.membershipLevel.name
    const level = membershipLevels.find((item) => item.id === code.membershipLevelId)
    return level?.name || `会员 ${code.membershipLevelId}`
  }

  const columns: DataTableColumn<AdminRedeemCode>[] = useMemo(
    () => [
      {
        key: 'code',
        label: t('fields.code'),
        width: '200px',
        render: (code) => (
          <span className="font-mono text-sm text-stone-900">{code.code}</span>
        ),
      },
      {
        key: 'type',
        label: t('fields.type'),
        width: '100px',
        render: (code) => (
          <span
            className={cn(
              'inline-flex items-center rounded-md border px-2.5 py-0.5 font-ui text-xs font-semibold',
              code.type === 'membership'
                ? 'bg-purple-100 text-purple-700 border-purple-200'
                : 'bg-blue-100 text-blue-700 border-blue-200'
            )}
          >
            {code.type === 'membership' ? '会员' : t('types.credits')}
          </span>
        ),
      },
      {
        key: 'value',
        label: t('fields.value'),
        width: '230px',
        render: (code) => (
          <span className="text-stone-900 text-sm">
            {code.type === 'membership'
              ? `${getMembershipName(code) || '会员'}（${code.membershipPeriod === 'yearly' ? '年付' : '月付'} x ${code.membershipCycles ?? 1}期）`
              : `${code.credits} 点`}
          </span>
        ),
      },
      {
        key: 'usage',
        label: t('fields.usedCount'),
        width: '120px',
        align: 'center',
        render: (code) => (
          <span className="text-stone-900">
            {code.usedCount} / {code.maxUseCount}
          </span>
        ),
      },
      {
        key: 'expireDate',
        label: t('fields.expireDate'),
        width: '180px',
        render: (code) => (
          <span className="text-stone-600">
            {code.expireDate
              ? new Date(code.expireDate).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })
              : t('fields.noExpiry')}
          </span>
        ),
      },
      {
        key: 'status',
        label: t('fields.status'),
        width: '100px',
        render: (code) => {
          let statusVariant: 'enabled' | 'disabled' | 'expired' = 'enabled'
          let statusLabel = t('status.active')

          if (code.status === 'disabled') {
            statusVariant = 'disabled'
            statusLabel = t('status.disabled')
          } else if (code.status === 'expired') {
            statusVariant = 'expired'
            statusLabel = t('status.expired')
          }

          return <StatusBadge status={statusVariant} customLabel={statusLabel} />
        },
      },
      {
        key: 'actions',
        label: tCommon('actions.edit'),
        width: '280px',
        align: 'center',
        render: (code) => (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => handleViewLogs(code)}
              className={cn(
                'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
                'bg-blue-100 text-blue-700',
                'hover:bg-blue-200',
                'transition-colors duration-300'
              )}
            >
              {t('viewLogs')}
            </button>
            <button
              onClick={() => handleEdit(code)}
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
              onClick={() => handleDelete(code.id)}
              disabled={deletingId === code.id}
              className={cn(
                'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
                'bg-red-100 text-red-700',
                'hover:bg-red-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-300'
              )}
            >
              {deletingId === code.id ? '删除中...' : tCommon('actions.delete')}
            </button>
          </div>
        ),
      },
    ],
    [t, tCommon, deletingId, membershipLevels]
  )

  return (
    <>
      <AdminPageShell
        title={t('title')}
        description="管理兑换码和批量生成"
        actions={(
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleExport}
              className="flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {t('export')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleBatchCreate}
              className="flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {t('batchCreate')}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleCreate}
              className="flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              {t('create')}
            </Button>
          </div>
        )}
      >
        <FadeIn variant="fade" delay={0.05}>
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-stone-200 shadow-canvas p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  {t('filters.search')}
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="输入兑换码搜索"
                  className={cn(
                    'w-full rounded-lg border border-stone-200 px-4 py-2',
                    'font-ui text-sm text-stone-900',
                    'placeholder:text-stone-400',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors'
                  )}
                />
              </div>

              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  {t('filters.type')}
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as RedeemCodeType | '')}
                  className={cn(
                    'w-full rounded-lg border border-stone-200 px-4 py-2',
                    'font-ui text-sm text-stone-900',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors'
                  )}
                >
                  <option value="">{t('filters.all')}</option>
                  <option value="membership">会员</option>
                  <option value="credits">{t('types.credits')}</option>
                </select>
              </div>

              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  {t('filters.status')}
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as RedeemCodeStatus | '')}
                  className={cn(
                    'w-full rounded-lg border border-stone-200 px-4 py-2',
                    'font-ui text-sm text-stone-900',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors'
                  )}
                >
                  <option value="">{t('filters.all')}</option>
                  <option value="active">{t('status.active')}</option>
                  <option value="disabled">{t('status.disabled')}</option>
                  <option value="expired">{t('status.expired')}</option>
                </select>
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn variant="fade" delay={0.1}>
          <DataTable
            data={filteredCodes}
            columns={columns}
            keyExtractor={(code) => code.id}
            loading={loading}
            emptyText={tCommon('status.noData')}
          />
        </FadeIn>

        {filteredCodes.length > 0 && (
          <FadeIn variant="fade" delay={0.2}>
            <div className="text-sm text-stone-600 text-center">
              显示 {filteredCodes.length} 个兑换码
              {(typeFilter || statusFilter || searchQuery) && ` (共 ${codes.length} 个)`}
            </div>
          </FadeIn>
        )}
      </AdminPageShell>

      <RedeemCodeModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        redeemCode={selectedCode}
      />

      <BatchRedeemCodeModal
        isOpen={isBatchModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />

      <RedeemLogsModal
        isOpen={isLogsModalOpen}
        onClose={handleModalClose}
        redeemCodeId={selectedCodeForLogs?.id || null}
        redeemCodeValue={selectedCodeForLogs?.code || ''}
      />
    </>
  )
}
