import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipPeriod, Prisma, RedeemCodeStatus, RedeemCodeType } from '@prisma/client';
import { nanoid } from 'nanoid';

import { PrismaService } from '../../prisma/prisma.service';
import { BatchRedeemCodeDto } from './dto/batch-redeem-code.dto';
import { CreateRedeemCodeDto } from './dto/create-redeem-code.dto';
import { UpdateRedeemCodeDto } from './dto/update-redeem-code.dto';

function parseBigInt(value?: string | null) {
  if (!value) return undefined;
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Invalid id');
  }
}

function toMembershipPeriod(value?: string | null) {
  if (!value) return undefined;
  return value === 'yearly' ? MembershipPeriod.yearly : MembershipPeriod.monthly;
}

function normalizeCycles(value?: number | null) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(Number(value)));
}

function isCodeConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;

  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.some((item) => String(item).includes('code'))
    : typeof target === 'string' && target.includes('code');
}

@Injectable()
export class AdminRedeemCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: {
    page?: number;
    pageSize?: number;
    search?: string;
    type?: string;
    status?: string;
  } = {}) {
    const page = Number.isFinite(options.page) && Number(options.page) > 0
      ? Math.floor(Number(options.page))
      : 1;
    const pageSize = Number.isFinite(options.pageSize)
      ? Math.min(Math.max(Math.floor(Number(options.pageSize)), 1), 100)
      : 20;
    const search = options.search?.trim();
    const where: Prisma.RedeemCodeWhereInput = {};

    if (options.type === RedeemCodeType.membership || options.type === RedeemCodeType.credits) {
      where.type = options.type;
    }

    if (
      options.status === RedeemCodeStatus.active ||
      options.status === RedeemCodeStatus.disabled ||
      options.status === RedeemCodeStatus.expired
    ) {
      where.status = options.status;
    }

    if (search) {
      where.code = { contains: search };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.redeemCode.count({ where }),
      this.prisma.redeemCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          membershipLevel: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      items,
    };
  }

  private async assertMembershipLevel(levelId: bigint | undefined) {
    if (!levelId) throw new BadRequestException('membershipLevelId required');
    const level = await this.prisma.membershipLevel.findUnique({
      where: { id: levelId },
      select: { id: true, isActive: true },
    });
    if (!level) throw new BadRequestException('membership level not found');
    if (!level.isActive) throw new BadRequestException('membership level is inactive');
  }

  async create(dto: CreateRedeemCodeDto) {
    const type = dto.type === 'membership' ? RedeemCodeType.membership : RedeemCodeType.credits;
    const status = dto.status ? (dto.status as RedeemCodeStatus) : RedeemCodeStatus.active;
    const membershipLevelId = parseBigInt(dto.membershipLevelId);
    const membershipPeriod = toMembershipPeriod(dto.membershipPeriod);
    const membershipCycles = normalizeCycles(dto.membershipCycles);

    if (type === RedeemCodeType.membership) {
      if (!membershipPeriod) throw new BadRequestException('membershipPeriod required');
      await this.assertMembershipLevel(membershipLevelId);
    }
    if (type === RedeemCodeType.credits && (!dto.credits || dto.credits <= 0)) {
      throw new BadRequestException('credits required');
    }

    const code = dto.code?.trim() || nanoid(20);

    try {
      return await this.prisma.redeemCode.create({
        data: {
          code,
          type,
          membershipLevelId: type === RedeemCodeType.membership ? membershipLevelId : undefined,
          membershipPeriod: type === RedeemCodeType.membership ? membershipPeriod : undefined,
          membershipCycles: type === RedeemCodeType.membership ? membershipCycles : undefined,
          credits: type === RedeemCodeType.credits ? dto.credits : undefined,
          maxUseCount: dto.maxUseCount ?? 1,
          usedCount: 0,
          expireDate: dto.expireDate ? new Date(dto.expireDate) : undefined,
          status,
          description: dto.description,
        },
        include: {
          membershipLevel: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      if (isCodeConflict(error)) {
        throw new BadRequestException(`兑换码「${code}」已存在，请更换后再创建`);
      }
      throw error;
    }
  }

  async batch(dto: BatchRedeemCodeDto) {
    const count = Math.min(dto.count, 500);
    const type = dto.type === 'membership' ? RedeemCodeType.membership : RedeemCodeType.credits;
    const status = dto.status ? (dto.status as RedeemCodeStatus) : RedeemCodeStatus.active;
    const membershipLevelId = parseBigInt(dto.membershipLevelId);
    const membershipPeriod = toMembershipPeriod(dto.membershipPeriod);
    const membershipCycles = normalizeCycles(dto.membershipCycles);

    if (type === RedeemCodeType.membership) {
      if (!membershipPeriod) throw new BadRequestException('membershipPeriod required');
      await this.assertMembershipLevel(membershipLevelId);
    }
    if (type === RedeemCodeType.credits && (!dto.credits || dto.credits <= 0)) {
      throw new BadRequestException('credits required');
    }

    const expireDate = dto.expireDate ? new Date(dto.expireDate) : undefined;

    const created = [];
    for (let i = 0; i < count; i += 1) {
      created.push(
        this.prisma.redeemCode.create({
          data: {
            code: nanoid(20),
            type,
            membershipLevelId: type === RedeemCodeType.membership ? membershipLevelId : undefined,
            membershipPeriod: type === RedeemCodeType.membership ? membershipPeriod : undefined,
            membershipCycles: type === RedeemCodeType.membership ? membershipCycles : undefined,
            credits: type === RedeemCodeType.credits ? dto.credits : undefined,
            maxUseCount: dto.maxUseCount ?? 1,
            usedCount: 0,
            expireDate,
            status,
            description: dto.description,
          },
          include: {
            membershipLevel: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
      );
    }

    try {
      const codes = await this.prisma.$transaction(created);
      return { count: codes.length, codes };
    } catch (error) {
      if (isCodeConflict(error)) {
        throw new BadRequestException('生成的兑换码与现有兑换码重复，请重试');
      }
      throw error;
    }
  }

  async update(id: bigint, dto: UpdateRedeemCodeDto) {
    const existing = await this.prisma.redeemCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Redeem code not found');

    const nextType = dto.type
      ? (dto.type === 'membership' ? RedeemCodeType.membership : RedeemCodeType.credits)
      : existing.type;

    const membershipLevelId = dto.membershipLevelId !== undefined
      ? parseBigInt(dto.membershipLevelId)
      : existing.membershipLevelId ?? undefined;
    const membershipPeriod = dto.membershipPeriod !== undefined
      ? toMembershipPeriod(dto.membershipPeriod)
      : existing.membershipPeriod ?? undefined;
    const membershipCycles = dto.membershipCycles !== undefined
      ? normalizeCycles(dto.membershipCycles)
      : existing.membershipCycles ?? undefined;
    const credits = dto.credits !== undefined ? dto.credits : existing.credits;

    if (nextType === RedeemCodeType.membership) {
      if (!membershipPeriod) throw new BadRequestException('membershipPeriod required');
      await this.assertMembershipLevel(membershipLevelId);
    }
    if (nextType === RedeemCodeType.credits && (!credits || credits <= 0)) {
      throw new BadRequestException('credits required');
    }

    const code = dto.code?.trim();

    try {
      return await this.prisma.redeemCode.update({
        where: { id },
        data: {
          code,
          type: nextType,
          membershipLevelId: nextType === RedeemCodeType.membership ? membershipLevelId : null,
          membershipPeriod: nextType === RedeemCodeType.membership ? membershipPeriod : null,
          membershipCycles: nextType === RedeemCodeType.membership ? membershipCycles : null,
          credits: nextType === RedeemCodeType.credits ? credits : null,
          maxUseCount: dto.maxUseCount,
          expireDate: dto.expireDate === undefined
            ? undefined
            : (dto.expireDate ? new Date(dto.expireDate) : null),
          status: dto.status ? (dto.status as RedeemCodeStatus) : undefined,
          description: dto.description,
        },
        include: {
          membershipLevel: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      if (isCodeConflict(error)) {
        throw new BadRequestException(`兑换码「${code}」已存在，请更换后再保存`);
      }
      throw error;
    }
  }

  async remove(id: bigint) {
    try {
      await this.prisma.redeemCode.update({
        where: { id },
        data: { status: RedeemCodeStatus.disabled },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Redeem code not found');
      }
      throw error;
    }
    return { ok: true };
  }

  logs(codeId: bigint) {
    return this.prisma.redeemLog.findMany({
      where: { codeId },
      orderBy: { redeemedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        membershipLevel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  exportAll() {
    return this.prisma.redeemCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        membershipLevel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}
