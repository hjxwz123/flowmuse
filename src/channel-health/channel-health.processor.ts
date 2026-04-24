import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { CHANNEL_HEALTH_CHECK_QUEUE } from '../queues/queue-names';
import { ChannelHealthService } from './channel-health.service';

@Processor(CHANNEL_HEALTH_CHECK_QUEUE)
export class ChannelHealthProcessor extends WorkerHost {
  constructor(private readonly service: ChannelHealthService) {
    super();
  }

  async process(job: Job<{ channelId: string }>) {
    if (job.name !== 'check') return;
    const channelId = BigInt(job.data.channelId);
    await this.service.check(channelId);
  }
}
