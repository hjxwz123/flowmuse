import { Module } from '@nestjs/common';

import { DashboardMetricsService } from './dashboard-metrics.service';

@Module({
  providers: [DashboardMetricsService],
  exports: [DashboardMetricsService],
})
export class MetricsModule {}
