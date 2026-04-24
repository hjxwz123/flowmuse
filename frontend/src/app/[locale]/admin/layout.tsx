import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'

import { AdminLayoutClient } from '@/components/admin/layout/AdminLayoutClient'

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </NextIntlClientProvider>
  )
}
