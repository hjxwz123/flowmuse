import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: { activeOnly?: boolean; sort?: 'price' | 'sort' }) {
    const where = options.activeOnly === false
      ? { packageType: 'credits' as const }
      : { isActive: true, packageType: 'credits' as const };

    const orderBy =
      options.sort === 'price'
        ? [{ price: 'asc' as const }, { sortOrder: 'asc' as const }]
        : [{ sortOrder: 'asc' as const }, { price: 'asc' as const }];

    return this.prisma.package.findMany({ where, orderBy });
  }

  async detail(id: bigint) {
    const pkg = await this.prisma.package.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }
}
