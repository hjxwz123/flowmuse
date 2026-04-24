/**
 * 管理员仪表板页面
 * 显示核心统计数据和图表
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { FadeIn } from '@/components/shared/FadeIn'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { AdminPageLoading } from '@/components/admin/layout/AdminPageLoading'
import { StatsCard } from '@/components/admin/dashboard/StatsCard'
import { adminDashboardService } from '@/lib/api/services/admin/dashboard'
import { useSiteStore } from '@/lib/store'
import type { DashboardData, ModelUsageData } from '@/lib/api/types/admin/dashboard'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type LooseRecord = Record<string, unknown>

function toSafeNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function toDateLabel(value: unknown, fallback: string) {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim()
  if (!normalized) {
    return fallback
  }

  return normalized.length >= 10 ? normalized.slice(0, 10) : normalized
}

function toObjectArray(value: unknown): LooseRecord[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is LooseRecord => typeof item === 'object' && item !== null)
}

function toObjectRecord(value: unknown): LooseRecord {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  return value as LooseRecord
}

function normalizeDashboardData(data: DashboardData): DashboardData {
  const overview = toObjectRecord(data.overview)
  const revenueTrend = toObjectArray(data.revenueTrend).map((item, index) => {
    const revenueFen = item.revenueFen
    const amount =
      revenueFen !== undefined
        ? toSafeNumber(revenueFen) / 100
        : toSafeNumber(item.amount ?? item.revenue ?? item.total ?? item.value ?? item.totalRevenue)

    return {
      date: toDateLabel(item.date ?? item.metricDate, `day-${index + 1}`),
      amount,
    }
  })

  const creditsConsumption = toObjectArray(data.creditsConsumption).map((item, index) => ({
    date: toDateLabel(item.date ?? item.metricDate, `day-${index + 1}`),
    issued: toSafeNumber(item.issued ?? item.granted ?? item.inbound ?? item.creditsIssued),
    used: toSafeNumber(item.used ?? item.amount ?? item.outbound ?? item.creditsUsed),
  }))

  const modelUsage = toObjectArray(data.modelUsage).map((item) => ({
    modelName:
      typeof item.modelName === 'string' && item.modelName.trim()
        ? item.modelName
        : typeof item.name === 'string' && item.name.trim()
          ? item.name
          : 'Unknown Model',
    count: toSafeNumber(item.count ?? item.value),
    percentage: toSafeNumber(item.percentage),
  }))

  return {
    overview: {
      totalUsers: toSafeNumber(overview.totalUsers),
      activeUsers: toSafeNumber(overview.activeUsers),
      totalTasks: toSafeNumber(overview.totalTasks),
      completedTasks: toSafeNumber(overview.completedTasks),
      totalCreditsIssued: toSafeNumber(overview.totalCreditsIssued),
      totalCreditsUsed: toSafeNumber(overview.totalCreditsUsed),
      totalRevenue: toSafeNumber(overview.totalRevenue),
      todayRevenue: toSafeNumber(overview.todayRevenue),
    },
    userGrowth: toObjectArray(data.userGrowth).map((item, index) => ({
      date: toDateLabel(item.date ?? item.metricDate, `day-${index + 1}`),
      count: toSafeNumber(item.count ?? item.total ?? item.value ?? item.newUsers),
    })),
    taskTrend: toObjectArray(data.taskTrend).map((item, index) => ({
      date: toDateLabel(item.date ?? item.metricDate, `day-${index + 1}`),
      completed: toSafeNumber(
        item.completed ??
          item.completedCount ??
          item.success ??
          (toSafeNumber(item.imageCompleted) +
            toSafeNumber(item.videoCompleted) +
            toSafeNumber(item.researchCompleted))
      ),
      failed: toSafeNumber(
        item.failed ??
          item.failedCount ??
          item.error ??
          (toSafeNumber(item.imageFailed) +
            toSafeNumber(item.videoFailed) +
            toSafeNumber(item.researchFailed))
      ),
    })),
    modelUsage,
    revenueTrend,
    creditsConsumption,
  }
}

export default function AdminDashboardPage() {
  const t = useTranslations('admin.dashboard')
  const siteTitle = useSiteStore((state) => state.settings?.siteTitle?.trim() || 'AI 创作平台')

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // Fetch dashboard data
  useEffect(() => {
    let cancelled = false

    const loadDashboardData = async () => {
      setLoading(true)
      setError(null)

      try {
        const dashboardData = await adminDashboardService.getDashboardData({
          range: '30d',
        })

        if (cancelled) return
        setData(dashboardData)
      } catch (error) {
        if (cancelled) return
        console.error('Failed to fetch dashboard data:', error)
        setData(null)
        setError(
          error instanceof Error && error.message
            ? error.message
            : '仪表板数据加载失败，请稍后重试'
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDashboardData()

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  if (loading) {
    return <AdminPageLoading text="加载仪表板数据中..." />
  }

  if (error || !data) {
    return (
      <AdminPageShell
        title={t('title')}
        description={`欢迎来到 ${siteTitle} 管理后台`}
      >
        <FadeIn variant="fade" delay={0.05}>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <h2 className="font-ui text-lg font-semibold text-rose-900">
              仪表板加载失败
            </h2>
            <p className="mt-2 text-sm text-rose-700">
              {error || '暂时无法获取仪表板数据。'}
            </p>
            <button
              type="button"
              onClick={() => {
                setReloadToken((current) => current + 1)
              }}
              className="mt-4 inline-flex items-center rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
            >
              重试
            </button>
          </div>
        </FadeIn>
      </AdminPageShell>
    )
  }

  const dashboardData = normalizeDashboardData(data)

  // Colors for charts
  const COLORS = [
    '#FF6B9D',
    '#C084FC',
    '#60A5FA',
    '#34D399',
    '#FBBF24',
    '#F87171',
    '#A78BFA',
    '#2DD4BF',
    '#FB923C',
    '#EC4899',
  ]

  return (
    <AdminPageShell
      title={t('title')}
      description={`欢迎来到 ${siteTitle} 管理后台`}
      contentClassName="space-y-8"
    >
      {/* Overview Stats */}
      <FadeIn variant="fade" delay={0.05}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="总用户数"
              value={dashboardData.overview.totalUsers}
              icon={
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              }
              className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200"
              valueClassName="text-blue-900"
            />

            <StatsCard
              title="活跃用户"
              value={dashboardData.overview.activeUsers}
              icon={
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              className="bg-gradient-to-br from-green-50 to-green-100 border-green-200"
              valueClassName="text-green-900"
            />

            <StatsCard
              title="总任务数"
              value={dashboardData.overview.totalTasks}
              icon={
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              }
              className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200"
              valueClassName="text-purple-900"
            />

            <StatsCard
              title="今日收入"
              value={`¥${dashboardData.overview.todayRevenue.toLocaleString()}`}
              icon={
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              className="bg-gradient-to-br from-aurora-pink/20 to-aurora-purple/20 border-aurora-purple/30"
              valueClassName="text-aurora-purple"
            />
          </div>
      </FadeIn>

      {/* Charts Row 1 */}
      <FadeIn variant="fade" delay={0.1}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Growth Chart */}
            <div className="rounded-xl bg-white p-6 border border-stone-200 shadow-sm">
              <h3 className="font-ui text-lg font-semibold text-stone-900 mb-4">
                用户增长趋势
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dashboardData.userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis
                    dataKey="date"
                    stroke="#78716c"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#78716c" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e7e5e4',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="用户数"
                    stroke="#C084FC"
                    strokeWidth={2}
                    dot={{ fill: '#C084FC', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Task Trend Chart */}
            <div className="rounded-xl bg-white p-6 border border-stone-200 shadow-sm">
              <h3 className="font-ui text-lg font-semibold text-stone-900 mb-4">
                任务完成趋势
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboardData.taskTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis
                    dataKey="date"
                    stroke="#78716c"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#78716c" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e7e5e4',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="completed" name="完成" fill="#34D399" />
                  <Bar dataKey="failed" name="失败" fill="#F87171" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
      </FadeIn>

      {/* Charts Row 2 */}
      <FadeIn variant="fade" delay={0.2}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Model Usage Pie Chart */}
            <div className="rounded-xl bg-white p-6 border border-stone-200 shadow-sm">
              <h3 className="font-ui text-lg font-semibold text-stone-900 mb-4">
                模型使用分布
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dashboardData.modelUsage}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => {
                      const item = entry.payload as ModelUsageData
                      return `${item.modelName} (${item.percentage}%)`
                    }}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {dashboardData.modelUsage.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e7e5e4',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue Trend Chart */}
            <div className="rounded-xl bg-white p-6 border border-stone-200 shadow-sm">
              <h3 className="font-ui text-lg font-semibold text-stone-900 mb-4">
                收入趋势
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dashboardData.revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis
                    dataKey="date"
                    stroke="#78716c"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#78716c" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e7e5e4',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    name="收入金额(¥)"
                    stroke="#FF6B9D"
                    strokeWidth={2}
                    dot={{ fill: '#FF6B9D', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
      </FadeIn>

      {/* Credits Consumption Chart */}
      <FadeIn variant="fade" delay={0.3}>
          <div className="rounded-xl bg-white p-6 border border-stone-200 shadow-sm">
            <h3 className="font-ui text-lg font-semibold text-stone-900 mb-4">
              点数消耗趋势
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboardData.creditsConsumption}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis
                  dataKey="date"
                  stroke="#78716c"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#78716c" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e7e5e4',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="issued"
                  name="发放点数"
                  fill="#34D399"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="used"
                  name="消耗点数"
                  fill="#60A5FA"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
      </FadeIn>
    </AdminPageShell>
  )
}
