import { Injectable, NotFoundException } from '@nestjs/common';
import { AiModelType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { buildModelCapabilities } from './model-capabilities';

@Injectable()
export class ModelsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: { type?: 'image' | 'video' | 'chat'; provider?: string }) {
    const where: Prisma.AiModelWhereInput = { isActive: true };
    if (options.type) where.type = options.type as AiModelType;
    if (options.provider) where.provider = options.provider;

    const models = await this.prisma.aiModel.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return models.map(({ systemPrompt: _systemPrompt, ...model }) => model);
  }

  async detail(id: bigint) {
    const model = await this.prisma.aiModel.findUnique({
      where: { id },
      include: { channel: true },
    });
    if (!model) throw new NotFoundException('Model not found');
    const { systemPrompt: _systemPrompt, ...publicModel } = model;
    return publicModel;
  }

  async capabilities(id: bigint) {
    const model = await this.prisma.aiModel.findUnique({ where: { id } });
    if (!model) throw new NotFoundException('Model not found');
    const providerConfig = await this.prisma.modelProvider.findUnique({ where: { provider: model.provider } });
    return buildModelCapabilities(model, providerConfig);
  }

  async listCapabilities(options: { type?: 'image' | 'video' | 'chat'; provider?: string }) {
    const where: Prisma.AiModelWhereInput = { isActive: true };
    if (options.type) where.type = options.type as AiModelType;
    if (options.provider) where.provider = options.provider;

    const models = await this.prisma.aiModel.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    const providers = Array.from(new Set(models.map((m) => m.provider)));
    const providerConfigs = await this.prisma.modelProvider.findMany({ where: { provider: { in: providers } } });
    const map = new Map(providerConfigs.map((p) => [p.provider, p]));

    return models.map((m) => {
      const { systemPrompt: _systemPrompt, ...publicModel } = m;
      return {
        ...publicModel,
        capabilities: buildModelCapabilities(m, map.get(m.provider) ?? null),
      };
    });
  }
}
