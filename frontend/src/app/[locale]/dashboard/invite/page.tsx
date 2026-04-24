/**
 * 邀请奖励页面
 */

import { setRequestLocale } from 'next-intl/server'
import { InviteContent } from '@/components/features/user/InviteContent'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <InviteContent />
}
