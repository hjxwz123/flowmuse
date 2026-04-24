/**
 * 创作工作台页面
 * 路径: /[locale]/create
 * 使用简化版创作界面，更适合新手用户
 */

import { setRequestLocale } from 'next-intl/server'
import { SimplifiedCreateContent } from '@/components/features/create/SimplifiedCreateContent'

export default async function CreatePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // 启用静态渲染
  setRequestLocale(locale)

  return <SimplifiedCreateContent />
}
