/**
 * 任务列表页面
 * 路径: /[locale]/tasks
 */

import { setRequestLocale } from 'next-intl/server'
import { TasksContent } from '@/components/features/tasks/TasksContent'

export default async function TasksPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // 启用静态渲染
  setRequestLocale(locale)

  return <TasksContent />
}
