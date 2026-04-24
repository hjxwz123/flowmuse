import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ListAdminProjectsDto } from './dto/list-admin-projects.dto';
import { UpdateFreeProjectQuotaDto } from './dto/update-free-project-quota.dto';

const FREE_USER_MAX_PROJECTS_KEY = 'free_user_max_projects';
const DEFAULT_FREE_USER_MAX_PROJECTS = 3;

@Injectable()
export class AdminProjectsService {
  private readonly logger = new Logger(AdminProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listProjects(dto: ListAdminProjectsDto) {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(100, Math.max(1, dto.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = {};

    if (dto.userId) {
      try {
        where.userId = BigInt(dto.userId);
      } catch {
        where.userId = BigInt(-1);
      }
    }

    if (dto.q && dto.q.trim()) {
      where.name = { contains: dto.q.trim() };
    }

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              avatar: true,
            },
          },
          _count: {
            select: { assets: true, inspirations: true },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: projects.map((project) => ({
        id: project.id.toString(),
        name: project.name,
        concept: project.concept ?? '',
        description: project.description ?? '',
        assetCount: project._count.assets,
        inspirationCount: project._count.inspirations,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        user: {
          id: project.user.id.toString(),
          email: project.user.email,
          username: project.user.username ?? null,
          avatar: project.user.avatar ?? null,
        },
      })),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getFreeProjectQuota() {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: FREE_USER_MAX_PROJECTS_KEY },
    });

    const maxCount = config?.value
      ? Math.max(0, Math.floor(Number(config.value)))
      : DEFAULT_FREE_USER_MAX_PROJECTS;

    return {
      maxCount: Number.isFinite(maxCount) ? maxCount : DEFAULT_FREE_USER_MAX_PROJECTS,
    };
  }

  async updateFreeProjectQuota(dto: UpdateFreeProjectQuotaDto) {
    const maxCount =
      dto.maxCount === null || dto.maxCount === undefined
        ? DEFAULT_FREE_USER_MAX_PROJECTS
        : Math.max(0, Math.floor(dto.maxCount));

    await this.prisma.systemConfig.upsert({
      where: { key: FREE_USER_MAX_PROJECTS_KEY },
      create: {
        key: FREE_USER_MAX_PROJECTS_KEY,
        value: String(maxCount),
        description: 'Maximum number of projects free (non-member) users can create',
      },
      update: {
        value: String(maxCount),
        description: 'Maximum number of projects free (non-member) users can create',
      },
    });

    return { maxCount };
  }
}
