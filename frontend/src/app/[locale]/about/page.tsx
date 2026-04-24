'use client'

import { Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ImmersiveDocumentPage } from '@/components/features/shared/ImmersiveDocumentPage'
import { useSiteStore } from '@/lib/store'

export default function AboutPage() {
  const t = useTranslations('pages.about')
  const { settings } = useSiteStore()

  const content = settings?.aboutUs || ''

  return (
    <ImmersiveDocumentPage
      title={t('title')}
      content={content}
      empty={t('empty')}
      icon={Info}
    />
  )
}
