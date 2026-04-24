import { Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';
import { SiteController } from './site.controller';

@Module({
  imports: [SettingsModule],
  controllers: [SiteController],
})
export class SiteModule {}

