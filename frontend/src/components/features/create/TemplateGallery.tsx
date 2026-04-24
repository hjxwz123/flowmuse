/**
 * 模板选择器组件
 * 让新手用户通过模板快速开始创作
 */

'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  User,
  Mountain,
  Package,
  Palette,
  Film,
  Briefcase,
  Brush,
  Waves,
  Gift,
  Rainbow,
  Pencil,
  Sun,
  LucideIcon,
} from 'lucide-react'
import {
  CREATION_TEMPLATES,
  getTemplatesByCategory,
  getTemplatesByType,
} from './data/templates'
import type { CreationTemplate, TemplateCategory } from './types/templates'
import { TEMPLATE_CATEGORIES } from './types/templates'

interface TemplateGalleryProps {
  type: 'image' | 'video'
  onSelectTemplate: (template: CreationTemplate) => void
}

// 图标映射 - 将 emoji 映射为 SVG 图标
const ICON_MAP: Record<string, LucideIcon> = {
  '👔': Briefcase,
  '🎭': Brush,
  '⛰️': Mountain,
  '🌃': Sun,
  '📱': Package,
  '☕': Gift,
  '🌈': Rainbow,
  '✏️': Pencil,
  '🌊': Waves,
  '🎁': Gift,
  '👤': User,
  '🏞️': Mountain,
  '📦': Package,
  '🎨': Palette,
  '🎬': Film,
}

// 分类图标映射
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  '👤': User,
  '🏞️': Mountain,
  '📦': Package,
  '🎨': Palette,
  '🎬': Film,
}

// 获取图标组件
function getIconComponent(iconStr: string) {
  return ICON_MAP[iconStr] || Package
}

// 获取分类图标组件
function getCategoryIcon(iconStr: string) {
  return CATEGORY_ICON_MAP[iconStr] || Package
}

export function TemplateGallery({ type, onSelectTemplate }: TemplateGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')

  const filteredTemplates =
    selectedCategory === 'all'
      ? getTemplatesByType(type)
      : getTemplatesByCategory(selectedCategory).filter((t) => t.type === type)

  return (
    <div className="space-y-6">
      {/* 标题区域 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">选择创作模板</h2>
        <p className="text-muted-foreground">
          从预设模板开始，让AI创作更简单
        </p>
      </div>

      {/* 分类筛选 */}
      <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as TemplateCategory | 'all')}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">全部</TabsTrigger>
          {Object.entries(TEMPLATE_CATEGORIES).map(([key, { name, icon }]) => {
            const CategoryIcon = getCategoryIcon(icon)
            return (
              <TabsTrigger key={key} value={key}>
                <CategoryIcon className="h-4 w-4 mr-1" />
                {name}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      {/* 模板网格 */}
      <div className="h-[500px] w-full overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
          {filteredTemplates.map((template) => {
            const TemplateIcon = getIconComponent(template.icon)
            return (
              <Card
                key={template.id}
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
                onClick={() => onSelectTemplate(template)}
              >
                <CardContent className="p-4 space-y-3">
                  {/* 模板图标和标题 */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <TemplateIcon className="h-8 w-8 text-primary" />
                      <div>
                        <h3 className="font-semibold">{template.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {template.description}
                        </p>
                      </div>
                    </div>
                  </div>

                {/* 示例提示词 */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">示例提示词：</p>
                  <p className="text-xs bg-muted p-2 rounded line-clamp-2">
                    {template.examplePrompts[0]}
                  </p>
                </div>

                {/* 标签 */}
                <div className="flex flex-wrap gap-1">
                  {template.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  <Badge
                    variant={
                      template.difficulty === 'beginner'
                        ? 'default'
                        : template.difficulty === 'intermediate'
                          ? 'secondary'
                          : 'outline'
                    }
                    className="text-xs"
                  >
                    {template.difficulty === 'beginner'
                      ? '新手'
                      : template.difficulty === 'intermediate'
                        ? '进阶'
                        : '高级'}
                  </Badge>
                </div>

                {/* 使用按钮 */}
                <Button className="w-full" size="sm">
                  使用此模板
                </Button>
              </CardContent>
            </Card>
            )
          })}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            该分类暂无{type === 'image' ? '图片' : '视频'}模板
          </div>
        )}
      </div>
    </div>
  )
}
