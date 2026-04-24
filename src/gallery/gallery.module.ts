import { Module } from '@nestjs/common';

import { InboxModule } from '../inbox/inbox.module';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';

@Module({
  imports: [InboxModule],
  controllers: [GalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
