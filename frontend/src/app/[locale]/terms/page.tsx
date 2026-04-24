'use client'

import { FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ImmersiveDocumentPage } from '@/components/features/shared/ImmersiveDocumentPage'
import { useSiteStore } from '@/lib/store'

export default function TermsPage() {
  const t = useTranslations('pages.terms')
  const { settings } = useSiteStore()

  const content = settings?.termsOfService || ''

  return (
    <ImmersiveDocumentPage
      title={t('title')}
      content={content}
      empty={t('empty')}
      icon={FileText}
    />
  )
}
