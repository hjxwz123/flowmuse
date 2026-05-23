/**
 * 状态标签组件
 * 用于显示用户状态、任务状态等
 */

import { cn } from '@/lib/utils'

export type StatusVariant =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'banned'
  | 'enabled'
  | 'disabled'
  | 'public'
  | 'private'
  | 'used'
  | 'unused'
  | 'expired'

const statusConfig: Record<
  StatusVariant,
  { label: string; className: string }
> = {
  // User status
  active: {
    label: '正常',
    className: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/60',
  },
  inactive: {
    label: '未激活',
    className: 'bg-gray-100 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  },
  banned: {
    label: '已禁用',
    className: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/60',
  },

  // Task status
  pending: {
    label: '等待中',
    className: 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/60',
  },
  processing: {
    label: '处理中',
    className: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60',
  },
  completed: {
    label: '已完成',
    className: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/60',
  },
  failed: {
    label: '失败',
    className: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/60',
  },

  // General status
  enabled: {
    label: '已启用',
    className: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/60',
  },
  disabled: {
    label: '已禁用',
    className: 'bg-gray-100 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  },

  // Visibility
  public: {
    label: '公开',
    className: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60',
  },
  private: {
    label: '私密',
    className: 'bg-gray-100 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  },

  // Redeem code status
  used: {
    label: '已使用',
    className: 'bg-gray-100 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  },
  unused: {
    label: '未使用',
    className: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/60',
  },
  expired: {
    label: '已过期',
    className: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/60',
  },
}

interface StatusBadgeProps {
  status: StatusVariant
  customLabel?: string
  className?: string
}

export const StatusBadge = ({
  status,
  customLabel,
  className,
}: StatusBadgeProps) => {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5',
        'font-ui text-xs font-semibold',
        'transition-colors',
        config.className,
        className
      )}
    >
      {customLabel || config.label}
    </span>
  )
}
