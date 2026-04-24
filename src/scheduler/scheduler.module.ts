import { Module } from '@nestjs/common';

import { MembershipsModule } from '../memberships/memberships.module';
import { MetricsModule } from '../metrics/metrics.module';
import { QueuesModule } from '../queues/queues.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [QueuesModule, MembershipsModule, MetricsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
