import { setRequestLocale } from 'next-intl/server'
import { OrdersContent } from '@/components/features/user/OrdersContent'

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <OrdersContent />
}
