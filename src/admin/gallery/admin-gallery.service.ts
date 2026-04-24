import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PublicModerationStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { serializeImageTask, serializeVideoTask, serializeImageTaskLite, serializeVideoTaskLite } from '../../common/serializers/task.serializer';
import { InboxService } from '../../inbox/inbox.service';
import { ModerateGalleryDto } from './dto/moderate-gallery.dto';

@Injectable()
export class AdminGalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
  ) {}

  private normalizePublicModerationStatus(input: {
    isPublic: boolean;
    publicModerationStatus: PublicModerationStatus;
  }) {
    if (
      input.publicModerationStatus === PublicModerationStatus.pending ||
      input.publicModerationStatus === PublicModerationStatus.approved ||
      input.publicModerationStatus === PublicModerationStatus.rejected
    ) {
      return input.publicModerationStatus;
    }
    return input.isPublic ? PublicModerationStatus.approved : PublicModerationStatus.private;
  }

  async images(query?: { username?: string; isPublic?: string; moderationStatus?: string }) {
    const userFilter = query?.username
      ? {
          user: {
            OR: [
              { username: { contains: query.username } },
              { email: { contains: query.username } },
            ],
          },
        }
      : {};

    let isPublicFilter: boolean | undefined = undefined;
    if (query?.isPublic === 'true') isPublicFilter = true;
    else if (query?.isPublic === 'false') isPublicFilter = false;

    const items = await this.prisma.imageTask.findMany({
      where: {
        ...(isPublicFilter !== undefined ? { isPublic: isPublicFilter } : {}),
        ...userFilter,
      },
      orderBy: [{ id: 'desc' }],
      take: 200,
      include: {
        user: { select: { id: true, email: true, username: true } },
      },
    });

    return items
      .map((item) => ({ ...serializeImageTaskLite(item), user: item.user }))
      .filter((item) => {
        if (!query?.moderationStatus) return true;
        return this.normalizePublicModerationStatus(item) === query.moderationStatus;
      });
  }

  async videos(query?: { username?: string; isPublic?: string; moderationStatus?: string }) {
    const userFilter = query?.username
      ? {
          user: {
            OR: [
              { username: { contains: query.username } },
              { email: { contains: query.username } },
            ],
          },
        }
      : {};

    let isPublicFilter: boolean | undefined = undefined;
    if (query?.isPublic === 'true') isPublicFilter = true;
    else if (query?.isPublic === 'false') isPublicFilter = false;

    const items = await this.prisma.videoTask.findMany({
      where: {
        ...(isPublicFilter !== undefined ? { isPublic: isPublicFilter } : {}),
        ...userFilter,
      },
      orderBy: [{ id: 'desc' }],
      take: 200,
      include: {
        user: { select: { id: true, email: true, username: true } },
      },
    });

    return items
      .map((item) => ({ ...serializeVideoTaskLite(item), user: item.user }))
      .filter((item) => {
        if (!query?.moderationStatus) return true;
        return this.normalizePublicModerationStatus(item) === query.moderationStatus;
      });
  }

  async moderate(type: 'image' | 'video', id: bigint, adminEmail: string, dto: ModerateGalleryDto) {
    if (dto.status !== 'approved' && dto.status !== 'rejected') {
      throw new BadRequestException('Invalid moderation status');
    }

    const note = dto.message?.trim() || null;
    const moderatedAt = new Date();
    const approved = dto.status === 'approved';
    const actionLabel = approved ? '审核通过' : '审核拒绝';

    if (type === 'video') {
      const task = await this.prisma.videoTask.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          taskNo: true,
          prompt: true,
          resultUrl: true,
          thumbnailUrl: true,
          status: true,
          publicRequestedAt: true,
        },
      });
      if (!task) throw new NotFoundException('Task not found');
      if (task.status !== 'completed') throw new BadRequestException('Task not completed');

      const updated = await this.prisma.videoTask.update({
        where: { id },
        data: {
          isPublic: approved,
          publicModerationStatus: approved ? PublicModerationStatus.approved : PublicModerationStatus.rejected,
          publicRequestedAt: task.publicRequestedAt ?? moderatedAt,
          publicModeratedAt: moderatedAt,
          publicModeratedBy: adminEmail,
          publicModerationNote: note,
        },
      });

      await this.inbox.sendSystemMessage({
        userId: task.userId,
        type: 'moderation',
        level: approved ? 'success' : 'error',
        title: dto.title?.trim() || `作品公开${actionLabel}`,
        content:
          note ||
          (approved
            ? `你的作品（${task.taskNo}）已通过公开审核，现在会显示在公开画廊中。`
            : `你的作品（${task.taskNo}）未通过公开审核，请调整后重新提交。`),
        relatedType: 'video',
        relatedId: task.id,
        meta: {
          action: approved ? 'approve_public' : 'reject_public',
          taskNo: task.taskNo,
          prompt: task.prompt,
          resultUrl: task.resultUrl ?? null,
          thumbnailUrl: task.thumbnailUrl ?? null,
          moderatedBy: adminEmail,
          note,
        },
      });

      return serializeVideoTask(updated);
    }

    if (type === 'image') {
      const task = await this.prisma.imageTask.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          taskNo: true,
          prompt: true,
          resultUrl: true,
          thumbnailUrl: true,
          status: true,
          publicRequestedAt: true,
        },
      });
      if (!task) throw new NotFoundException('Task not found');
      if (task.status !== 'completed') throw new BadRequestException('Task not completed');

      const updated = await this.prisma.imageTask.update({
        where: { id },
        data: {
          isPublic: approved,
          publicModerationStatus: approved ? PublicModerationStatus.approved : PublicModerationStatus.rejected,
          publicRequestedAt: task.publicRequestedAt ?? moderatedAt,
          publicModeratedAt: moderatedAt,
          publicModeratedBy: adminEmail,
          publicModerationNote: note,
        },
      });

      await this.inbox.sendSystemMessage({
        userId: task.userId,
        type: 'moderation',
        level: approved ? 'success' : 'error',
        title: dto.title?.trim() || `作品公开${actionLabel}`,
        content:
          note ||
          (approved
            ? `你的作品（${task.taskNo}）已通过公开审核，现在会显示在公开画廊中。`
            : `你的作品（${task.taskNo}）未通过公开审核，请调整后重新提交。`),
        relatedType: 'image',
        relatedId: task.id,
        meta: {
          action: approved ? 'approve_public' : 'reject_public',
          taskNo: task.taskNo,
          prompt: task.prompt,
          resultUrl: task.resultUrl ?? null,
          thumbnailUrl: task.thumbnailUrl ?? null,
          moderatedBy: adminEmail,
          note,
        },
      });

      return serializeImageTask(updated);
    }

    throw new BadRequestException('Invalid type');
  }

  async hide(type: 'image' | 'video', id: bigint, adminEmail: string, dto?: ModerateGalleryDto) {
    if (type === 'video') {
      const task = await this.prisma.videoTask.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          taskNo: true,
          prompt: true,
          resultUrl: true,
          thumbnailUrl: true,
          publicRequestedAt: true,
        },
      });
      if (!task) throw new NotFoundException('Task not found');
      const updated = await this.prisma.videoTask.update({
        where: { id },
        data: {
          isPublic: false,
          publicModerationStatus: PublicModerationStatus.rejected,
          publicRequestedAt: task.publicRequestedAt,
          publicModeratedAt: new Date(),
          publicModeratedBy: adminEmail,
          publicModerationNote: dto?.message?.trim() || null,
        },
      });
      await this.inbox.sendSystemMessage({
        userId: task.userId, type: 'moderation', level: 'info',
        title: dto?.title?.trim() || '作品已被隐藏',
        content: dto?.message?.trim() || `你的作品（${task.taskNo}）已被管理员隐藏。如有疑问请联系管理员。`,
        relatedType: 'video', relatedId: task.id,
        meta: {
          action: 'hide',
          taskNo: task.taskNo,
          prompt: task.prompt,
          resultUrl: task.resultUrl ?? null,
          thumbnailUrl: task.thumbnailUrl ?? null,
          moderatedBy: adminEmail,
        },
      });
      return serializeVideoTask(updated);
    }
    if (type === 'image') {
      const task = await this.prisma.imageTask.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          taskNo: true,
          prompt: true,
          resultUrl: true,
          thumbnailUrl: true,
          publicRequestedAt: true,
        },
      });
      if (!task) throw new NotFoundException('Task not found');
      const updated = await this.prisma.imageTask.update({
        where: { id },
        data: {
          isPublic: false,
          publicModerationStatus: PublicModerationStatus.rejected,
          publicRequestedAt: task.publicRequestedAt,
          publicModeratedAt: new Date(),
          publicModeratedBy: adminEmail,
          publicModerationNote: dto?.message?.trim() || null,
        },
      });
      await this.inbox.sendSystemMessage({
        userId: task.userId, type: 'moderation', level: 'info',
        title: dto?.title?.trim() || '作品已被隐藏',
        content: dto?.message?.trim() || `你的作品（${task.taskNo}）已被管理员隐藏。如有疑问请联系管理员。`,
        relatedType: 'image', relatedId: task.id,
        meta: {
          action: 'hide',
          taskNo: task.taskNo,
          prompt: task.prompt,
          resultUrl: task.resultUrl ?? null,
          thumbnailUrl: task.thumbnailUrl ?? null,
          moderatedBy: adminEmail,
        },
      });
      return serializeImageTask(updated);
    }
    throw new BadRequestException('Invalid type');
  }

  async remove(type: 'image' | 'video', id: bigint, dto?: ModerateGalleryDto) {
    if (type === 'video') {
      const task = await this.prisma.videoTask.findUnique({
        where: { id },
        select: { id: true, userId: true, taskNo: true, prompt: true, resultUrl: true, thumbnailUrl: true },
      });
      if (!task) throw new NotFoundException('Task not found');
      await this.prisma.videoTask.delete({ where: { id } });
      await this.inbox.sendSystemMessage({
        userId: task.userId, type: 'moderation', level: 'error',
        title: dto?.title?.trim() || '作品已被删除',
        content: dto?.message?.trim() || `你的作品（${task.taskNo}）已被管理员删除。如有疑问请联系管理员。`,
        relatedType: 'video', relatedId: task.id,
        meta: { action: 'delete', taskNo: task.taskNo, prompt: task.prompt, resultUrl: task.resultUrl ?? null, thumbnailUrl: task.thumbnailUrl ?? null },
      });
      return { ok: true };
    }
    if (type === 'image') {
      const task = await this.prisma.imageTask.findUnique({
        where: { id },
        select: { id: true, userId: true, taskNo: true, prompt: true, resultUrl: true, thumbnailUrl: true },
      });
      if (!task) throw new NotFoundException('Task not found');
      await this.prisma.imageTask.delete({ where: { id } });
      await this.inbox.sendSystemMessage({
        userId: task.userId, type: 'moderation', level: 'error',
        title: dto?.title?.trim() || '作品已被删除',
        content: dto?.message?.trim() || `你的作品（${task.taskNo}）已被管理员删除。如有疑问请联系管理员。`,
        relatedType: 'image', relatedId: task.id,
        meta: { action: 'delete', taskNo: task.taskNo, prompt: task.prompt, resultUrl: task.resultUrl ?? null, thumbnailUrl: task.thumbnailUrl ?? null },
      });
      return { ok: true };
    }
    throw new BadRequestException('Invalid type');
  }
}
