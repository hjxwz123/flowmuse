import { Module } from '@nestjs/common';

import { EncryptionModule } from '../encryption/encryption.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { WebSearchService } from '../chat/web-search.service';
import { OpenaiExternalController } from './openai-external.controller';
import { OpenaiDeepResearchService } from './openai-deep-research.service';

@Module({
  imports: [PrismaModule, EncryptionModule, SettingsModule],
  controllers: [OpenaiExternalController],
  providers: [OpenaiDeepResearchService, WebSearchService],
})
export class OpenaiExternalModule {}
