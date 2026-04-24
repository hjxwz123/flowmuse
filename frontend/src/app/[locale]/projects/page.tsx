import { setRequestLocale } from 'next-intl/server'

import { ProjectsContent } from '@/components/features/projects/ProjectsContent'

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  setRequestLocale(locale)

  return <ProjectsContent />
}
