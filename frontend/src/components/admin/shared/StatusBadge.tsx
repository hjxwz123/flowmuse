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
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  inactive: {
    label: '未激活',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  banned: {
    label: '已禁用',
    className: 'bg-red-100 text-red-700 border-red-200',
  },

  // Task status
  pending: {
    label: '等待中',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  processing: {
    label: '处理中',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  completed: {
    label: '已完成',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  failed: {
    label: '失败',
    className: 'bg-red-100 text-red-700 border-red-200',
  },

  // General status
  enabled: {
    label: '已启用',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  disabled: {
    label: '已禁用',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },

  // Visibility
  public: {
    label: '公开',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  private: {
    label: '私密',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },

  // Redeem code status
  used: {
    label: '已使用',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  unused: {
    label: '未使用',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  expired: {
    label: '已过期',
    className: 'bg-red-100 text-red-700 border-red-200',
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
