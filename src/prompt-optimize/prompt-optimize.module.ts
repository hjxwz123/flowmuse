import { Module } from '@nestjs/common';

import { CreditsModule } from '../credits/credits.module';
import { ModerationModule } from '../moderation/moderation.module';
import { SettingsModule } from '../settings/settings.module';
import { PromptOptimizeController } from './prompt-optimize.controller';
import { PromptOptimizeService } from './prompt-optimize.service';

@Module({
  imports: [SettingsModule, CreditsModule, ModerationModule],
  controllers: [PromptOptimizeController],
  providers: [PromptOptimizeService],
  exports: [PromptOptimizeService],
})
export class PromptOptimizeModule {}
