import { setRequestLocale } from 'next-intl/server'

import { GalleryContent } from '@/components/features/gallery/GalleryContent'

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  setRequestLocale(locale)

  return <GalleryContent locale={locale} />
}
