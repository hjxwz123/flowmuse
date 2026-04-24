import { Module } from '@nestjs/common';

import { AuthUserCacheModule } from '../auth/auth-user-cache.module';
import { SettingsModule } from '../settings/settings.module';
import { ModerationCounterService } from './moderation-counter.service';
import { PromptModerationService } from './prompt-moderation.service';

@Module({
  imports: [SettingsModule, AuthUserCacheModule],
  providers: [PromptModerationService, ModerationCounterService],
  exports: [PromptModerationService, ModerationCounterService],
})
export class ModerationModule {}
