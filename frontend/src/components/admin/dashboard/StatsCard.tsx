/**
 * 统计卡片组件
 */

import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
  valueClassName?: string
}

export function StatsCard({
  title,
  value,
  icon,
  trend,
  className,
  valueClassName,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-white p-6 border border-stone-200 shadow-sm',
        'transition-all duration-300 hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-ui text-sm text-stone-600">{title}</p>
          <p
            className={cn(
              'mt-2 font-display text-3xl font-bold text-stone-900',
              valueClassName
            )}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>

          {trend && (
            <div className="mt-2 flex items-center gap-1">
              {trend.isPositive ? (
                <svg
                  className="h-4 w-4 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                  />
                </svg>
              )}
              <span
                className={cn(
                  'font-ui text-sm font-medium',
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                )}
              >
                {trend.value > 0 ? '+' : ''}
                {trend.value}%
              </span>
            </div>
          )}
        </div>

        {icon && (
          <div className="ml-4 rounded-lg bg-gradient-to-br from-aurora-pink/10 via-aurora-purple/10 to-aurora-blue/10 p-3 text-aurora-purple">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
