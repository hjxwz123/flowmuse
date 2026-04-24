import { Module } from '@nestjs/common';

import { ChatFileParserService } from '../chat/chat-file-parser.service';
import { MembershipsModule } from '../memberships/memberships.module';
import { PromptOptimizeModule } from '../prompt-optimize/prompt-optimize.module';
import { SettingsModule } from '../settings/settings.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [PromptOptimizeModule, MembershipsModule, SettingsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ChatFileParserService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
