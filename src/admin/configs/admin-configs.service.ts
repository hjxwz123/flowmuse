import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { UpdateConfigDto } from './dto/update-config.dto';

@Injectable()
export class AdminConfigsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
  }

  update(key: string, dto: UpdateConfigDto) {
    return this.prisma.systemConfig.upsert({
      where: { key },
      create: {
        key,
        value: dto.value ?? null,
        description: dto.description,
      },
      update: {
        value: dto.value,
        description: dto.description,
      },
    });
  }
}

