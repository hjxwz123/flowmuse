import { Module } from '@nestjs/common';

import { CreditsModule } from '../credits/credits.module';
import { InboxModule } from '../inbox/inbox.module';
import { ProjectsModule } from '../projects/projects.module';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { VideoTaskProcessor } from './video-task.processor';

@Module({
  imports: [CreditsModule, InboxModule, ProjectsModule],
  controllers: [VideosController],
  providers: [VideosService, VideoTaskProcessor],
  exports: [VideosService],
})
export class VideosModule {}
