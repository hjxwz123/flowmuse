import { Module } from '@nestjs/common';

import { AuthUserCacheModule } from '../auth/auth-user-cache.module';
import { ImagesModule } from '../images/images.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { ModerationModule } from '../moderation/moderation.module';
import { SettingsModule } from '../settings/settings.module';
import { VideosModule } from '../videos/videos.module';
import { ChatController } from './chat.controller';
import { ChatFileParserService } from './chat-file-parser.service';
import { ChatService } from './chat.service';
import { AutoProjectWorkflowService } from './auto-project-workflow.service';
import { WebSearchService } from './web-search.service';

@Module({
  imports: [SettingsModule, ImagesModule, VideosModule, ModerationModule, MembershipsModule, AuthUserCacheModule],
  controllers: [ChatController],
  providers: [ChatService, ChatFileParserService, WebSearchService, AutoProjectWorkflowService],
})
export class ChatModule {}
