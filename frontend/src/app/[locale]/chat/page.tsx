import { setRequestLocale } from 'next-intl/server'

import { ChatContent } from '@/components/features/chat/ChatContent'

export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  setRequestLocale(locale)

  return <ChatContent initialConversationId={null} />
}
