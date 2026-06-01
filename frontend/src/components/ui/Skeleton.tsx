/**
 * Skeleton 骨架屏组件库
 * 用于在内容加载时显示占位符
 */

import { cn } from '@/lib/utils/cn'
import { Card } from './Card'

/**
 * 基础 Skeleton 组件
 * 可以通过 className 自定义尺寸和样式
 */
export const Skeleton = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-gradient-to-br from-stone-100 via-stone-50 to-stone-100 dark:from-stone-800 dark:via-stone-900 dark:to-stone-800',
        className
      )}
      {...props}
    />
  )
}

/**
 * 作品卡片骨架屏
 * 用于画廊列表页面
 */
export const SkeletonCard = () => {
  return (
    <div className="rounded-3xl overflow-hidden bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-canvas">
      {/* 图片区域 */}
      <Skeleton className="w-full aspect-square" />

      {/* 文本区域 */}
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

/**
 * 任务卡片骨架屏
 * 用于任务列表页面
 */
export const SkeletonTaskCard = () => {
  return (
    <Card variant="glass" className="p-6">
      {/* 预览图区域 */}
      <Skeleton className="w-full aspect-video mb-4 rounded-lg" />

      {/* 标题 */}
      <Skeleton className="h-5 w-2/3 mb-2" />

      {/* 描述 */}
      <Skeleton className="h-4 w-full mb-4" />

      {/* 按钮组 */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
    </Card>
  )
}

/**
 * 详情页骨架屏
 * 用于画廊详情页面
 */
export const SkeletonDetailPage = () => {
  return (
    <div className="h-full w-full max-w-none">
      <div className="grid h-full w-full grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center lg:gap-8">
        {/* 左侧：大图 */}
        <div className="flex min-h-[360px] w-full items-center justify-center rounded-[28px] border border-stone-200/70 bg-white/55 p-3 backdrop-blur-sm dark:border-white/10 dark:bg-stone-900/50 sm:min-h-[460px] lg:min-h-[calc(100vh-180px)]">
          <Skeleton className="h-full min-h-[330px] w-full max-w-[760px] rounded-2xl sm:min-h-[430px] lg:min-h-[min(68vh,760px)]" />
        </div>

        {/* 右侧：信息区域 */}
        <div className="w-full space-y-5 rounded-[28px] border border-stone-200/70 bg-white/45 p-5 backdrop-blur-sm dark:border-white/10 dark:bg-stone-900/45 sm:p-6 lg:min-h-[calc(100vh-220px)]">
          <Skeleton className="h-10 w-5/6 rounded-full" />
          <div className="flex gap-3">
            <Skeleton className="h-11 flex-1 rounded-full" />
            <Skeleton className="h-11 flex-1 rounded-full" />
          </div>
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
