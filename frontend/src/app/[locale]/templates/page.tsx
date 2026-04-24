/**
 * 模板库页面
 */

import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { TemplatesContent } from '@/components/features/templates/TemplatesContent'

export const dynamic = 'force-static'

type TemplatesPageProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({
  params,
}: TemplatesPageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'templates' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function TemplatesPage({
  params,
}: TemplatesPageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return <TemplatesContent />
}
