import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { EMAIL_QUEUE } from '../queues/queue-names';
import { EmailService, SendEmailParams } from './email.service';

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  constructor(private readonly email: EmailService) {
    super();
  }

  async process(job: Job<SendEmailParams>) {
    if (job.name !== 'send') return;
    await this.email.send(job.data);
  }
}
