import { Module } from '@nestjs/common';

import { CreditsModule } from '../credits/credits.module';
import { InboxModule } from '../inbox/inbox.module';
import { ProjectsModule } from '../projects/projects.module';
import { MidjourneyWebhookController } from './midjourney-webhook.controller';

@Module({
  imports: [CreditsModule, InboxModule, ProjectsModule],
  controllers: [MidjourneyWebhookController],
})
export class WebhooksModule {}
