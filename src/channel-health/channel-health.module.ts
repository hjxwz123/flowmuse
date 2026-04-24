import { Module } from '@nestjs/common';

import { QueuesModule } from '../queues/queues.module';
import { ChannelHealthProcessor } from './channel-health.processor';
import { ChannelHealthService } from './channel-health.service';

@Module({
  imports: [QueuesModule],
  providers: [ChannelHealthService, ChannelHealthProcessor],
})
export class ChannelHealthModule {}

