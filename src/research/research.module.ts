import { Module } from '@nestjs/common';

import { CreditsModule } from '../credits/credits.module';
import { InboxModule } from '../inbox/inbox.module';
import { SettingsModule } from '../settings/settings.module';
import { WebSearchService } from '../chat/web-search.service';
import { ResearchController } from './research.controller';
import { ResearchProcessor } from './research.processor';
import { ResearchService } from './research.service';

@Module({
  imports: [CreditsModule, InboxModule, SettingsModule],
  controllers: [ResearchController],
  providers: [ResearchService, ResearchProcessor, WebSearchService],
  exports: [ResearchService],
})
export class ResearchModule {}
