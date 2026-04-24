import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

import {
  // CHANNEL_HEALTH_CHECK_QUEUE, // 已禁用
  EMAIL_QUEUE,
  IMAGE_GENERATION_QUEUE,
  OSS_UPLOAD_QUEUE,
  RESEARCH_QUEUE,
  THUMBNAIL_QUEUE,
  VIDEO_GENERATION_QUEUE,
} from './queue-names';
import { resolveRedisConnection } from '../redis/redis-connection.util';
import { UpstreamThrottleService } from './upstream-throttle.service';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: resolveRedisConnection(config),
        defaultJobOptions: {
          attempts: 3,
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: IMAGE_GENERATION_QUEUE },
      { name: VIDEO_GENERATION_QUEUE },
      { name: RESEARCH_QUEUE },
      { name: EMAIL_QUEUE },
      { name: OSS_UPLOAD_QUEUE },
      { name: THUMBNAIL_QUEUE },
      // { name: CHANNEL_HEALTH_CHECK_QUEUE }, // 已禁用
    ),
  ],
  providers: [UpstreamThrottleService],
  exports: [BullModule, UpstreamThrottleService],
})
export class QueuesModule {}
