import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GalleryTargetType, ImageTask, Prisma, VideoTask } from '@prisma/client';

import { InboxService } from '../inbox/inbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializeGalleryImage, serializeGalleryVideo, serializeGalleryImageDetail, serializeGalleryVideoDetail } from '../common/serializers/gallery.serializer';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { SlicePaginatedResult } from '../common/dto/slice-pagination.dto';
import { RedisService } from '../redis/redis.service';

type PublicFeedRow = {
  type: 'image' | 'video';
  id: bigint | number | string;
  createdAt: Date;
};

const PUBLIC_FEED_CACHE_TTL_SECONDS = 30;

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
    private readonly redis: RedisService,
  ) {}

  private normalizeActorName(actor: { username: string | null; email: string } | null) {
    if (!actor) return '有人';
    return actor.username?.trim() || actor.email.split('@')[0] || '有人';
  }

  private previewPrompt(prompt: string | null | undefined) {
    const text = (prompt ?? '').trim();
    if (!text) return '未命名作品';
    return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  }

  private buildPublicFeedCacheKey(page: number, limit: number) {
    return `gallery:public-feed:v1:${page}:${limit}`;
  }

  private async queryPublicFeed(
    pagination: PaginationDto,
    q?: string,
  ): Promise<SlicePaginatedResult<any>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const offset = (page - 1) * limit;
    const take = limit + 1;
    const keyword = typeof q === 'string' ? q.trim() : '';
    const imagePromptClause = keyword
      ? Prisma.sql`AND image_tasks.prompt LIKE ${`%${keyword}%`}`
      : Prisma.empty;
    const videoPromptClause = keyword
      ? Prisma.sql`AND video_tasks.prompt LIKE ${`%${keyword}%`}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<PublicFeedRow[]>(Prisma.sql`
      SELECT type, id, createdAt
      FROM (
        SELECT
          'image' AS type,
          image_tasks.id AS id,
          image_tasks.created_at AS createdAt
        FROM image_tasks
        WHERE image_tasks.is_public = true
          AND image_tasks.status = 'completed'
          AND image_tasks.deleted_at IS NULL
          ${imagePromptClause}

        UNION ALL

        SELECT
          'video' AS type,
          video_tasks.id AS id,
          video_tasks.created_at AS createdAt
        FROM video_tasks
        WHERE video_tasks.is_public = true
          AND video_tasks.status = 'completed'
          ${videoPromptClause}
      ) AS public_feed_rows
      ORDER BY createdAt DESC, id DESC
      LIMIT ${take}
      OFFSET ${offset}
    `);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    if (pageRows.length === 0) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          hasMore: false,
        },
      };
    }

    const imageIds = pageRows
      .filter((row) => row.type === 'image')
      .map((row) => BigInt(row.id));
    const videoIds = pageRows
      .filter((row) => row.type === 'video')
      .map((row) => BigInt(row.id));

    const [images, videos] = await Promise.all([
      imageIds.length > 0
        ? this.prisma.imageTask.findMany({
            where: { id: { in: imageIds }, isPublic: true, status: 'completed', deletedAt: null },
          })
        : Promise.resolve([]),
      videoIds.length > 0
        ? this.prisma.videoTask.findMany({
            where: { id: { in: videoIds }, isPublic: true, status: 'completed' },
          })
        : Promise.resolve([]),
    ]);

    const imageMap = new Map(images.map((item) => [item.id.toString(), serializeGalleryImage(item)]));
    const videoMap = new Map(videos.map((item) => [item.id.toString(), serializeGalleryVideo(item)]));

    const data = pageRows
      .map((row) => {
        const key = BigInt(row.id).toString();
        return row.type === 'image' ? imageMap.get(key) ?? null : videoMap.get(key) ?? null;
      })
      .filter((item) => item !== null);

    return {
      data,
      pagination: {
        page,
        limit,
        hasMore,
      },
    };
  }

  private async notifyAuthorInteraction(input: {
    action: 'like' | 'favorite';
    actorId: bigint;
    type: 'image' | 'video';
    targetId: bigint;
  }) {
    const [actor, target] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: input.actorId },
        select: { username: true, email: true },
      }),
      input.type === 'image'
        ? this.prisma.imageTask.findUnique({
            where: { id: input.targetId },
            select: { id: true, userId: true, prompt: true, thumbnailUrl: true, deletedAt: true },
          })
        : this.prisma.videoTask.findUnique({
            where: { id: input.targetId },
            select: { id: true, userId: true, prompt: true, thumbnailUrl: true },
          }),
    ]);
    if (!target) return;
    if ('deletedAt' in target && target.deletedAt) return;
    if (target.userId === input.actorId) return;

    const actorName = this.normalizeActorName(actor);
    const actionLabel = input.action === 'like' ? '点赞' : '收藏';
    await this.inbox.sendSystemMessage({
      userId: target.userId,
      type: input.action === 'like' ? 'work_liked' : 'work_favorited',
      level: 'info',
      title: `${actorName}${actionLabel}了你的作品`,
      content: `作品《${this.previewPrompt(target.prompt)}》收到新的${actionLabel}。`,
      relatedType: input.type,
      relatedId: input.targetId,
      meta: {
        action: input.action,
        actorId: input.actorId.toString(),
        actorName,
        thumbnailUrl: target.thumbnailUrl ?? null,
      } satisfies Prisma.JsonObject,
    });
  }

  async myImages(userId: bigint, pagination: PaginationDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const where = { userId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.imageTask.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.imageTask.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return { data: items.map(serializeGalleryImage), pagination: { page, limit, total, totalPages, hasMore: page < totalPages } };
  }

  async myVideos(userId: bigint, pagination: PaginationDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.videoTask.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.videoTask.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return { data: items.map(serializeGalleryVideo), pagination: { page, limit, total, totalPages, hasMore: page < totalPages } };
  }

  async publicImages(pagination: PaginationDto, q?: string): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const where: Prisma.ImageTaskWhereInput = { isPublic: true, status: 'completed', deletedAt: null };
    if (q) where.prompt = { contains: q };
    const [items, total] = await Promise.all([
      this.prisma.imageTask.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.imageTask.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return { data: items.map(serializeGalleryImage), pagination: { page, limit, total, totalPages, hasMore: page < totalPages } };
  }

  async publicVideos(pagination: PaginationDto, q?: string): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const where: Prisma.VideoTaskWhereInput = { isPublic: true, status: 'completed' };
    if (q) where.prompt = { contains: q };
    const [items, total] = await Promise.all([
      this.prisma.videoTask.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.videoTask.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return { data: items.map(serializeGalleryVideo), pagination: { page, limit, total, totalPages, hasMore: page < totalPages } };
  }

  async publicFeed(pagination: PaginationDto, q?: string): Promise<SlicePaginatedResult<any>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const keyword = typeof q === 'string' ? q.trim() : '';
    const shouldCache = page === 1 && !keyword;

    if (!shouldCache) {
      return this.queryPublicFeed(pagination, keyword);
    }

    const cacheKey = this.buildPublicFeedCacheKey(page, limit);

    try {
      const cached = await this.redis.getJson<SlicePaginatedResult<any>>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    } catch {
      // Cache read failures should never block gallery reads.
    }

    const fresh = await this.queryPublicFeed(pagination, keyword);

    try {
      await this.redis.setJson(cacheKey, fresh, PUBLIC_FEED_CACHE_TTL_SECONDS);
    } catch {
      // Cache write failures are non-fatal.
    }

    return fresh;
  }

  async detail(type: 'image' | 'video', id: bigint, userId?: bigint | null, isAdmin = false) {
    const targetType = type === 'image' ? GalleryTargetType.image : GalleryTargetType.video;

    const userInclude = { select: { id: true, username: true, email: true, avatar: true } };
    const modelInclude = { select: { name: true } };

    const [likeCount, favoriteCount] = await this.prisma.$transaction([
      this.prisma.galleryLike.count({ where: { targetType, targetId: id } }),
      this.prisma.galleryFavorite.count({ where: { targetType, targetId: id } }),
    ]);

    if (type === 'image') {
      const item = await this.prisma.imageTask.findUnique({
        where: { id },
        include: { user: userInclude, model: modelInclude },
      });
      if (!item) throw new NotFoundException('Item not found');
      if (item.deletedAt && !isAdmin) throw new NotFoundException('Item not found');

      const isOwner = userId && item.userId === userId;
      if (!item.isPublic && !isOwner && !isAdmin) {
        throw new NotFoundException('Item not found');
      }

      return {
        item: serializeGalleryImageDetail(item as unknown as ImageTask, item.user, item.model?.name ?? null),
        likeCount,
        favoriteCount,
      };
    }

    const item = await this.prisma.videoTask.findUnique({
      where: { id },
      include: { user: userInclude, model: modelInclude },
    });
    if (!item) throw new NotFoundException('Item not found');

    const isOwner = userId && item.userId === userId;
    if (!item.isPublic && !isOwner && !isAdmin) {
      throw new NotFoundException('Item not found');
    }

    return {
      item: serializeGalleryVideoDetail(item as unknown as VideoTask, item.user, item.model?.name ?? null),
      likeCount,
      favoriteCount,
    };
  }

  private assertType(type: 'image' | 'video') {
    if (type !== 'image' && type !== 'video') throw new BadRequestException('Invalid type');
    return type;
  }

  // ─── 点赞 / 收藏 ───────────────────────────────────────────────────────────

  async like(userId: bigint, type: 'image' | 'video', id: bigint) {
    this.assertType(type);
    const targetType = type === 'image' ? GalleryTargetType.image : GalleryTargetType.video;
    try {
      await this.prisma.galleryLike.create({ data: { userId, targetType, targetId: id } });
      await this.notifyAuthorInteraction({ action: 'like', actorId: userId, type, targetId: id });
    } catch {
      // Ignore duplicate likes and notification side-effects.
    }
    return { ok: true };
  }

  async unlike(userId: bigint, type: 'image' | 'video', id: bigint) {
    this.assertType(type);
    const targetType = type === 'image' ? GalleryTargetType.image : GalleryTargetType.video;
    await this.prisma.galleryLike.deleteMany({ where: { userId, targetType, targetId: id } });
    return { ok: true };
  }

  async favorite(userId: bigint, type: 'image' | 'video', id: bigint) {
    this.assertType(type);
    const targetType = type === 'image' ? GalleryTargetType.image : GalleryTargetType.video;
    try {
      await this.prisma.galleryFavorite.create({ data: { userId, targetType, targetId: id } });
      await this.notifyAuthorInteraction({ action: 'favorite', actorId: userId, type, targetId: id });
    } catch {
      // Ignore duplicate favorites and notification side-effects.
    }
    return { ok: true };
  }

  async unfavorite(userId: bigint, type: 'image' | 'video', id: bigint) {
    this.assertType(type);
    const targetType = type === 'image' ? GalleryTargetType.image : GalleryTargetType.video;
    await this.prisma.galleryFavorite.deleteMany({ where: { userId, targetType, targetId: id } });
    return { ok: true };
  }

  async myFavorites(userId: bigint, pagination: PaginationDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const where = { userId };
    const [favorites, total] = await Promise.all([
      this.prisma.galleryFavorite.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.galleryFavorite.count({ where }),
    ]);
    const imageIds = favorites.filter((f) => f.targetType === GalleryTargetType.image).map((f) => f.targetId);
    const videoIds = favorites.filter((f) => f.targetType === GalleryTargetType.video).map((f) => f.targetId);
    const [images, videos] = await this.prisma.$transaction([
      this.prisma.imageTask.findMany({ where: { id: { in: imageIds }, deletedAt: null } }),
      this.prisma.videoTask.findMany({ where: { id: { in: videoIds } } }),
    ]);
    const imageMap = new Map(images.map((t) => [t.id.toString(), t]));
    const videoMap = new Map(videos.map((t) => [t.id.toString(), t]));
    const data = favorites
      .map((f) => ({
        targetType: f.targetType,
        targetId: f.targetId,
        createdAt: f.createdAt,
        item:
          f.targetType === GalleryTargetType.image
            ? (imageMap.get(f.targetId.toString()) ? serializeGalleryImage(imageMap.get(f.targetId.toString())!) : null)
            : (videoMap.get(f.targetId.toString()) ? serializeGalleryVideo(videoMap.get(f.targetId.toString())!) : null),
      }))
      .filter((item) => item.item !== null);
    const totalPages = Math.ceil(total / limit);
    return { data, pagination: { page, limit, total, totalPages, hasMore: page < totalPages } };
  }

  async search(q: string) {
    if (!q || q.trim().length === 0) throw new BadRequestException('Missing q');
    const query = q.trim();
    const [images, videos] = await this.prisma.$transaction([
      this.prisma.imageTask.findMany({
        where: { isPublic: true, status: 'completed', deletedAt: null, prompt: { contains: query } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.videoTask.findMany({ where: { isPublic: true, status: 'completed', prompt: { contains: query } }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return { images: images.map(serializeGalleryImage), videos: videos.map(serializeGalleryVideo) };
  }

  // ─── 评论 ──────────────────────────────────────────────────────────────────

  async getComments(type: 'image' | 'video', id: bigint, pagination: PaginationDto) {
    this.assertType(type);
    const targetType = type === 'image' ? GalleryTargetType.image : GalleryTargetType.video;
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;
    const where = { targetType, targetId: id };
    const [comments, total] = await Promise.all([
      this.prisma.galleryComment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, username: true, email: true, avatar: true } } },
      }),
      this.prisma.galleryComment.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return {
      data: comments.map((c) => ({
        id: c.id.toString(),
        userId: c.userId.toString(),
        username: c.user.username,
        email: c.user.email,
        avatar: c.user.avatar,
        content: c.content,
        createdAt: c.createdAt,
      })),
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    };
  }

  async createComment(userId: bigint, type: 'image' | 'video', id: bigint, content: string) {
    this.assertType(type);
    if (!content || content.trim().length === 0) throw new BadRequestException('Comment content is required');
    if (content.trim().length > 500) throw new BadRequestException('Comment too long (max 500 chars)');

    const targetType = type === 'image' ? GalleryTargetType.image : GalleryTargetType.video;

    // Verify the item exists and is public (or owned by user)
    const item =
      type === 'image'
        ? await this.prisma.imageTask.findUnique({
            where: { id },
            select: { isPublic: true, userId: true, prompt: true, deletedAt: true },
          })
        : await this.prisma.videoTask.findUnique({ where: { id }, select: { isPublic: true, userId: true, prompt: true } });

    if (!item) throw new NotFoundException('Item not found');
    if ('deletedAt' in item && item.deletedAt) throw new NotFoundException('Item not found');
    if (!item.isPublic && item.userId !== userId) throw new ForbiddenException('Cannot comment on private item');

    const comment = await this.prisma.galleryComment.create({
      data: { userId, targetType, targetId: id, content: content.trim() },
      include: { user: { select: { id: true, username: true, email: true, avatar: true } } },
    });

    if (item.userId !== userId) {
      const actorName = this.normalizeActorName(comment.user);
      await this.inbox.sendSystemMessage({
        userId: item.userId,
        type: 'work_commented',
        level: 'info',
        title: `${actorName}评论了你的作品`,
        content: `作品《${this.previewPrompt(item.prompt)}》收到新评论：${comment.content}`,
        relatedType: type,
        relatedId: id,
        dedupKey: `comment:${comment.id.toString()}`,
        meta: {
          action: 'comment',
          actorId: userId.toString(),
          actorName,
          commentId: comment.id.toString(),
          comment: comment.content,
        } satisfies Prisma.JsonObject,
      });
    }

    return {
      id: comment.id.toString(),
      userId: comment.userId.toString(),
      username: comment.user.username,
      email: comment.user.email,
      avatar: comment.user.avatar,
      content: comment.content,
      createdAt: comment.createdAt,
    };
  }

  async deleteComment(userId: bigint, commentId: bigint, isAdmin = false) {
    const comment = await this.prisma.galleryComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (!isAdmin && comment.userId !== userId) throw new ForbiddenException('Cannot delete this comment');
    await this.prisma.galleryComment.delete({ where: { id: commentId } });
    return { ok: true };
  }
}
