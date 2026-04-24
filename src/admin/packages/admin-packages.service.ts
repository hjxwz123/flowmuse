import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Injectable()
export class AdminPackagesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.package.findMany({
      where: { packageType: 'credits' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  create(dto: CreatePackageDto) {
    if (dto.packageType && dto.packageType !== 'credits') {
      throw new BadRequestException('时长套餐已下线，请使用会员每日积分功能');
    }

    return this.prisma.package.create({
      data: {
        name: dto.name.trim(),
        nameEn: dto.nameEn?.trim() || null,
        packageType: 'credits',
        durationDays: 0,
        creditsPerDay: 0,
        totalCredits: dto.totalCredits,
        price: new Prisma.Decimal(dto.price),
        originalPrice: dto.originalPrice !== undefined ? new Prisma.Decimal(dto.originalPrice) : undefined,
        description: dto.description?.trim() || null,
        descriptionEn: dto.descriptionEn?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async detail(id: bigint) {
    const pkg = await this.prisma.package.findFirst({
      where: { id, packageType: 'credits' },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  async update(id: bigint, dto: UpdatePackageDto) {
    const existing = await this.prisma.package.findUnique({
      where: { id },
      select: { id: true, packageType: true },
    });
    if (!existing) throw new NotFoundException('Package not found');
    if (existing.packageType !== 'credits') {
      throw new BadRequestException('时长套餐已下线，无法修改');
    }

    return this.prisma.package.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        nameEn: dto.nameEn !== undefined ? (dto.nameEn?.trim() || null) : undefined,
        ...(dto.packageType !== undefined ? { packageType: 'credits' } : {}),
        durationDays: dto.durationDays !== undefined ? 0 : undefined,
        creditsPerDay: dto.creditsPerDay !== undefined ? 0 : undefined,
        totalCredits: dto.totalCredits,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        originalPrice: dto.originalPrice !== undefined ? new Prisma.Decimal(dto.originalPrice) : undefined,
        description: dto.description !== undefined ? (dto.description?.trim() || null) : undefined,
        descriptionEn: dto.descriptionEn !== undefined ? (dto.descriptionEn?.trim() || null) : undefined,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: bigint) {
    const orderCount = await this.prisma.paymentOrder.count({
      where: { packageId: id },
    });

    if (orderCount > 0) {
      throw new BadRequestException(
        `Cannot delete package: ${orderCount} order(s) reference this package. Please deactivate it instead.`
      )
    }

    await this.prisma.package.delete({ where: { id } });
    return { ok: true };
  }
}
