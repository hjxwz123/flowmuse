import { Module } from '@nestjs/common';

import { QueuesModule } from '../queues/queues.module';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';

@Module({
  imports: [QueuesModule],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}

