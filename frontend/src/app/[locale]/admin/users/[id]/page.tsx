/**
 * 用户详情页面 - 完整版
 */

'use client'

import Link from 'next/link'
import { useState, useEffect, use } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { FadeIn } from '@/components/shared/FadeIn'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { StatusBadge, StatusVariant } from '@/components/admin/shared/StatusBadge'
import { Loading } from '@/components/ui/Loading'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { AdjustCreditsModal } from '@/components/admin/forms/AdjustCreditsModal'
import { adminUserService } from '@/lib/api/services/admin/users'
import { adminMembershipService } from '@/lib/api/services/admin/memberships'
import { useAuthStore } from '@/lib/store'
import type {
  AdminUserDetail,
  CreditTransaction,
  SendUserMessageDto,
  UserCreationItem,
} from '@/lib/api/types/admin/users'
import type { AdminMembershipLevel } from '@/lib/api/types/admin/memberships'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Ban, CheckCircle, Crown, MessageSquareText, Trash2 } from 'lucide-react'

type Tab = 'basic' | 'credits' | 'creations' | 'packages'
type MembershipAction = 'grant' | 'edit' | 'remove'

const toDateTimeLocalInputValue = (value: Date | string | null | undefined) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

const getDefaultMembershipExpireAt = () => {
  const date = new Date()
  date.setDate(date.getDate() + 30)
  return toDateTimeLocalInputValue(date)
}

const readApiErrorMessage = (error: unknown) => {
  const maybeMessage = (
    error as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data?.message
  return Array.isArray(maybeMessage) ? maybeMessage.join('；') : maybeMessage
}

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = use(params)
  const t = useTranslations('admin.users')
  const tCommon = useTranslations('admin.common')
  const router = useRouter()
  const currentAdminId = useAuthStore((state) => state.user?.id)

  const [user, setUser] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('basic')
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false)
  const [isSendMessageOpen, setIsSendMessageOpen] = useState(false)
  const [isBanModalOpen, setIsBanModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isStatusUpdating, setIsStatusUpdating] = useState(false)
  const [isMembershipSubmitting, setIsMembershipSubmitting] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [banReasonInput, setBanReasonInput] = useState('')
  const [banDaysInput, setBanDaysInput] = useState('')
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [membershipLevelsLoading, setMembershipLevelsLoading] = useState(false)
  const [membershipLevels, setMembershipLevels] = useState<AdminMembershipLevel[]>([])
  const [grantMembershipLevelId, setGrantMembershipLevelId] = useState('')
  const [grantPeriod, setGrantPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [grantCycles, setGrantCycles] = useState(1)
  const [grantBonusCredits, setGrantBonusCredits] = useState(true)
  const [membershipAction, setMembershipAction] = useState<MembershipAction>('grant')
  const [editMembershipLevelId, setEditMembershipLevelId] = useState('')
  const [editExpireAt, setEditExpireAt] = useState('')
  const [editDailyCredits, setEditDailyCredits] = useState(0)
  const [clearScheduledMemberships, setClearScheduledMemberships] = useState(false)
  const [notifyMembershipUser, setNotifyMembershipUser] = useState(true)
  const [membershipReason, setMembershipReason] = useState('')
  const [messageForm, setMessageForm] = useState<SendUserMessageDto>({
    title: '',
    content: '',
    level: 'info',
    allowHtml: false,
  })

  // Credits tab data
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)

  // Creations tab data
  const [creations, setCreations] = useState<UserCreationItem[]>([])
  const [creationsLoading, setCreationsLoading] = useState(false)

  // Fetch user detail
  const fetchUser = async () => {
    try {
      const response = await adminUserService.getUserDetail(id)
      setUser(response)
    } catch (error) {
      console.error('Failed to fetch user:', error)
    } finally {
      setLoading(false)
    }
  }

  // Toggle user status (ban/unban)
  const toggleUserStatus = async () => {
    if (!user) return

    const newStatus = user.status === 'active' ? 'banned' : 'active'
    const actionText = newStatus === 'banned' ? '封禁' : '解封'

    if (newStatus === 'banned') {
      setBanReasonInput('')
      setBanDaysInput('')
      setIsBanModalOpen(true)
      return
    }

    if (!confirm(`确定要${actionText}该用户吗？`)) {
      return
    }

    try {
      setIsStatusUpdating(true)
      await adminUserService.updateUserStatus(id, { status: newStatus })
      await fetchUser() // Refresh user data
      toast.success(`用户已${actionText}`)
    } catch (error) {
      console.error('Failed to update user status:', error)
      toast.error(`${actionText}失败，请重试`)
    } finally {
      setIsStatusUpdating(false)
    }
  }

  const submitBanUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const reason = banReasonInput.trim()
    const normalizedBanDays = banDaysInput.trim()
    if (!reason) {
      toast.error(t('banModal.reasonRequired'))
      return
    }

    if (normalizedBanDays) {
      const parsedBanDays = Number(normalizedBanDays)
      if (!Number.isInteger(parsedBanDays) || parsedBanDays <= 0) {
        toast.error('封禁天数必须是大于 0 的整数')
        return
      }
    }

    try {
      setIsStatusUpdating(true)
      await adminUserService.updateUserStatus(id, {
        status: 'banned',
        reason,
        ...(normalizedBanDays ? { banDays: Number(normalizedBanDays) } : {}),
      })
      setIsBanModalOpen(false)
      setBanReasonInput('')
      setBanDaysInput('')
      await fetchUser()
      toast.success('用户已封禁')
    } catch (error) {
      console.error('Failed to ban user:', error)
      toast.error('封禁失败，请重试')
    } finally {
      setIsStatusUpdating(false)
    }
  }

  const loadMembershipLevels = async () => {
    try {
      setMembershipLevelsLoading(true)
      const response = await adminMembershipService.getMembershipLevels()
      const sorted = [...response].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      setMembershipLevels(sorted)
      const activeMembership = user?.membership?.isActive ? user.membership : null
      const preferred = sorted.find((level) => level.isActive) ?? sorted[0]
      if (preferred) {
        setGrantMembershipLevelId((prev) => {
          if (prev && sorted.some((level) => level.id === prev)) return prev
          return preferred.id
        })
        setEditMembershipLevelId((prev) => {
          if (prev && sorted.some((level) => level.id === prev)) return prev
          if (activeMembership && sorted.some((level) => level.id === activeMembership.levelId)) {
            return activeMembership.levelId
          }
          return preferred.id
        })
      } else {
        setGrantMembershipLevelId('')
        setEditMembershipLevelId('')
      }
    } catch (error) {
      console.error('Failed to load membership levels:', error)
      toast.error('加载会员等级失败')
    } finally {
      setMembershipLevelsLoading(false)
    }
  }

  const openGrantMembershipModal = () => {
    const activeMembership = user?.membership?.isActive ? user.membership : null
    const preferredLevel =
      membershipLevels.find((level) => level.id === activeMembership?.levelId) ??
      membershipLevels.find((level) => level.isActive) ??
      membershipLevels[0]

    setMembershipAction(activeMembership ? 'edit' : 'grant')
    setGrantPeriod('monthly')
    setGrantCycles(1)
    setGrantBonusCredits(true)
    setEditMembershipLevelId(activeMembership?.levelId ?? preferredLevel?.id ?? '')
    setEditExpireAt(toDateTimeLocalInputValue(activeMembership?.expireAt) || getDefaultMembershipExpireAt())
    setEditDailyCredits(
      activeMembership?.dailyCreditsRemaining ??
      activeMembership?.dailyCredits ??
      preferredLevel?.dailyCredits ??
      0
    )
    setClearScheduledMemberships(false)
    setNotifyMembershipUser(true)
    setMembershipReason('')
    setIsMembershipModalOpen(true)
    if (membershipLevels.length === 0) {
      void loadMembershipLevels()
    }
  }

  const openSendMessageModal = () => {
    setMessageForm({
      title: '',
      content: '',
      level: 'info',
      allowHtml: false,
    })
    setIsSendMessageOpen(true)
  }

  const openDeleteUserModal = () => {
    setDeleteConfirmInput('')
    setIsDeleteModalOpen(true)
  }

  const submitMembership = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setIsMembershipSubmitting(true)

      if (membershipAction === 'grant') {
        const targetLevel = membershipLevels.find((item) => item.id === grantMembershipLevelId)
        if (!targetLevel) {
          toast.error('请选择会员等级')
          return
        }
        if (!targetLevel.isActive) {
          toast.error('请选择已启用的会员等级')
          return
        }

        const normalizedCycles = Number.isFinite(grantCycles) ? Math.max(1, Math.floor(grantCycles)) : 1
        const result = await adminUserService.grantMembership(id, {
          levelId: targetLevel.id,
          period: grantPeriod,
          cycles: normalizedCycles,
          grantBonusCredits,
        })

        await fetchUser()
        setIsMembershipModalOpen(false)

        if (result.grantedPermanentCredits > 0) {
          toast.success(`会员已开通，并赠送 ${result.grantedPermanentCredits.toLocaleString()} 永久积分`)
        } else {
          toast.success('会员已开通')
        }
        return
      }

      if (membershipAction === 'edit') {
        const targetLevel = membershipLevels.find((item) => item.id === editMembershipLevelId)
        if (!targetLevel) {
          toast.error('请选择会员等级')
          return
        }

        const expireAt = new Date(editExpireAt)
        if (!editExpireAt || Number.isNaN(expireAt.getTime())) {
          toast.error('请选择有效的会员到期时间')
          return
        }
        if (expireAt <= new Date()) {
          toast.error('会员到期时间必须晚于当前时间')
          return
        }

        const normalizedDailyCredits = Number.isFinite(editDailyCredits)
          ? Math.max(0, Math.floor(editDailyCredits))
          : 0

        await adminUserService.updateMembership(id, {
          action: 'update',
          levelId: targetLevel.id,
          expireAt: expireAt.toISOString(),
          dailyCredits: normalizedDailyCredits,
          clearScheduledMemberships,
          notifyUser: notifyMembershipUser,
          reason: membershipReason.trim() || undefined,
        })

        await fetchUser()
        setIsMembershipModalOpen(false)
        toast.success('会员信息已更新')
        return
      }

      await adminUserService.updateMembership(id, {
        action: 'remove',
        clearScheduledMemberships,
        notifyUser: notifyMembershipUser,
        reason: membershipReason.trim() || undefined,
      })

      await fetchUser()
      setIsMembershipModalOpen(false)
      toast.success('会员权益已移除')
    } catch (error) {
      toast.error(readApiErrorMessage(error) || '会员操作失败，请重试')
    } finally {
      setIsMembershipSubmitting(false)
    }
  }

  const submitSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const payload: SendUserMessageDto = {
      title: messageForm.title.trim(),
      content: messageForm.content.trim(),
      level: messageForm.level || 'info',
      allowHtml: messageForm.allowHtml === true,
    }

    if (!payload.title) {
      toast.error('请填写消息标题')
      return
    }
    if (!payload.content) {
      toast.error('请填写消息内容')
      return
    }

    try {
      setIsSendingMessage(true)
      await adminUserService.sendCustomMessage(id, payload)
      setIsSendMessageOpen(false)
      toast.success('消息已发送到用户收件箱')
    } catch (error) {
      const maybeMessage = (
        error as { response?: { data?: { message?: string | string[] } } }
      )?.response?.data?.message
      const message = Array.isArray(maybeMessage) ? maybeMessage.join('；') : maybeMessage
      toast.error(message || '发送消息失败，请重试')
    } finally {
      setIsSendingMessage(false)
    }
  }

  const submitDeleteUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) return

    if (currentAdminId === user.id) {
      toast.error(t('deleteModal.selfForbidden'))
      return
    }

    if (deleteConfirmInput.trim() !== user.email) {
      toast.error(t('deleteModal.confirmMismatch'))
      return
    }

    try {
      setIsDeletingUser(true)
      await adminUserService.deleteUser(id)
      toast.success(t('deleteModal.success'))
      router.replace(`/${locale}/admin/users`)
      router.refresh()
    } catch (error) {
      const maybeMessage = (
        error as { response?: { data?: { message?: string | string[] } }; message?: string }
      )?.response?.data?.message
      const message = Array.isArray(maybeMessage) ? maybeMessage.join('；') : maybeMessage
      toast.error(message || t('deleteModal.failed'))
    } finally {
      setIsDeletingUser(false)
    }
  }

  useEffect(() => {
    fetchUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Fetch transactions when credits tab is active
  useEffect(() => {
    if (activeTab === 'credits' && user) {
      setTransactionsLoading(true)
      adminUserService
        .getCreditTransactions(id, 1, 20)
        .then((response) => setTransactions(response.items))
        .catch((err) => console.error('Failed to fetch transactions:', err))
        .finally(() => setTransactionsLoading(false))
    }
  }, [activeTab, id, user])

  // Fetch creations when creations tab is active
  useEffect(() => {
    if (activeTab === 'creations' && user) {
      setCreationsLoading(true)
      adminUserService
        .getUserCreations(id, 1, 20)
        .then((response) => setCreations(response.items))
        .catch((err) => console.error('Failed to fetch creations:', err))
        .finally(() => setCreationsLoading(false))
    }
  }, [activeTab, id, user])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-ui text-stone-600 dark:text-stone-400">用户不存在</p>
      </div>
    )
  }

  const formatAuthEventType = (type: 'register' | 'login') => {
    return type === 'register' ? '注册' : '登录'
  }

  const formatBanExpireAt = (value: string | null) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString('zh-CN')
  }

  const formatDateTime = (value: string | null) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString('zh-CN')
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'basic', label: t('tabs.basic') },
    { key: 'credits', label: t('tabs.credits') },
    { key: 'creations', label: t('tabs.creations') },
    { key: 'packages', label: t('tabs.packages') },
  ]
  const isSelfUser = currentAdminId === user.id
  const activeMembership = user.membership?.isActive ? user.membership : null
  const scheduledMemberships = user.scheduledMemberships ?? []
  const hasAnyMembership = Boolean(activeMembership) || scheduledMemberships.length > 0
  const selectedEditLevel = membershipLevels.find((level) => level.id === editMembershipLevelId)
  const membershipModalTitle =
    membershipAction === 'grant'
      ? '开通会员'
      : membershipAction === 'edit'
        ? '修改会员信息'
        : '移除会员权益'
  const membershipSubmitLabel =
    membershipAction === 'grant'
      ? '确认开通'
      : membershipAction === 'edit'
        ? '保存修改'
        : '确认移除'
  const membershipActionItems: Array<{ key: MembershipAction; label: string; disabled?: boolean }> = [
    { key: 'grant', label: activeMembership ? '续费/升级' : '开通会员' },
    { key: 'edit', label: '修改信息', disabled: !activeMembership },
    { key: 'remove', label: '移除会员', disabled: !hasAnyMembership },
  ]
  const minMembershipExpireAt = toDateTimeLocalInputValue(new Date())

  return (
    <>
      <AdminPageShell
        title={user.username || user.email}
        description={user.email}
        actions={(
          <button
            onClick={() => router.back()}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-3 py-2',
              'font-ui text-sm text-stone-700 dark:text-stone-300 shadow-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800'
            )}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            {tCommon('actions.back')}
          </button>
        )}
      >
        {/* User Header */}
        <FadeIn variant="fade" delay={0.05}>
          <div className="rounded-2xl bg-stone-50/80 dark:bg-stone-900/80 backdrop-blur-sm border border-stone-200 dark:border-stone-800 shadow-canvas p-6">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-aurora-pink via-aurora-purple to-aurora-blue">
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
                <div className="flex h-full w-full items-center justify-center text-stone-50 font-display text-2xl">
                  {user.username?.[0]?.toUpperCase() ||
                    user.email[0]?.toUpperCase()}
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
                    {user.username || user.email}
                  </h1>
                  <StatusBadge
                    status={
                      user.status === 'active'
                        ? 'completed'
                        : user.status === 'unverified'
                          ? 'pending'
                          : 'failed'
                    }
                    customLabel={
                      user.status === 'active'
                        ? t('status.active')
                        : user.status === 'unverified'
                          ? t('status.unverified')
                          : t('status.banned')
                    }
                  />
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md border px-2.5 py-0.5 font-ui text-xs font-semibold',
                      user.role === 'admin'
                        ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/60'
                        : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60'
                    )}
                  >
                    {user.role === 'admin' ? t('roles.admin') : t('roles.user')}
                  </span>
                  {(user.role !== 'admin' || !isSelfUser) && (
                    <div className="ml-auto flex items-center gap-2">
                      {user.role !== 'admin' ? (
                        <>
                          <button
                            type="button"
                            onClick={openSendMessageModal}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-ui text-xs font-medium transition-colors',
                              'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-900/60'
                            )}
                          >
                            <MessageSquareText className="w-3.5 h-3.5" />
                            发送消息
                          </button>

                          <button
                            type="button"
                            onClick={openGrantMembershipModal}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-ui text-xs font-medium transition-colors',
                              'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-900/60'
                            )}
                          >
                            <Crown className="w-3.5 h-3.5" />
                            管理会员
                          </button>

                          <button
                            onClick={toggleUserStatus}
                            disabled={isStatusUpdating}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-ui text-xs font-medium transition-colors',
                              user.status === 'active'
                                ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/60'
                                : 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-900/60',
                              isStatusUpdating && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            {isStatusUpdating ? (
                              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : user.status === 'active' ? (
                              <Ban className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            {user.status === 'active' ? t('actions.ban') : t('actions.unban')}
                          </button>
                        </>
                      ) : null}

                      {!isSelfUser ? (
                        <button
                          type="button"
                          onClick={openDeleteUserModal}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-ui text-xs font-medium transition-colors',
                            'border border-red-200 dark:border-red-900/60 bg-red-600 text-stone-50 hover:bg-red-700'
                          )}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t('actions.delete')}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
                <p className="font-ui text-sm text-stone-600 dark:text-stone-400 mb-4">
                  {user.email}
                </p>

                {user.status === 'banned' && user.banReason ? (
                  <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4">
                    <p className="text-xs font-medium text-red-600 dark:text-red-300">{t('banModal.currentReason')}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-red-800 dark:text-red-200">
                      {user.banReason}
                    </p>
                    <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                      {formatBanExpireAt(user.banExpireAt)
                        ? `解封时间：${formatBanExpireAt(user.banExpireAt)}`
                        : '封禁类型：永久封禁'}
                    </p>
                  </div>
                ) : null}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <div>
                    <p className="font-ui text-xs text-stone-500 dark:text-stone-400 mb-1">
                      {t('fields.credits')}
                    </p>
                    <p className="font-display text-xl font-bold text-aurora-purple">
                      {user.permanentCredits.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-ui text-xs text-stone-500 dark:text-stone-400 mb-1">
                      {t('fields.status')}
                    </p>
                    <p className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                      {user.status === 'active'
                        ? t('status.active')
                        : user.status === 'unverified'
                          ? t('status.unverified')
                          : t('status.banned')}
                    </p>
                  </div>
                  <div>
                    <p className="font-ui text-xs text-stone-500 dark:text-stone-400 mb-1">会员状态</p>
                    {activeMembership ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-stone-50"
                          style={{ backgroundColor: activeMembership.color }}
                        >
                          {activeMembership.levelName}
                        </span>
                        <span className="text-xs text-stone-500 dark:text-stone-400">{activeMembership.daysLeft}天</span>
                      </div>
                    ) : scheduledMemberships.length > 0 ? (
                      <p className="font-display text-xl font-bold text-amber-600 dark:text-amber-300">
                        待生效 {scheduledMemberships.length}
                      </p>
                    ) : (
                      <p className="font-display text-xl font-bold text-stone-500 dark:text-stone-400">未开通</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Tabs */}
        <FadeIn variant="fade" delay={0.1}>
          <div className="rounded-2xl bg-stone-50/80 dark:bg-stone-900/80 backdrop-blur-sm border border-stone-200 dark:border-stone-800 shadow-canvas overflow-hidden">
            {/* Tab Headers */}
            <div className="flex border-b border-stone-200 dark:border-stone-800">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex-1 px-6 py-4 font-ui text-sm font-medium transition-colors',
                    activeTab === tab.key
                      ? 'bg-aurora-purple/10 text-aurora-purple border-b-2 border-aurora-purple'
                      : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-ui text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                        {t('fields.email')}
                      </label>
                      <p className="font-ui text-sm text-stone-900 dark:text-stone-100">
                        {user.email}
                      </p>
                    </div>
                    <div>
                      <label className="block font-ui text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                        {t('fields.username')}
                      </label>
                      <p className="font-ui text-sm text-stone-900 dark:text-stone-100">
                        {user.username || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="block font-ui text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                        {t('fields.createdAt')}
                      </label>
                      <p className="font-ui text-sm text-stone-900 dark:text-stone-100">
                        {new Date(user.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div>
                      <label className="block font-ui text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                        {t('fields.lastLoginAt')}
                      </label>
                      <p className="font-ui text-sm text-stone-900 dark:text-stone-100">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleString('zh-CN')
                          : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">会员信息</p>
                      {activeMembership ? (
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-stone-50"
                          style={{ backgroundColor: activeMembership.color }}
                        >
                          {activeMembership.levelName}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-500 dark:text-stone-400">未开通</span>
                      )}
                    </div>
                    {activeMembership ? (
                      <div className="mt-2 space-y-1 text-xs text-stone-600 dark:text-stone-400">
                        <p>剩余天数：{activeMembership.daysLeft} 天</p>
                        <p>到期时间：{new Date(activeMembership.expireAt).toLocaleString('zh-CN')}</p>
                        <p>每日会员积分：{activeMembership.dailyCredits ?? '-'} 点</p>
                        <p>今日会员积分余额：{activeMembership.dailyCreditsRemaining ?? 0} 点</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">可通过上方「管理会员」按钮开通。</p>
                    )}

                    {scheduledMemberships.length > 0 ? (
                      <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">排队会员</p>
                          <span className="rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                            {scheduledMemberships.length} 个
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {scheduledMemberships.map((schedule) => (
                            <div
                              key={schedule.id}
                              className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-stone-50 dark:bg-stone-900 p-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium text-stone-50"
                                  style={{ backgroundColor: schedule.color }}
                                >
                                  {schedule.levelName}
                                </span>
                                {!schedule.isLevelActive ? (
                                  <span className="rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[11px] text-stone-500 dark:text-stone-400">
                                    等级已停用
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 space-y-1 text-xs text-stone-600 dark:text-stone-400">
                                <p>生效时间：{new Date(schedule.startsAt).toLocaleString('zh-CN')}</p>
                                <p>到期时间：{new Date(schedule.expireAt).toLocaleString('zh-CN')}</p>
                                <p>每日会员积分：{schedule.dailyCredits} 点</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      null
                    )}
                  </div>

                  <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{t('invite.title')}</p>
                        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t('invite.description')}</p>
                      </div>
                      <span className="rounded-full bg-stone-100 dark:bg-stone-800 px-2.5 py-1 text-xs text-stone-600 dark:text-stone-400">
                        {t('invite.inviteesCount', { count: user.inviteesCount })}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 p-4">
                        <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{t('invite.inviteCode')}</p>
                        <p className="mt-1 break-all font-mono text-sm text-stone-900 dark:text-stone-100">
                          {user.inviteCode || '-'}
                        </p>

                        <p className="mt-4 text-xs font-medium text-stone-500 dark:text-stone-400">{t('invite.invitedBy')}</p>
                        {user.invitedBy ? (
                          <div className="mt-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 p-3">
                            <Link
                              href={`/${locale}/admin/users/${user.invitedBy.id}`}
                              className="text-sm font-medium text-aurora-purple hover:text-aurora-pink"
                            >
                              {user.invitedBy.username || user.invitedBy.email}
                            </Link>
                            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">{user.invitedBy.email}</p>
                            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                              {t('invite.invitedAt')}: {formatDateTime(user.invitedBy.invitedAt)}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{t('invite.none')}</p>
                        )}
                      </div>

                      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{t('invite.invitees')}</p>
                          {user.inviteesCount > 0 ? (
                            <span className="rounded-full bg-stone-50 dark:bg-stone-900 px-2 py-0.5 text-xs text-stone-500 dark:text-stone-400">
                              {user.inviteesCount}
                            </span>
                          ) : null}
                        </div>

                        {user.invitees.length === 0 ? (
                          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{t('invite.noInvitees')}</p>
                        ) : (
                          <div className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
                            {user.invitees.map((invitee) => (
                              <div
                                key={invitee.id}
                                className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <Link
                                      href={`/${locale}/admin/users/${invitee.id}`}
                                      className="block truncate text-sm font-medium text-aurora-purple hover:text-aurora-pink"
                                    >
                                      {invitee.username || invitee.email}
                                    </Link>
                                    <p className="mt-1 truncate text-xs text-stone-600 dark:text-stone-400">{invitee.email}</p>
                                  </div>
                                  <span className="rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[11px] text-stone-500 dark:text-stone-400">
                                    ID {invitee.id}
                                  </span>
                                </div>
                                <div className="mt-2 space-y-1 text-xs text-stone-500 dark:text-stone-400">
                                  <p>{t('invite.invitedAt')}: {formatDateTime(invitee.invitedAt)}</p>
                                  <p>{t('invite.registeredAt')}: {formatDateTime(invitee.createdAt)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {user.status === 'banned' && user.banReason ? (
                    <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300">{t('banModal.currentReason')}</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-red-800 dark:text-red-200">
                        {user.banReason}
                      </p>
                      <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                        {formatBanExpireAt(user.banExpireAt)
                          ? `解封时间：${formatBanExpireAt(user.banExpireAt)}`
                          : '封禁类型：永久封禁'}
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">登录 / 注册 IP 记录</p>
                        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">展示最近 50 条登录与注册来源信息</p>
                      </div>
                      <span className="rounded-full bg-stone-100 dark:bg-stone-800 px-2.5 py-1 text-xs text-stone-600 dark:text-stone-400">
                        {user.authEvents.length} 条
                      </span>
                    </div>

                    {user.authEvents.length === 0 ? (
                      <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">暂无记录</p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {user.authEvents.map((event) => (
                          <div
                            key={event.id}
                            className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                  event.type === 'register'
                                    ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                                    : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                )}
                              >
                                {formatAuthEventType(event.type)}
                              </span>
                              <span className="text-xs text-stone-500 dark:text-stone-400">
                                {new Date(event.createdAt).toLocaleString('zh-CN')}
                              </span>
                            </div>

                            <div className="mt-2 grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-xs font-medium text-stone-500 dark:text-stone-400">IP 地址</p>
                                <p className="mt-1 break-all font-mono text-sm text-stone-900 dark:text-stone-100">
                                  {event.ip || '-'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-stone-500 dark:text-stone-400">User-Agent</p>
                                <p className="mt-1 break-all text-sm text-stone-700 dark:text-stone-300">
                                  {event.userAgent || '-'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'credits' && (
                <div className="space-y-6">
                  {/* Credits Summary */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="rounded-lg bg-aurora-purple/10 border border-aurora-purple/20 p-4">
                      <p className="font-ui text-sm text-aurora-purple mb-1">
                        永久点数
                      </p>
                      <p className="font-display text-2xl font-bold text-aurora-purple">
                        {user.permanentCredits.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Adjust Button */}
                  <div>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setIsAdjustModalOpen(true)}
                    >
                      {t('actions.adjustCredits')}
                    </Button>
                  </div>

                  {/* Transactions List */}
                  <div>
                    <h3 className="font-ui text-base font-semibold text-stone-900 dark:text-stone-100 mb-3">
                      交易记录
                    </h3>
                    {transactionsLoading ? (
                      <Loading />
                    ) : transactions.length === 0 ? (
                      <p className="font-ui text-sm text-stone-500 dark:text-stone-400 text-center py-8">
                        暂无交易记录
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {transactions.map((txn) => (
                          <div
                            key={txn.id}
                            className="flex items-center justify-between p-4 rounded-lg border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <StatusBadge
                                  status={
                                    txn.type === 'add' || txn.type === 'purchase'
                                      ? 'completed'
                                      : 'failed'
                                  }
                                  customLabel={
                                    txn.type === 'add'
                                      ? '管理员增加'
                                      : txn.type === 'deduct'
                                      ? '管理员扣除'
                                      : txn.type === 'purchase'
                                      ? '购买套餐'
                                      : '消耗点数'
                                  }
                                />
                                <span
                                  className={cn(
                                    'font-ui text-base font-semibold',
                                    txn.type === 'add' || txn.type === 'purchase'
                                      ? 'text-green-600 dark:text-green-300'
                                      : 'text-red-600 dark:text-red-300'
                                  )}
                                >
                                  {txn.type === 'add' || txn.type === 'purchase'
                                    ? '+'
                                    : '-'}
                                  {Math.abs(txn.amount).toLocaleString()}
                                </span>
                              </div>
                              <p className="font-ui text-sm text-stone-600 dark:text-stone-400">
                                {txn.reason}
                              </p>
                              <p className="font-ui text-xs text-stone-500 dark:text-stone-400 mt-1">
                                余额: {txn.balanceBefore.toLocaleString()} →{' '}
                                {txn.balanceAfter.toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-ui text-xs text-stone-500 dark:text-stone-400">
                                {new Date(txn.createdAt).toLocaleString(
                                  'zh-CN',
                                  {
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'creations' && (
                <div>
                  {creationsLoading ? (
                    <Loading />
                  ) : creations.length === 0 ? (
                    <p className="font-ui text-sm text-stone-500 dark:text-stone-400 text-center py-8">
                      暂无创作记录
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {creations.map((creation) => (
                        <div
                          key={creation.id}
                          className="rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden hover:shadow-canvas transition-shadow"
                        >
                          {creation.thumbnailUrl && (
                            <div className="relative aspect-square bg-stone-100 dark:bg-stone-800">
                              <Image
                                src={creation.thumbnailUrl}
                                alt={creation.prompt}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                          <div className="p-3">
                            <StatusBadge
                              status={creation.status as StatusVariant}
                              className="mb-2"
                            />
                            <p className="font-ui text-xs text-stone-600 dark:text-stone-400 line-clamp-2">
                              {creation.prompt}
                            </p>
                            <p className="font-ui text-xs text-stone-500 dark:text-stone-400 mt-2">
                              消耗 {creation.creditsUsed} 点数
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'packages' && (
                <div>
                  <p className="font-ui text-sm text-stone-500 dark:text-stone-400 text-center py-8">
                    套餐信息功能开发中...
                  </p>
                </div>
              )}
            </div>
          </div>
        </FadeIn>
      </AdminPageShell>

      <Modal
        isOpen={isBanModalOpen}
        onClose={() => {
          if (!isStatusUpdating) {
            setIsBanModalOpen(false)
            setBanReasonInput('')
            setBanDaysInput('')
          }
        }}
        title={t('banModal.title')}
        size="md"
      >
        <form onSubmit={submitBanUser} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">
              {t('banModal.reasonLabel')}
            </label>
            <textarea
              value={banReasonInput}
              onChange={(event) => setBanReasonInput(event.target.value)}
              rows={5}
              maxLength={2000}
              className={cn(
                'w-full rounded-lg border border-stone-200 dark:border-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
              )}
              placeholder={t('banModal.reasonPlaceholder')}
              required
            />
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">{t('banModal.reasonHint')}</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">
              封禁天数
            </label>
            <input
              type="number"
              min="1"
              value={banDaysInput}
              onChange={(event) => setBanDaysInput(event.target.value)}
              className={cn(
                'w-full rounded-lg border border-stone-200 dark:border-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
              )}
              placeholder="留空表示永久封禁，例如 7"
            />
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
              留空表示永久封禁；填写正整数时表示从当前时间开始封禁对应天数。
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsBanModalOpen(false)
                setBanReasonInput('')
                setBanDaysInput('')
              }}
              disabled={isStatusUpdating}
            >
              {t('banModal.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isStatusUpdating}
              disabled={isStatusUpdating}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('banModal.submit')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeletingUser) {
            setIsDeleteModalOpen(false)
            setDeleteConfirmInput('')
          }
        }}
        title={t('deleteModal.title')}
        size="md"
      >
        <form onSubmit={submitDeleteUser} className="space-y-4">
          <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
            <p className="font-medium">{t('deleteModal.description')}</p>
            <p className="mt-2 break-all text-red-800 dark:text-red-200">{user.email}</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">
              {t('deleteModal.confirmLabel')}
            </label>
            <input
              value={deleteConfirmInput}
              onChange={(event) => setDeleteConfirmInput(event.target.value)}
              className={cn(
                'w-full rounded-lg border border-stone-200 dark:border-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                'focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20'
              )}
              placeholder={t('deleteModal.confirmPlaceholder')}
              autoComplete="off"
              required
            />
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">{t('deleteModal.confirmHint')}</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsDeleteModalOpen(false)
                setDeleteConfirmInput('')
              }}
              disabled={isDeletingUser}
            >
              {t('deleteModal.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isDeletingUser}
              disabled={isDeletingUser}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('deleteModal.submit')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isSendMessageOpen}
        onClose={() => {
          if (!isSendingMessage) setIsSendMessageOpen(false)
        }}
        title="发送站内消息"
        size="md"
      >
        <form onSubmit={submitSendMessage} className="space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            支持发送纯文本或 HTML 内容。HTML 会在用户收件箱中按内容渲染。
          </p>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">消息标题</label>
            <input
              value={messageForm.title}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, title: event.target.value }))}
              maxLength={200}
              className={cn(
                'w-full rounded-lg border border-stone-200 dark:border-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
              )}
              placeholder="例如：系统维护通知"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">消息级别</label>
            <select
              value={messageForm.level ?? 'info'}
              onChange={(event) =>
                setMessageForm((prev) => ({
                  ...prev,
                  level: event.target.value as NonNullable<SendUserMessageDto['level']>,
                }))
              }
              className={cn(
                'w-full rounded-lg border border-stone-200 dark:border-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
              )}
            >
              <option value="info">普通</option>
              <option value="success">成功</option>
              <option value="error">警告</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">消息内容</label>
            <textarea
              value={messageForm.content}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, content: event.target.value }))}
              maxLength={10000}
              rows={8}
              className={cn(
                'w-full rounded-lg border border-stone-200 dark:border-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
              )}
              placeholder="请输入消息内容；如需富文本可填写 HTML。"
              required
            />
          </div>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={messageForm.allowHtml === true}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, allowHtml: event.target.checked }))}
              className="h-4 w-4 rounded border-stone-300 dark:border-stone-700 text-aurora-purple focus:ring-aurora-purple/40"
            />
            <span className="text-sm text-stone-700 dark:text-stone-300">按 HTML 渲染内容</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsSendMessageOpen(false)}
              disabled={isSendingMessage}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSendingMessage}
              disabled={isSendingMessage}
            >
              发送
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isMembershipModalOpen}
        onClose={() => {
          if (!isMembershipSubmitting) setIsMembershipModalOpen(false)
        }}
        title={membershipModalTitle}
        size="lg"
      >
        <form onSubmit={submitMembership} className="space-y-5">
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 p-4">
            <p className="text-sm font-medium text-stone-900 dark:text-stone-100">当前会员状态</p>
            {activeMembership ? (
              <div className="mt-3 space-y-2 text-sm text-stone-600 dark:text-stone-400">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-stone-50"
                    style={{ backgroundColor: activeMembership.color }}
                  >
                    {activeMembership.levelName}
                  </span>
                  <span>{activeMembership.daysLeft} 天后到期</span>
                </div>
                <p>到期时间：{new Date(activeMembership.expireAt).toLocaleString('zh-CN')}</p>
                <p>每日会员积分：{activeMembership.dailyCredits ?? '-'} 点</p>
                <p>今日会员积分余额：{activeMembership.dailyCreditsRemaining ?? 0} 点</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">当前没有生效中的会员。</p>
            )}
            {scheduledMemberships.length > 0 ? (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                还有 {scheduledMemberships.length} 个排队会员，可在修改或移除时选择一并清空。
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">操作类型</label>
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 p-1">
              {membershipActionItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={item.disabled || isMembershipSubmitting}
                  onClick={() => {
                    setMembershipAction(item.key)
                    setClearScheduledMemberships(item.key === 'remove' && !activeMembership && scheduledMemberships.length > 0)
                  }}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    membershipAction === item.key
                      ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm'
                      : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800',
                    (item.disabled || isMembershipSubmitting) && 'cursor-not-allowed opacity-50'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {membershipAction === 'grant' ? (
            <p className="text-sm text-stone-600 dark:text-stone-400">
              为用户开通、续费或升级会员。购买低等级会员时会进入排队会员，不会立即降级当前权益。
            </p>
          ) : membershipAction === 'edit' ? (
            <p className="text-sm text-stone-600 dark:text-stone-400">
              直接修改当前会员的等级、到期时间和今日会员积分余额。
            </p>
          ) : (
            <p className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
              移除后用户将立即失去当前会员权益。这个操作不会扣除永久积分。
            </p>
          )}

          {membershipAction !== 'remove' ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">会员等级</label>
              {membershipLevelsLoading ? (
                <div className="flex h-10 items-center text-sm text-stone-500 dark:text-stone-400">加载会员等级中...</div>
              ) : membershipLevels.length === 0 ? (
                <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-3 py-2 text-sm text-stone-500 dark:text-stone-400">
                  暂无可用会员等级，请先到「会员等级管理」中创建。
                </div>
              ) : (
                <select
                  value={membershipAction === 'grant' ? grantMembershipLevelId : editMembershipLevelId}
                  onChange={(event) => {
                    if (membershipAction === 'grant') {
                      setGrantMembershipLevelId(event.target.value)
                      return
                    }
                    setEditMembershipLevelId(event.target.value)
                    const nextLevel = membershipLevels.find((level) => level.id === event.target.value)
                    if (nextLevel) {
                      setEditDailyCredits(nextLevel.dailyCredits)
                    }
                  }}
                  className={cn(
                    'w-full rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                    'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
                  )}
                  required
                >
                  {membershipLevels.map((level) => (
                    <option
                      key={level.id}
                      value={level.id}
                      disabled={membershipAction === 'grant' && !level.isActive}
                    >
                      {level.name} {!level.isActive ? '(已禁用)' : ''} | 月付 ¥{Number(level.monthlyPrice).toFixed(2)} | 年付 ¥{Number(level.yearlyPrice).toFixed(2)} | 每日 {level.dailyCredits} 点
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          {membershipAction === 'grant' ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">开通周期类型</label>
                  <select
                    value={grantPeriod}
                    onChange={(event) => setGrantPeriod(event.target.value as 'monthly' | 'yearly')}
                    className={cn(
                      'w-full rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                      'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
                    )}
                  >
                    <option value="monthly">月付</option>
                    <option value="yearly">年付</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">开通期数</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={grantCycles}
                    onChange={(event) => setGrantCycles(Math.max(1, Number(event.target.value) || 1))}
                    className={cn(
                      'w-full rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                      'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
                    )}
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={grantBonusCredits}
                  onChange={(event) => setGrantBonusCredits(event.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-aurora-purple focus:ring-aurora-purple/40"
                />
                <span className="text-sm text-stone-700 dark:text-stone-300">按会员等级规则赠送永久积分</span>
              </label>
            </>
          ) : null}

          {membershipAction === 'edit' ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">到期时间</label>
                  <input
                    type="datetime-local"
                    value={editExpireAt}
                    min={minMembershipExpireAt}
                    onChange={(event) => setEditExpireAt(event.target.value)}
                    className={cn(
                      'w-full rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                      'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
                    )}
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">今日会员积分余额</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={editDailyCredits}
                    onChange={(event) => setEditDailyCredits(Math.max(0, Number(event.target.value) || 0))}
                    className={cn(
                      'w-full rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                      'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
                    )}
                  />
                  <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                    {selectedEditLevel ? `当前等级每日额度：${selectedEditLevel.dailyCredits} 点。` : '设置用户今天还能使用的会员积分。'}
                  </p>
                </div>
              </div>

              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={clearScheduledMemberships}
                  onChange={(event) => setClearScheduledMemberships(event.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-aurora-purple focus:ring-aurora-purple/40"
                />
                <span className="text-sm text-stone-700 dark:text-stone-300">同时清空排队会员</span>
              </label>
            </>
          ) : null}

          {membershipAction === 'remove' ? (
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={clearScheduledMemberships}
                onChange={(event) => setClearScheduledMemberships(event.target.checked)}
                className="h-4 w-4 rounded border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-aurora-purple focus:ring-aurora-purple/40"
              />
              <span className="text-sm text-stone-700 dark:text-stone-300">同时清空排队会员</span>
            </label>
          ) : null}

          {membershipAction !== 'grant' ? (
            <>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyMembershipUser}
                  onChange={(event) => setNotifyMembershipUser(event.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-aurora-purple focus:ring-aurora-purple/40"
                />
                <span className="text-sm text-stone-700 dark:text-stone-300">发送站内通知给用户</span>
              </label>

              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">调整原因</label>
                <textarea
                  value={membershipReason}
                  onChange={(event) => setMembershipReason(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  className={cn(
                    'w-full rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                    'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
                  )}
                  placeholder="可选，填写后会出现在用户通知中。"
                />
              </div>
            </>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsMembershipModalOpen(false)}
              disabled={isMembershipSubmitting}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isMembershipSubmitting}
              disabled={
                isMembershipSubmitting ||
                membershipLevelsLoading ||
                (membershipAction !== 'remove' && membershipLevels.length === 0)
              }
              className={membershipAction === 'remove' ? 'bg-red-600 hover:bg-red-700' : undefined}
            >
              {membershipSubmitLabel}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Adjust Credits Modal */}
      <AdjustCreditsModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        userId={id}
        currentCredits={user?.permanentCredits || 0}
        onSuccess={() => {
          fetchUser() // Refresh user data
          setActiveTab('credits') // Switch to credits tab to see the update
        }}
      />
    </>
  )
}
