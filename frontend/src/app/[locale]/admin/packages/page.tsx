/**
 * 套餐管理列表页面
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { FadeIn } from '@/components/shared/FadeIn'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { DataTable, DataTableColumn } from '@/components/admin/tables/DataTable'
import { StatusBadge } from '@/components/admin/shared/StatusBadge'
import { Button } from '@/components/ui/Button'
import { PackageModal } from '@/components/admin/forms/PackageModal'
import { adminPackageService } from '@/lib/api/services/admin/packages'
import type { AdminPackage } from '@/lib/api/types/admin/packages'
import { cn } from '@/lib/utils'

export default function AdminPackagesPage() {
  const t = useTranslations('admin.packages')
  const tCommon = useTranslations('admin.common')

  // State
  const [packages, setPackages] = useState<AdminPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPackage, setSelectedPackage] = useState<
    AdminPackage | undefined
  >()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Fetch packages
  const fetchPackages = async () => {
    setLoading(true)
    try {
      const data = await adminPackageService.getPackages()
      // Sort by sortOrder, then by createdAt
      const sorted = data.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      setPackages(sorted)
    } catch (error) {
      console.error('Failed to fetch packages:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  // Handlers
  const handleCreate = () => {
    setSelectedPackage(undefined)
    setIsModalOpen(true)
  }

  const handleEdit = (pkg: AdminPackage) => {
    setSelectedPackage(pkg)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm.delete'))) {
      return
    }

    setDeletingId(id)
    try {
      await adminPackageService.deletePackage(id)
      await fetchPackages()
    } catch (error) {
      console.error('Failed to delete package:', error)
      alert('删除失败，请重试')
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleStatus = async (pkg: AdminPackage) => {
    try {
      await adminPackageService.updatePackage(pkg.id, {
        isActive: !pkg.isActive,
      })
      await fetchPackages()
    } catch (error) {
      console.error('Failed to toggle status:', error)
      alert('状态切换失败，请重试')
    }
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedPackage(undefined)
  }

  const handleModalSuccess = () => {
    fetchPackages()
    handleModalClose()
  }

  // Table columns
  const columns: DataTableColumn<AdminPackage>[] = useMemo(
    () => [
      {
        key: 'name',
        label: t('fields.name'),
        width: '200px',
        render: (pkg) => (
          <div className="flex flex-col">
            <span className="font-medium text-stone-900">{pkg.name}</span>
            {pkg.description && (
              <span className="text-xs text-stone-500 mt-0.5">
                {pkg.description}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'packageType',
        label: '类型',
        width: '100px',
        render: () => <span className="text-stone-900">永久积分包</span>,
      },
      {
        key: 'credits',
        label: t('fields.totalCredits'),
        width: '120px',
        align: 'right',
        render: (pkg) => (
          <div className="flex flex-col items-end">
            <span className="font-medium text-stone-900">
              {pkg.totalCredits.toLocaleString()} 点
            </span>
          </div>
        ),
      },
      {
        key: 'price',
        label: t('fields.price'),
        width: '120px',
        align: 'right',
        render: (pkg) => (
          <div className="flex flex-col items-end">
            <span className="font-medium text-aurora-purple">
              ¥{parseFloat(pkg.price).toFixed(2)}
            </span>
            {pkg.originalPrice && (
              <span className="text-xs text-stone-400 line-through">
                ¥{parseFloat(pkg.originalPrice).toFixed(2)}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'status',
        label: t('fields.status'),
        width: '100px',
        render: (pkg) => (
          <StatusBadge
            status={pkg.isActive ? 'enabled' : 'disabled'}
            customLabel={pkg.isActive ? '启用' : '禁用'}
          />
        ),
      },
      {
        key: 'sortOrder',
        label: t('fields.sortOrder'),
        width: '80px',
        align: 'center',
        render: (pkg) => (
          <span className="text-stone-600">{pkg.sortOrder}</span>
        ),
      },
      {
        key: 'actions',
        label: tCommon('actions.edit'),
        width: '200px',
        align: 'center',
        render: (pkg) => (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => handleToggleStatus(pkg)}
              className={cn(
                'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
                'transition-colors duration-300',
                pkg.isActive
                  ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              )}
            >
              {pkg.isActive ? '禁用' : '启用'}
            </button>
            <button
              onClick={() => handleEdit(pkg)}
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
              onClick={() => handleDelete(pkg.id)}
              disabled={deletingId === pkg.id}
              className={cn(
                'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
                'bg-red-100 text-red-700',
                'hover:bg-red-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-300'
              )}
            >
              {deletingId === pkg.id ? '删除中...' : tCommon('actions.delete')}
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
        description="管理永久积分包和价格"
        actions={(
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
            {t('add')}
          </Button>
        )}
      >
        {/* Table */}
        <FadeIn variant="fade" delay={0.05}>
          <DataTable
            data={packages}
            columns={columns}
            keyExtractor={(pkg) => pkg.id}
            loading={loading}
            emptyText={tCommon('status.noData')}
          />
        </FadeIn>
      </AdminPageShell>

      {/* Package Modal */}
      <PackageModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        package={selectedPackage}
      />
    </>
  )
}
