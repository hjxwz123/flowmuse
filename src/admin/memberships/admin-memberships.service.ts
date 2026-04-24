import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { MembershipChatModelQuotasService } from '../../memberships/membership-chat-model-quotas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMembershipLevelDto } from './dto/create-membership-level.dto';
import { UpdateMembershipChatModelQuotasDto } from './dto/update-membership-chat-model-quotas.dto';
import { UpdateMembershipLevelDto } from './dto/update-membership-level.dto';
import { UpdateMembershipProjectQuotaDto } from './dto/update-membership-project-quota.dto';

function normalizeBenefits(input: string[] | undefined) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => Boolean(item));
}

@Injectable()
export class AdminMembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipChatModelQuotas: MembershipChatModelQuotasService,
  ) {}

  list() {
    return this.prisma.membershipLevel.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  create(dto: CreateMembershipLevelDto) {
    return this.prisma.membershipLevel.create({
      data: {
        name: dto.name.trim(),
        nameEn: dto.nameEn?.trim() || null,
        color: dto.color.trim(),
        monthlyPrice: new Prisma.Decimal(dto.monthlyPrice),
        yearlyPrice: new Prisma.Decimal(dto.yearlyPrice),
        dailyCredits: dto.dailyCredits ?? 0,
        bonusPermanentCredits: dto.bonusPermanentCredits ?? 0,
        benefits: normalizeBenefits(dto.benefits) as Prisma.InputJsonValue,
        benefitsEn: normalizeBenefits(dto.benefitsEn) as Prisma.InputJsonValue,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async detail(id: bigint) {
    const level = await this.prisma.membershipLevel.findUnique({ where: { id } });
    if (!level) throw new NotFoundException('Membership level not found');
    return level;
  }

  chatModelQuotas(id: bigint) {
    return this.membershipChatModelQuotas.getAdminQuotaConfig(id);
  }

  update(id: bigint, dto: UpdateMembershipLevelDto) {
    return this.prisma.membershipLevel.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        nameEn: dto.nameEn !== undefined ? (dto.nameEn?.trim() || null) : undefined,
        color: dto.color?.trim(),
        monthlyPrice: dto.monthlyPrice !== undefined ? new Prisma.Decimal(dto.monthlyPrice) : undefined,
        yearlyPrice: dto.yearlyPrice !== undefined ? new Prisma.Decimal(dto.yearlyPrice) : undefined,
        dailyCredits: dto.dailyCredits,
        bonusPermanentCredits: dto.bonusPermanentCredits,
        benefits: dto.benefits !== undefined
          ? (normalizeBenefits(dto.benefits) as Prisma.InputJsonValue)
          : undefined,
        benefitsEn: dto.benefitsEn !== undefined
          ? (normalizeBenefits(dto.benefitsEn) as Prisma.InputJsonValue)
          : undefined,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  updateChatModelQuotas(id: bigint, dto: UpdateMembershipChatModelQuotasDto) {
    return this.membershipChatModelQuotas.replaceAdminQuotaConfig(
      id,
      (dto.items ?? []).map((item) => ({
        modelId: item.modelId,
        dailyLimit: item.dailyLimit,
      })),
    );
  }

  async getProjectQuota(id: bigint) {
    const level = await this.prisma.membershipLevel.findUnique({
      where: { id },
      select: { id: true, name: true, color: true, permissions: true },
    });
    if (!level) throw new NotFoundException('Membership level not found');

    const permissions = level.permissions as Record<string, unknown> | null;
    const projects = permissions?.projects as Record<string, unknown> | undefined;
    const maxCount = typeof projects?.maxCount === 'number' ? projects.maxCount : null;

    return {
      level: { id: level.id, name: level.name, color: level.color },
      maxCount,
    };
  }

  async updateProjectQuota(id: bigint, dto: UpdateMembershipProjectQuotaDto) {
    const level = await this.prisma.membershipLevel.findUnique({
      where: { id },
      select: { id: true, permissions: true },
    });
    if (!level) throw new NotFoundException('Membership level not found');

    const permissions: Record<string, unknown> =
      level.permissions && typeof level.permissions === 'object' && !Array.isArray(level.permissions)
        ? JSON.parse(JSON.stringify(level.permissions))
        : {};

    if (dto.maxCount === null || dto.maxCount === undefined) {
      if (permissions.projects && typeof permissions.projects === 'object') {
        delete (permissions.projects as Record<string, unknown>).maxCount;
        if (Object.keys(permissions.projects as Record<string, unknown>).length === 0) {
          delete permissions.projects;
        }
      }
    } else {
      const parsedMax = Math.max(0, Math.floor(dto.maxCount));
      permissions.projects = {
        ...(permissions.projects && typeof permissions.projects === 'object' ? permissions.projects as Record<string, unknown> : {}),
        maxCount: parsedMax,
      };
    }

    const permissionsValue =
      Object.keys(permissions).length > 0 ? (permissions as Prisma.InputJsonValue) : Prisma.JsonNull;

    await this.prisma.membershipLevel.update({
      where: { id },
      data: { permissions: permissionsValue },
    });

    return this.getProjectQuota(id);
  }


  async remove(id: bigint) {
    const level = await this.prisma.membershipLevel.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!level) throw new NotFoundException('Membership level not found');

    const now = new Date();
    const [activeUserCount, scheduledUserCount] = await Promise.all([
      this.prisma.user.count({
        where: {
          membershipLevelId: id,
          membershipExpireAt: { gt: now },
        },
      }),
      this.prisma.userMembershipSchedule.count({
        where: {
          membershipLevelId: id,
          expireAt: { gt: now },
        },
      }),
    ]);
    const totalLinkedUsers = activeUserCount + scheduledUserCount;
    if (totalLinkedUsers > 0) {
      throw new BadRequestException(`当前仍有 ${totalLinkedUsers} 位用户在使用或排队使用该会员等级，无法删除`);
    }

    await this.prisma.membershipLevel.delete({ where: { id } });
    await this.membershipChatModelQuotas.clearCache(id);
    return { ok: true };
  }
}
