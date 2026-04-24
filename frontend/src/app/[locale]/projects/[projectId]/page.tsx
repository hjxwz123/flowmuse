import { setRequestLocale } from 'next-intl/server'

import { ProjectDetailContent } from '@/components/features/projects/ProjectDetailContent'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>
}) {
  const { locale, projectId } = await params

  setRequestLocale(locale)

  return <ProjectDetailContent projectId={projectId} />
}
