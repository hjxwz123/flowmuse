import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.modelProvider.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        provider: true,
        displayName: true,
        icon: true,
        supportTypes: true,
        defaultParams: true,
        paramSchema: true,
        webhookRequired: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async detail(provider: string) {
    const item = await this.prisma.modelProvider.findUnique({
      where: { provider },
      select: {
        id: true,
        provider: true,
        displayName: true,
        icon: true,
        supportTypes: true,
        defaultParams: true,
        paramSchema: true,
        webhookRequired: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!item) throw new NotFoundException('Provider not found');
    if (!item.isActive) throw new NotFoundException('Provider not found');
    return item;
  }
}

