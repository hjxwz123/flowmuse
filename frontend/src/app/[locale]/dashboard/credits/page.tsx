/**
 * 点数明细页面
 */

import { setRequestLocale } from 'next-intl/server'
import { CreditsContent } from '@/components/features/user/CreditsContent'

export default async function CreditsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <CreditsContent />
}
