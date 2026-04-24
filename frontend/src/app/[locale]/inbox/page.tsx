/**
 * 收件箱页面
 * 路径: /[locale]/inbox
 */

import { setRequestLocale } from 'next-intl/server'
import { InboxContent } from '@/components/features/inbox/InboxContent'

export default async function InboxPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // 启用静态渲染
  setRequestLocale(locale)

  return <InboxContent />
}

