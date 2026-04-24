import { Module } from '@nestjs/common';

import { CreditsModule } from '../credits/credits.module';
import { InboxModule } from '../inbox/inbox.module';
import { ModerationModule } from '../moderation/moderation.module';
import { ProjectsModule } from '../projects/projects.module';
import { ImagesController } from './images.controller';
import { ImageTaskProcessor } from './image-task.processor';
import { ImagesService } from './images.service';

@Module({
  imports: [CreditsModule, InboxModule, ModerationModule, ProjectsModule],
  controllers: [ImagesController],
  providers: [ImagesService, ImageTaskProcessor],
  exports: [ImagesService],
})
export class ImagesModule {}
