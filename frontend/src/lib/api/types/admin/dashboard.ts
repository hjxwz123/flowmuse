/**
 * 管理员 - 统计仪表板类型定义
 */

// 概览统计
export interface OverviewStats {
  totalUsers: number
  activeUsers: number
  totalTasks: number
  completedTasks: number
  totalCreditsIssued: number
  totalCreditsUsed: number
  totalRevenue: number
  todayRevenue: number
}

// 用户增长数据点
export interface UserGrowthDataPoint {
  date: string
  count: number
}

// 任务趋势数据点
export interface TaskTrendDataPoint {
  date: string
  completed: number
  failed: number
}

// 模型使用数据
export interface ModelUsageData {
  modelName: string
  count: number
  percentage: number
  [key: string]: string | number // Index signature for Recharts compatibility
}

// 收入趋势数据点
export interface RevenueTrendDataPoint {
  date: string
  amount: number
}

// 点数消耗数据点
export interface CreditsConsumptionDataPoint {
  date: string
  issued: number
  used: number
  amount?: number
}

// 仪表板数据
export interface DashboardData {
  overview: OverviewStats
  userGrowth: UserGrowthDataPoint[] // 最近30天
  taskTrend: TaskTrendDataPoint[] // 最近30天
  modelUsage: ModelUsageData[] // Top 10
  revenueTrend: RevenueTrendDataPoint[] // 最近30天
  creditsConsumption: CreditsConsumptionDataPoint[] // 最近30天
}

// 时间范围
export type TimeRange = '7d' | '30d' | '90d' | '1y'

// 仪表板筛选参数
export interface DashboardFilterParams {
  range?: TimeRange
}
