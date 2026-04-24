/**
 * 套餐商城页面
 */

import { setRequestLocale } from 'next-intl/server'
import { PackagesContent } from '@/components/features/packages/PackagesContent'

export const dynamic = 'force-dynamic'

export default async function PackagesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <PackagesContent />
}
