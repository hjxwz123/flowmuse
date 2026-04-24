/**
 * 个人资料内容组件
 * 显示用户信息、编辑资料、修改密码、套餐信息
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Card, Button, MagicInput } from '@/components/ui'
import { userService } from '@/lib/api/services'
import { useAuthStore } from '@/lib/store/authStore'
import type { UserProfile } from '@/lib/api/types'
import { cn } from '@/lib/utils/cn'
import { PageTransition } from '@/components/shared/PageTransition'
import { FadeIn } from '@/components/shared/FadeIn'
import Image from 'next/image'

export function ProfileContent() {
  const t = useTranslations('dashboard.profile')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { isAuthenticated, updateUser } = useAuthStore()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // 编辑资料表单
  const [username, setUsername] = useState('')
  const [editError, setEditError] = useState('')

  // 修改密码表单
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const avatarInputRef = useRef<HTMLInputElement>(null)

  // 检查登录状态
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, router])

  // 加载用户资料
  useEffect(() => {
    if (!isAuthenticated) return

    const loadData = async () => {
      setIsLoading(true)
      try {
        const profileData = await userService.getProfile()
        setProfile(profileData)
        setUsername(profileData.username)
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isAuthenticated])

  // 保存资料
  const handleSaveProfile = async () => {
    if (!profile) return

    setEditError('')
    setIsSaving(true)

    try {
      const updatedProfile = await userService.updateProfile({
        username: username !== profile.username ? username : undefined,
      })
      setProfile(updatedProfile)
      // 更新全局状态
      updateUser({ username: updatedProfile.username })
      alert(t('saveSuccess'))
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  // 上传头像
  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 检查文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      alert('文件大小不能超过 5MB')
      return
    }

    setIsUploadingAvatar(true)
    try {
      const result = await userService.uploadAvatar(file)
      // 更新 profile
      if (profile) {
        setProfile({ ...profile, avatar: result.avatar })
      }
      // 更新全局状态，让头像立即在导航栏显示
      updateUser({ avatar: result.avatar })
      alert(t('uploadSuccess'))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to upload avatar')
    } finally {
      setIsUploadingAvatar(false)
      if (avatarInputRef.current) {
        avatarInputRef.current.value = ''
      }
    }
  }

  // 修改密码
  const handleChangePassword = async () => {
    setPasswordError('')

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('请填写所有密码字段')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('新密码和确认密码不一致')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('新密码长度不能少于 6 位')
      return
    }

    setIsChangingPassword(true)

    try {
      await userService.updatePassword({
        oldPassword,
        newPassword,
      })
      alert(t('passwordChanged'))
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (!isAuthenticated) return null

  if (isLoading || !profile) {
    return (
      <PageTransition className="min-h-screen bg-canvas px-4 py-12 dark:bg-canvas-dark">
        <div className="mx-auto max-w-5xl py-12 text-center">
          <p className="font-ui text-stone-500 dark:text-stone-400">{tCommon('loading')}</p>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition className="min-h-screen bg-canvas px-4 py-12 dark:bg-canvas-dark">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* 标题 */}
        <FadeIn variant="slide">
          <h1 className="font-display text-4xl font-bold text-stone-900 dark:text-stone-100">
            {t('title')}
          </h1>
        </FadeIn>

        {/* 用户资料卡片 */}
        <FadeIn variant="scale" delay={0.1}>
          <Card variant="glass" className="p-6">
            <h2 className="mb-6 font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
              {t('title')}
            </h2>

            <div className="space-y-6">
              {/* 头像 */}
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-aurora-pink via-aurora-purple to-aurora-blue">
                  {profile.avatar ? (
                    <Image
                      src={profile.avatar}
                      alt="Avatar"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-3xl font-display">
                      {profile.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-2 font-ui text-sm text-stone-600 dark:text-stone-400">
                    {t('avatar')}
                  </p>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    isLoading={isUploadingAvatar}
                    disabled={isUploadingAvatar}
                  >
                    {t('uploadAvatar')}
                  </Button>
                </div>
              </div>

              {/* 邮箱（只读） */}
              <div>
                <label className="mb-2 block font-ui text-sm font-medium text-stone-700 dark:text-stone-300">
                  {t('email')}
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 rounded-full bg-stone-100 px-6 py-3 font-ui text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                    {profile.email}
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium',
                      profile.emailVerified
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    )}
                  >
                    {profile.emailVerified
                      ? t('emailVerified')
                      : t('emailUnverified')}
                  </span>
                </div>
              </div>

              {/* 用户名 */}
              <MagicInput
                label={t('username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('username')}
              />

              {/* 其他信息 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-white/50 p-4 dark:bg-stone-800/60">
                  <p className="mb-1 font-ui text-sm text-stone-600 dark:text-stone-400">角色</p>
                  <p className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
                    {profile.role}
                  </p>
                </div>
                <div className="rounded-xl bg-white/50 p-4 dark:bg-stone-800/60">
                  <p className="mb-1 font-ui text-sm text-stone-600 dark:text-stone-400">状态</p>
                  <p className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
                    {profile.status}
                  </p>
                </div>
                <div className="rounded-xl bg-white/50 p-4 dark:bg-stone-800/60">
                  <p className="mb-1 font-ui text-sm text-stone-600 dark:text-stone-400">会员等级</p>
                  {profile.membership?.isActive ? (
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: profile.membership.color }}
                      >
                        {profile.membership.levelName}
                      </span>
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        剩余 {profile.membership.daysLeft} 天
                      </span>
                    </div>
                  ) : (
                    <p className="font-display text-lg font-semibold text-stone-500 dark:text-stone-400">未开通</p>
                  )}
                </div>
                <div className="rounded-xl bg-white/50 p-4 dark:bg-stone-800/60">
                  <p className="mb-1 font-ui text-sm text-stone-600 dark:text-stone-400">
                    永久点数
                  </p>
                  <p className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
                    {profile.permanentCredits}
                  </p>
                </div>
                <div className="rounded-xl bg-white/50 p-4 dark:bg-stone-800/60">
                  <p className="mb-1 font-ui text-sm text-stone-600 dark:text-stone-400">
                    会员到期
                  </p>
                  {profile.membership?.isActive ? (
                    <p className="font-display text-sm font-semibold text-stone-900 dark:text-stone-100">
                      {new Date(profile.membership.expireAt).toLocaleString('zh-CN')}
                    </p>
                  ) : (
                    <p className="font-display text-sm font-semibold text-stone-500 dark:text-stone-400">-</p>
                  )}
                </div>
                <div className="rounded-xl bg-white/50 p-4 dark:bg-stone-800/60">
                  <p className="mb-1 font-ui text-sm text-stone-600 dark:text-stone-400">注册时间</p>
                  <p className="font-display text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {editError && (
                <p className="font-ui text-sm text-red-600 dark:text-red-400">{editError}</p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={handleSaveProfile}
                  isLoading={isSaving}
                  disabled={isSaving || username === profile.username}
                >
                  {tCommon('actions.save')}
                </Button>
              </div>
            </div>
          </Card>
        </FadeIn>

        {/* 修改密码卡片 */}
        <FadeIn variant="scale" delay={0.2}>
          <Card variant="glass" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                {t('changePassword')}
              </h2>
              {!showPasswordForm && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowPasswordForm(true)}
                >
                  {t('changePassword')}
                </Button>
              )}
            </div>

            {showPasswordForm && (
              <div className="space-y-4">
                <MagicInput
                  label={t('oldPassword')}
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder={t('oldPassword')}
                />
                <MagicInput
                  label={t('newPassword')}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('newPassword')}
                />
                <MagicInput
                  label={t('confirmPassword')}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('confirmPassword')}
                />

                {passwordError && (
                  <p className="font-ui text-sm text-red-600 dark:text-red-400">
                    {passwordError}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    onClick={handleChangePassword}
                    isLoading={isChangingPassword}
                    disabled={isChangingPassword}
                  >
                    {tCommon('actions.save')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowPasswordForm(false)
                      setOldPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                      setPasswordError('')
                    }}
                  >
                    {tCommon('actions.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </FadeIn>
      </div>
    </PageTransition>
  )
}
