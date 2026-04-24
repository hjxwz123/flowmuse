import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { QueryTemplatesDto } from './dto/query-templates.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 获取系统公开模板（createdBy=null, isPublic=true），支持类型/分类过滤 */
  async findPublic(query: QueryTemplatesDto) {
    const where: any = {
      isPublic: true,
      createdBy: null,
    };
    if (query.type) where.type = query.type;
    if (query.category) where.category = query.category;

    const templates = await this.prisma.template.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return templates.map(this.serialize);
  }

  /** 获取用户个人预设 */
  async findMyPresets(userId: bigint, query: QueryTemplatesDto) {
    const where: any = {
      createdBy: userId,
      isPublic: false,
    };
    if (query.type) where.type = query.type;
    if (query.category) where.category = query.category;

    const templates = await this.prisma.template.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });

    return templates.map(this.serialize);
  }

  /** 获取单个模板 */
  async findOne(id: bigint) {
    const template = await this.prisma.template.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return this.serialize(template);
  }

  /** 创建模板或预设 */
  async create(dto: CreateTemplateDto, userId?: bigint, isAdmin = false) {
    const data: any = {
      title: dto.title,
      description: dto.description ?? null,
      coverUrl: dto.coverUrl ?? null,
      prompt: dto.prompt,
      type: dto.type,
      modelId: dto.modelId ? BigInt(dto.modelId) : null,
      parameters: dto.parameters ?? null,
      category: dto.category ?? null,
      isPublic: isAdmin ? (dto.isPublic ?? true) : false,
      sortOrder: dto.sortOrder ?? 0,
      createdBy: isAdmin ? null : (userId ?? null),
    };

    const template = await this.prisma.template.create({ data });
    return this.serialize(template);
  }

  /** 更新模板（校验所有权） */
  async update(
    id: bigint,
    dto: Partial<CreateTemplateDto>,
    userId?: bigint,
    isAdmin = false,
  ) {
    const existing = await this.findOneRaw(id);

    if (!isAdmin) {
      if (!userId || existing.createdBy !== userId) {
        throw new ForbiddenException('Permission denied');
      }
    }

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.coverUrl !== undefined) data.coverUrl = dto.coverUrl;
    if (dto.prompt !== undefined) data.prompt = dto.prompt;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.modelId !== undefined)
      data.modelId = dto.modelId ? BigInt(dto.modelId) : null;
    if (dto.parameters !== undefined) data.parameters = dto.parameters;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.isPublic !== undefined && isAdmin) data.isPublic = dto.isPublic;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    const template = await this.prisma.template.update({
      where: { id },
      data,
    });

    return this.serialize(template);
  }

  /** 删除模板（校验所有权） */
  async remove(id: bigint, userId?: bigint, isAdmin = false) {
    const existing = await this.findOneRaw(id);

    if (!isAdmin) {
      if (!userId || existing.createdBy !== userId) {
        throw new ForbiddenException('Permission denied');
      }
    }

    await this.prisma.template.delete({ where: { id } });
    return { ok: true };
  }

  /** Admin: 获取所有模板（系统模板+可选用户预设） */
  async findAll(query: QueryTemplatesDto & { includePresets?: boolean }) {
    const where: any = {};
    if (!query.includePresets) where.createdBy = null;
    if (query.type) where.type = query.type;
    if (query.category) where.category = query.category;

    const templates = await this.prisma.template.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return templates.map(this.serialize);
  }

  private async findOneRaw(id: bigint) {
    const template = await this.prisma.template.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  private serialize(t: any) {
    return {
      ...t,
      id: t.id.toString(),
      modelId: t.modelId ? t.modelId.toString() : null,
      createdBy: t.createdBy ? t.createdBy.toString() : null,
    };
  }
}
