/**
 * 我的作品页面
 */

import { setRequestLocale } from 'next-intl/server'
import { MyGalleryContent } from '@/components/features/user/MyGalleryContent'

export default async function MyGalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <MyGalleryContent />
}
