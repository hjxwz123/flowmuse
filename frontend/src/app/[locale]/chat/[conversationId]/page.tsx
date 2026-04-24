import { setRequestLocale } from 'next-intl/server'

import { ChatContent } from '@/components/features/chat/ChatContent'

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ locale: string; conversationId: string }>
}) {
  const { locale, conversationId } = await params

  setRequestLocale(locale)

  return <ChatContent initialConversationId={conversationId} />
}
