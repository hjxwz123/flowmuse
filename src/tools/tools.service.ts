import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateToolDto } from './dto/create-tool.dto';
import { QueryToolsDto } from './dto/query-tools.dto';

const MODEL_SELECT = { name: true, provider: true, modelKey: true, creditsPerUse: true } as const;

@Injectable()
export class ToolsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 获取所有激活工具（用户端） */
  async findActive(query: QueryToolsDto) {
    const where: any = { isActive: true };
    if (query.type) where.type = query.type;
    if (query.category) where.category = query.category;

    const tools = await this.prisma.tool.findMany({
      where,
      include: { model: { select: MODEL_SELECT } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return tools.map(this.serialize);
  }

  /** 获取单个工具 */
  async findOne(id: bigint) {
    const tool = await this.prisma.tool.findUnique({
      where: { id },
      include: { model: { select: MODEL_SELECT } },
    });
    if (!tool) throw new NotFoundException('Tool not found');
    return this.serialize(tool);
  }

  /** 管理员：获取所有工具（含未激活） */
  async findAll(query: QueryToolsDto) {
    const where: any = {};
    if (query.type) where.type = query.type;
    if (query.category) where.category = query.category;

    const tools = await this.prisma.tool.findMany({
      where,
      include: { model: { select: MODEL_SELECT } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return tools.map(this.serialize);
  }

  /** 创建工具 */
  async create(dto: CreateToolDto) {
    const tool = await this.prisma.tool.create({
      data: {
        title: dto.title,
        description: dto.description,
        notes: dto.notes,
        coverUrl: dto.coverUrl,
        prompt: dto.prompt,
        type: dto.type,
        modelId: BigInt(dto.modelId),
        imageCount: dto.imageCount ?? 1,
        imageLabels: (dto.imageLabels ?? undefined) as Prisma.InputJsonValue | undefined,
        parameters: (dto.parameters ?? undefined) as Prisma.InputJsonValue | undefined,
        category: dto.category,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { model: { select: MODEL_SELECT } },
    });
    return this.serialize(tool);
  }

  /** 更新工具 */
  async update(id: bigint, dto: Partial<CreateToolDto>) {
    await this.findOne(id);
    const tool = await this.prisma.tool.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.coverUrl !== undefined && { coverUrl: dto.coverUrl }),
        ...(dto.prompt !== undefined && { prompt: dto.prompt }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.modelId !== undefined && { modelId: BigInt(dto.modelId) }),
        ...(dto.imageCount !== undefined && { imageCount: dto.imageCount }),
        ...(dto.imageLabels !== undefined && { imageLabels: dto.imageLabels as Prisma.InputJsonValue }),
        ...(dto.parameters !== undefined && { parameters: dto.parameters as Prisma.InputJsonValue }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      } as Prisma.ToolUncheckedUpdateInput,
      include: { model: { select: MODEL_SELECT } },
    });
    return this.serialize(tool);
  }

  /** 删除工具 */
  async remove(id: bigint) {
    await this.findOne(id);
    await this.prisma.tool.delete({ where: { id } });
    return { ok: true };
  }

  private serialize(tool: any) {
    return {
      id: tool.id.toString(),
      title: tool.title,
      description: tool.description ?? undefined,
      notes: tool.notes ?? undefined,
      coverUrl: tool.coverUrl ?? undefined,
      prompt: tool.prompt,
      type: tool.type,
      modelId: tool.modelId.toString(),
      modelName: tool.model?.name ?? '',
      modelProvider: tool.model?.provider ?? '',
      modelKey: tool.model?.modelKey ?? '',
      creditsPerUse: tool.model?.creditsPerUse ?? 0,
      imageCount: tool.imageCount,
      imageLabels: tool.imageLabels ?? undefined,
      parameters: tool.parameters ?? undefined,
      category: tool.category ?? undefined,
      isActive: tool.isActive,
      sortOrder: tool.sortOrder,
      createdAt: tool.createdAt.toISOString(),
    };
  }
}
