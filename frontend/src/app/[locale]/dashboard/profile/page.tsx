/**
 * 个人资料页面
 */

import { setRequestLocale } from 'next-intl/server'
import { ProfileContent } from '@/components/features/user/ProfileContent'

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <ProfileContent />
}
