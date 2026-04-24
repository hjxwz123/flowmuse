import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { GalleryQueryDto } from './dto/gallery-query.dto';
import { GalleryService } from './gallery.service';

@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my/images')
  myImages(@CurrentUser('id') userId: bigint, @Query() pagination: PaginationDto) {
    return this.galleryService.myImages(userId, pagination);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my/videos')
  myVideos(@CurrentUser('id') userId: bigint, @Query() pagination: PaginationDto) {
    return this.galleryService.myVideos(userId, pagination);
  }

  @Get('public/images')
  publicImages(@Query() query: GalleryQueryDto) {
    return this.galleryService.publicImages(query, query.q);
  }

  @Get('public/feed')
  publicFeed(@Query() query: GalleryQueryDto) {
    return this.galleryService.publicFeed(query, query.q);
  }

  @Get('public/videos')
  publicVideos(@Query() query: GalleryQueryDto) {
    return this.galleryService.publicVideos(query, query.q);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':type/:id/like')
  like(@CurrentUser('id') userId: bigint, @Param('type') type: 'image' | 'video', @Param('id') id: string) {
    return this.galleryService.like(userId, type, BigInt(id));
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':type/:id/like')
  unlike(@CurrentUser('id') userId: bigint, @Param('type') type: 'image' | 'video', @Param('id') id: string) {
    return this.galleryService.unlike(userId, type, BigInt(id));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':type/:id/favorite')
  favorite(@CurrentUser('id') userId: bigint, @Param('type') type: 'image' | 'video', @Param('id') id: string) {
    return this.galleryService.favorite(userId, type, BigInt(id));
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':type/:id/favorite')
  unfavorite(@CurrentUser('id') userId: bigint, @Param('type') type: 'image' | 'video', @Param('id') id: string) {
    return this.galleryService.unfavorite(userId, type, BigInt(id));
  }

  @UseGuards(JwtAuthGuard)
  @Get('my/favorites')
  myFavorites(@CurrentUser('id') userId: bigint, @Query() pagination: PaginationDto) {
    return this.galleryService.myFavorites(userId, pagination);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.galleryService.search(q);
  }

  // 详情：管理员可查看未公开作品
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':type/:id')
  detail(
    @CurrentUser('id') userId: bigint | null,
    @CurrentUser('role') userRole: string | null,
    @Param('type') type: 'image' | 'video',
    @Param('id') id: string,
  ) {
    return this.galleryService.detail(type, BigInt(id), userId, userRole === 'admin');
  }

  // ─── 评论 ───────────────────────────────────────────────────────────────────

  @Get(':type/:id/comments')
  getComments(
    @Param('type') type: 'image' | 'video',
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.galleryService.getComments(type, BigInt(id), pagination);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':type/:id/comments')
  createComment(
    @CurrentUser('id') userId: bigint,
    @Param('type') type: 'image' | 'video',
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.galleryService.createComment(userId, type, BigInt(id), content);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':type/:id/comments/:commentId')
  deleteComment(
    @CurrentUser('id') userId: bigint,
    @CurrentUser('role') userRole: string,
    @Param('commentId') commentId: string,
  ) {
    return this.galleryService.deleteComment(userId, BigInt(commentId), userRole === 'admin');
  }
}
