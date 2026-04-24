import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';

@Injectable()
export class AdminProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  private isProviderUniqueConflict(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== 'P2002') return false;
    const target = error.meta?.target;
    if (Array.isArray(target)) return target.includes('provider') || target.includes('model_providers_provider_key');
    if (typeof target === 'string') return target.includes('provider');
    return true;
  }

  list() {
    return this.prisma.modelProvider.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  }

  async create(dto: CreateProviderDto) {
    const providerKey = dto.provider.trim();
    try {
      return await this.prisma.modelProvider.create({
        data: {
          provider: providerKey,
          displayName: dto.displayName,
          adapterClass: dto.adapterClass,
          supportTypes: dto.supportTypes as unknown as Prisma.InputJsonValue,
          defaultParams: dto.defaultParams as Prisma.InputJsonValue,
          paramSchema: dto.paramSchema as Prisma.InputJsonValue,
          webhookRequired: dto.webhookRequired ?? false,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (error) {
      if (this.isProviderUniqueConflict(error)) {
        throw new BadRequestException(`供应商标识 "${providerKey}" 已存在，请使用其他 provider 值`);
      }
      throw error;
    }
  }

  async detail(id: bigint) {
    const provider = await this.prisma.modelProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    return provider;
  }

  async update(id: bigint, dto: UpdateProviderDto) {
    const nextProvider = typeof dto.provider === 'string' ? dto.provider.trim() : undefined;
    try {
      return await this.prisma.modelProvider.update({
        where: { id },
        data: {
          provider: nextProvider,
          displayName: dto.displayName,
          adapterClass: dto.adapterClass,
          supportTypes: dto.supportTypes as unknown as Prisma.InputJsonValue,
          defaultParams: dto.defaultParams as Prisma.InputJsonValue,
          paramSchema: dto.paramSchema as Prisma.InputJsonValue,
          webhookRequired: dto.webhookRequired,
          isActive: dto.isActive,
          sortOrder: dto.sortOrder,
        },
      });
    } catch (error) {
      if (this.isProviderUniqueConflict(error)) {
        throw new BadRequestException(`供应商标识 "${nextProvider ?? ''}" 已存在，请使用其他 provider 值`);
      }
      throw error;
    }
  }

  async remove(id: bigint) {
    await this.prisma.modelProvider.delete({ where: { id } });
    return { ok: true };
  }
}
