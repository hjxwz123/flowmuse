/**
 * 用户管理列表页面
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { FadeIn } from '@/components/shared/FadeIn'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { DataTable, DataTableColumn } from '@/components/admin/tables/DataTable'
import { Pagination } from '@/components/admin/shared/Pagination'
import { StatusBadge, StatusVariant } from '@/components/admin/shared/StatusBadge'
import { adminUserService } from '@/lib/api/services/admin/users'
import type {
  AdminUserListItem,
  UserFilterParams,
  UserRole,
  UserStatus,
} from '@/lib/api/types/admin/users'
import { cn } from '@/lib/utils'

export default function AdminUsersPage() {
  const t = useTranslations('admin.users')
  const tCommon = useTranslations('admin.common')
  const router = useRouter()
  const pathname = usePathname()

  // State
  const [users, setUsers] = useState<AdminUserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('')

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true)
    try {
      // Ensure valid pagination parameters
      const validPage = !currentPage || isNaN(currentPage) || currentPage < 1
        ? 1
        : Math.floor(currentPage)
      const validPageSize = !pageSize || isNaN(pageSize) || pageSize < 1
        ? 20
        : Math.min(100, Math.floor(pageSize))

      const params: UserFilterParams = {
        page: validPage,
        pageSize: validPageSize,
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      }

      const response = await adminUserService.getUsers(params)
      setUsers(response.items)
      setTotal(response.total)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, search, roleFilter, statusFilter])

  // Table columns
  const columns: DataTableColumn<AdminUserListItem>[] = useMemo(
    () => [
      {
        key: 'avatar',
        label: t('fields.email'),
        width: '300px',
        render: (user) => (
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-aurora-pink via-aurora-purple to-aurora-blue">
              {user.avatar && user.avatar.trim() !== '' ? (
                <Image
                  src={user.avatar}
                  alt={user.username || user.email}
                  fill
                  className="object-cover"
                  unoptimized
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                  }}
                />
              ) : null}
              <div className="flex h-full w-full items-center justify-center text-white font-display text-sm">
                {user.username?.[0]?.toUpperCase() ||
                  user.email[0]?.toUpperCase()}
              </div>
            </div>
            {/* Email & Username */}
            <div className="flex flex-col">
              <span className="font-medium text-stone-900">{user.email}</span>
              {user.username && (
                <span className="text-xs text-stone-500">{user.username}</span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'role',
        label: t('fields.role'),
        width: '100px',
        render: (user) => (
          <span
            className={cn(
              'inline-flex items-center rounded-md border px-2.5 py-0.5 font-ui text-xs font-semibold',
              user.role === 'admin'
                ? 'bg-purple-100 text-purple-700 border-purple-200'
                : 'bg-blue-100 text-blue-700 border-blue-200'
            )}
          >
            {user.role === 'admin' ? t('roles.admin') : t('roles.user')}
          </span>
        ),
      },
      {
        key: 'status',
        label: t('fields.status'),
        width: '100px',
        render: (user) => {
          const statusLabel = user.status === 'active'
            ? t('status.active')
            : user.status === 'unverified'
              ? t('status.unverified')
              : t('status.banned')
          const statusVariant = user.status === 'active'
            ? 'completed'
            : user.status === 'unverified'
              ? 'pending'
              : 'failed'
          return (
            <StatusBadge
              status={statusVariant as StatusVariant}
              customLabel={statusLabel}
            />
          )
        },
      },
      {
        key: 'credits',
        label: t('fields.credits'),
        width: '100px',
        align: 'right',
        render: (user) => (
          <span className="font-medium text-stone-900">
            {(user.permanentCredits ?? 0).toLocaleString()}
          </span>
        ),
      },
      {
        key: 'createdAt',
        label: t('fields.createdAt'),
        width: '180px',
        render: (user) => (
          <span className="text-stone-600">
            {new Date(user.createdAt).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ),
      },
      {
        key: 'actions',
        label: tCommon('actions.edit'),
        width: '150px',
        align: 'center',
        render: (user) => (
          <div className="flex items-center justify-center gap-2">
            <Link
              href={`${pathname}/${user.id}`}
              className={cn(
                'rounded-lg px-3 py-1.5 font-ui text-xs font-medium',
                'bg-aurora-purple/10 text-aurora-purple',
                'hover:bg-aurora-purple/20',
                'transition-colors duration-300'
              )}
            >
              {t('actions.viewDetail')}
            </Link>
          </div>
        ),
      },
    ],
    [t, tCommon, pathname]
  )

  return (
    <AdminPageShell title={t('title')} description={t('list')}>
      {/* Filters */}
      <FadeIn variant="fade" delay={0.05}>
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-stone-200 shadow-canvas p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  {tCommon('actions.search')}
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('fields.email')}
                  className={cn(
                    'w-full rounded-lg border border-stone-200 px-4 py-2',
                    'font-ui text-sm text-stone-900',
                    'placeholder:text-stone-400',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors'
                  )}
                />
              </div>

              {/* Role Filter */}
              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  {t('filters.role')}
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
                  className={cn(
                    'w-full rounded-lg border border-stone-200 px-4 py-2',
                    'font-ui text-sm text-stone-900',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors'
                  )}
                >
                  <option value="">{t('filters.all')}</option>
                  <option value="user">{t('roles.user')}</option>
                  <option value="admin">{t('roles.admin')}</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block font-ui text-sm font-medium text-stone-700 mb-2">
                  {t('filters.status')}
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as UserStatus | '')
                  }
                  className={cn(
                    'w-full rounded-lg border border-stone-200 px-4 py-2',
                    'font-ui text-sm text-stone-900',
                    'focus:border-aurora-purple focus:ring-2 focus:ring-aurora-purple/20',
                    'transition-colors'
                  )}
                >
                  <option value="">{t('filters.all')}</option>
                  <option value="active">{t('status.active')}</option>
                  <option value="unverified">{t('status.unverified')}</option>
                  <option value="banned">{t('status.banned')}</option>
                </select>
              </div>
            </div>
          </div>
      </FadeIn>

      {/* Table */}
      <FadeIn variant="fade" delay={0.1}>
          <DataTable
            data={users}
            columns={columns}
            keyExtractor={(user) => user.id}
            loading={loading}
            emptyText={tCommon('status.noData')}
          />
      </FadeIn>

      {/* Pagination */}
      {total > 0 && (
        <FadeIn variant="fade" delay={0.2}>
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(total / pageSize)}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </FadeIn>
      )}
    </AdminPageShell>
  )
}
