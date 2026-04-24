/**
 * Dashboard response DTOs matching frontend types
 */

export interface OverviewStats {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
  completedTasks: number;
  totalCreditsIssued: number;
  totalCreditsUsed: number;
  totalRevenue: number;
  todayRevenue: number;
}

export interface UserGrowthDataPoint {
  date: string;
  count: number;
}

export interface TaskTrendDataPoint {
  date: string;
  completed: number;
  failed: number;
}

export interface ModelUsageData {
  modelName: string;
  count: number;
  percentage: number;
}

export interface RevenueTrendDataPoint {
  date: string;
  amount: number;
}

export interface CreditsConsumptionDataPoint {
  date: string;
  issued: number;
  used: number;
}

export interface DashboardDataDto {
  overview: OverviewStats;
  userGrowth: UserGrowthDataPoint[];
  taskTrend: TaskTrendDataPoint[];
  modelUsage: ModelUsageData[];
  revenueTrend: RevenueTrendDataPoint[];
  creditsConsumption: CreditsConsumptionDataPoint[];
}
