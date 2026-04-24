import { redirect } from 'next/navigation'
import { use } from 'react'

export default function AdminConfigPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = use(params)
  redirect(`/${locale}/admin/config/site`)
}
