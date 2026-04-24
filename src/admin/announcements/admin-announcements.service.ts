import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAnnouncementsQueryDto } from './dto/admin-announcements-query.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AdminAnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminAnnouncementsQueryDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10 } = query as PaginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.AnnouncementWhereInput = {
      ...(query.isActive ? { isActive: query.isActive === 'true' } : {}),
      ...(query.q
        ? {
            OR: [{ title: { contains: query.q } }, { content: { contains: query.q } }],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: items,
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    };
  }

  async detail(id: bigint) {
    const item = await this.prisma.announcement.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Announcement not found');
    return item;
  }

  async create(dto: CreateAnnouncementDto) {
    return this.prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        isActive: dto.isActive ?? true,
        isPinned: dto.isPinned ?? false,
        sortOrder: dto.sortOrder ?? 0,
        startsAt: null,
        endsAt: null,
      },
    });
  }

  async update(id: bigint, dto: UpdateAnnouncementDto) {
    await this.detail(id);

    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.isPinned !== undefined ? { isPinned: dto.isPinned } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        startsAt: null,
        endsAt: null,
      },
    });
  }

  async remove(id: bigint) {
    await this.detail(id);
    await this.prisma.announcement.delete({ where: { id } });
    return { ok: true };
  }
}
