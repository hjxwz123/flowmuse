import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminGalleryService } from './admin-gallery.service';
import { ModerateGalleryDto } from './dto/moderate-gallery.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/gallery')
export class AdminGalleryController {
  constructor(private readonly galleryService: AdminGalleryService) {}

  @Get('images')
  images(
    @Query('username') username?: string,
    @Query('isPublic') isPublic?: string,
    @Query('moderationStatus') moderationStatus?: string,
  ) {
    return this.galleryService.images({ username, isPublic, moderationStatus });
  }

  @Get('videos')
  videos(
    @Query('username') username?: string,
    @Query('isPublic') isPublic?: string,
    @Query('moderationStatus') moderationStatus?: string,
  ) {
    return this.galleryService.videos({ username, isPublic, moderationStatus });
  }

  @Put(':type/:id/moderate')
  moderate(
    @Param('type') type: 'image' | 'video',
    @Param('id') id: string,
    @CurrentUser('email') adminEmail: string,
    @Body() dto: ModerateGalleryDto,
  ) {
    return this.galleryService.moderate(type, BigInt(id), adminEmail, dto);
  }

  @Put(':type/:id/hide')
  hide(
    @Param('type') type: 'image' | 'video',
    @Param('id') id: string,
    @CurrentUser('email') adminEmail: string,
    @Body() dto: ModerateGalleryDto = new ModerateGalleryDto(),
  ) {
    return this.galleryService.hide(type, BigInt(id), adminEmail, dto);
  }

  @Delete(':type/:id')
  remove(
    @Param('type') type: 'image' | 'video',
    @Param('id') id: string,
    @Body() dto: ModerateGalleryDto = new ModerateGalleryDto(),
  ) {
    return this.galleryService.remove(type, BigInt(id), dto);
  }
}
