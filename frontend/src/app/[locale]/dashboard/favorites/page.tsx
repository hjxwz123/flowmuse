/**
 * 我的收藏页面
 */

import { setRequestLocale } from 'next-intl/server'
import { FavoritesContent } from '@/components/features/user/FavoritesContent'

export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <FavoritesContent />
}
