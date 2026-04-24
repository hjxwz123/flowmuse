import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { SystemSettingsService } from './system-settings.service';
import { AiSettingsService } from './ai-settings.service';

@Module({
  imports: [PrismaModule],
  providers: [SystemSettingsService, AiSettingsService],
  exports: [SystemSettingsService, AiSettingsService],
})
export class SettingsModule {}

