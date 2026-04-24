import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales } from '@/i18n/locales'
import { ConditionalLayout } from '@/components/layouts/ConditionalLayout'

export const dynamicParams = false

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // 验证 locale
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!locales.includes(locale as any)) {
    notFound()
  }

  // 启用静态渲染
  setRequestLocale(locale)

  // 获取翻译消息
  const rawMessages = await getMessages()
  const messages = Object.fromEntries(
    Object.entries(rawMessages).filter(([namespace]) => namespace !== 'admin')
  )

  return (
    <NextIntlClientProvider key={locale} locale={locale} messages={messages}>
      <ConditionalLayout>{children}</ConditionalLayout>
    </NextIntlClientProvider>
  )
}
