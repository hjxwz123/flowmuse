/**
 * Creation Template Types
 * 为新手用户提供预配置的创作模板
 */

export type TemplateCategory = 'portrait' | 'landscape' | 'product' | 'art' | 'video'

export type CreationTemplate = {
  id: string
  category: TemplateCategory
  type: 'image' | 'video'
  name: string
  description: string
  icon: string
  preview: string

  // 预配置参数
  config: {
    modelId?: string
    provider?: string
    operation?: string
    aspectRatio?: string
    prompt?: string
    negativePrompt?: string

    // Video specific
    duration?: string
    resolution?: string
  }

  // 示例提示词
  examplePrompts: string[]

  // 适合人群标签
  tags: string[]

  // 难度等级
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, { name: string; icon: string }> = {
  portrait: { name: '人物肖像', icon: '👤' },
  landscape: { name: '风景照片', icon: '🏞️' },
  product: { name: '产品摄影', icon: '📦' },
  art: { name: '艺术创作', icon: '🎨' },
  video: { name: '视频生成', icon: '🎬' },
}
