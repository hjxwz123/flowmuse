import { setRequestLocale } from 'next-intl/server'
import { CanvasBoardContent } from '@/components/features/canvas/CanvasBoardContent'

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  setRequestLocale(locale)

  return <CanvasBoardContent />
}
