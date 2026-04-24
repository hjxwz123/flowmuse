'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

import { MembershipChatQuotaModal } from '@/components/admin/forms/MembershipChatQuotaModal'
import { MembershipLevelModal } from '@/components/admin/forms/MembershipLevelModal'
import { StatusBadge } from '@/components/admin/shared/StatusBadge'
import { DataTable, DataTableColumn } from '@/components/admin/tables/DataTable'
import { FadeIn } from '@/components/shared/FadeIn'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { Button } from '@/components/ui/Button'
import { adminMembershipService } from '@/lib/api/services/admin/memberships'
import type { AdminMembershipLevel } from '@/lib/api/types/admin/memberships'
import { cn } from '@/lib/utils/cn'

export default function AdminMembershipsPage() {
  const t = useTranslations('admin.memberships')
  const tCommon = useTranslations('admin.common')

  const [levels, setLevels] = useState<AdminMembershipLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLevel, setSelectedLevel] = useState<AdminMembershipLevel | undefined>(undefined)
  const [quotaLevel, setQuotaLevel] = useState<AdminMembershipLevel | undefined>(undefined)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchLevels = async () => {
    setLoading(true)
    try {
      const data = await adminMembershipService.getMembershipLevels()
      const sorted = data.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      setLevels(sorted)
    } catch (error) {
      console.error('Failed to load membership levels:', error)
      alert(t('error.load'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchLevels()
  }, [])

  const handleCreate = () => {
    setSelectedLevel(undefined)
    setIsModalOpen(true)
  }

  const handleEdit = (level: AdminMembershipLevel) => {
    setSelectedLevel(level)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedLevel(undefined)
  }

  const handleModalSuccess = () => {
    void fetchLevels()
    handleModalClose()
  }

  const handleOpenQuotaModal = (level: AdminMembershipLevel) => {
    setQuotaLevel(level)
    setIsQuotaModalOpen(true)
  }

  const handleCloseQuotaModal = () => {
    setIsQuotaModalOpen(false)
    setQuotaLevel(undefined)
  }

  const handleDelete = async (level: AdminMembershipLevel) => {
    if (!window.confirm(t('confirm.delete', { name: level.name }))) return

    setDeletingId(level.id)
    try {
      await adminMembershipService.deleteMembershipLevel(level.id)
      await fetchLevels()
    } catch (error) {
      const maybeMessage = (
        error as { response?: { data?: { message?: string | string[] } } }
      )?.response?.data?.message
      const message = Array.isArray(maybeMessage) ? maybeMessage.join('；') : maybeMessage
      alert(message || t('error.delete'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleStatus = async (level: AdminMembershipLevel) => {
    setUpdatingId(level.id)
    try {
      await adminMembershipService.updateMembershipLevel(level.id, {
        isActive: !level.isActive,
      })
      await fetchLevels()
    } catch (error) {
      console.error('Failed to toggle membership level status:', error)
      alert(t('error.save'))
    } finally {
      setUpdatingId(null)
    }
  }

  const columns: DataTableColumn<AdminMembershipLevel>[] = useMemo(
    () => [
      {
        key: 'name',
        label: t('fields.name'),
        width: '210px',
        render: (level) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-stone-900">{level.name}</span>
              <span
                className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: level.color }}
              >
                {level.color}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'price',
        label: t('fields.price'),
        width: '180px',
        render: (level) => (
          <div className="space-y-1 text-sm">
            <p className="text-stone-700">
              {t('fields.monthly')}: <span className="font-semibold text-stone-900">¥{Number(level.monthlyPrice).toFixed(2)}</span>
            </p>
            <p className="text-stone-700">
              {t('fields.yearly')}: <span className="font-semibold text-stone-900">¥{Number(level.yearlyPrice).toFixed(2)}</span>
            </p>
          </div>
        ),
      },
      {
        key: 'dailyCredits',
        label: '每日赠送积分',
        width: '140px',
        align: 'center',
        render: (level) => (
          <span className="font-medium text-violet-600">
            {Math.max(0, Number(level.dailyCredits || 0)).toLocaleString()}
          </span>
        ),
      },
      {
        key: 'bonusPermanentCredits',
        label: t('fields.bonusPermanentCredits'),
        width: '140px',
        align: 'center',
        render: (level) => (
          <span className="font-medium text-amber-600">
            +{Math.max(0, Number(level.bonusPermanentCredits || 0)).toLocaleString()}
          </span>
        ),
      },
      {
        key: 'benefits',
        label: t('fields.benefits'),
        render: (level) => {
          const benefits = Array.isArray(level.benefits) ? level.benefits : []
          if (benefits.length === 0) {
            return <span className="text-stone-400">-</span>
          }
          return (
            <div className="space-y-1">
              {benefits.slice(0, 3).map((benefit, index) => (
                <p key={`${level.id}-benefit-${index}`} className="line-clamp-1 text-sm text-stone-700">
                  - {benefit}
                </p>
              ))}
              {benefits.length > 3 && (
                <p className="text-xs text-stone-500">
                  +{benefits.length - 3} {t('fields.moreBenefits')}
                </p>
              )}
            </div>
          )
        },
      },
      {
        key: 'sortOrder',
        label: t('fields.sortOrder'),
        width: '90px',
        align: 'center',
      },
      {
        key: 'isActive',
        label: t('fields.status'),
        width: '100px',
        align: 'center',
        render: (level) => (
          <StatusBadge
            status={level.isActive ? 'enabled' : 'disabled'}
            customLabel={level.isActive ? t('fields.enabled') : t('fields.disabled')}
          />
        ),
      },
      {
        key: 'actions',
        label: tCommon('actions.edit'),
        width: '340px',
        align: 'center',
        render: (level) => (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void handleToggleStatus(level)}
              disabled={updatingId === level.id}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                level.isActive
                  ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200',
                updatingId === level.id && 'cursor-not-allowed opacity-50'
              )}
            >
              {level.isActive ? t('actions.disable') : t('actions.enable')}
            </button>
            <button
              type="button"
              onClick={() => handleOpenQuotaModal(level)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                'bg-sky-100 text-sky-700 hover:bg-sky-200'
              )}
            >
              权限
            </button>
            <button
              type="button"
              onClick={() => handleEdit(level)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                'bg-aurora-purple/10 text-aurora-purple hover:bg-aurora-purple/20'
              )}
            >
              {tCommon('actions.edit')}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(level)}
              disabled={deletingId === level.id}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                'bg-red-100 text-red-700 hover:bg-red-200',
                deletingId === level.id && 'cursor-not-allowed opacity-50'
              )}
            >
              {deletingId === level.id ? t('actions.deleting') : tCommon('actions.delete')}
            </button>
          </div>
        ),
      },
    ],
    [deletingId, t, tCommon, updatingId]
  )

  return (
    <>
      <AdminPageShell
        title={t('title')}
        description={t('description')}
        actions={(
          <Button type="button" variant="primary" onClick={handleCreate}>
            {t('add')}
          </Button>
        )}
      >
        <FadeIn variant="fade" delay={0.05}>
          <DataTable
            data={levels}
            columns={columns}
            keyExtractor={(level) => level.id}
            loading={loading}
            emptyText={t('empty')}
          />
        </FadeIn>
      </AdminPageShell>

      <MembershipLevelModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        level={selectedLevel}
        onSuccess={handleModalSuccess}
      />

      <MembershipChatQuotaModal
        isOpen={isQuotaModalOpen}
        onClose={handleCloseQuotaModal}
        level={quotaLevel}
      />
    </>
  )
}
