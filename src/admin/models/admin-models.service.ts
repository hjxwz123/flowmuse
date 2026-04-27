import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AiModel, AiModelType, Prisma, TaskStatus } from '@prisma/client';

import { CreditsService } from '../../credits/credits.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildWanxVideoModelKey,
  isWanxProvider,
  parseWanxVideoModelKey,
  resolveWanxVideoBaseModelKey,
  resolveWanxVideoModelKind,
  WANX_VIDEO_MODEL_KINDS,
  type WanxVideoModelKind,
} from '../../common/utils/wanx-model.util';
import { CreateModelDto } from './dto/create-model.dto';
import { ReorderModelsDto } from './dto/reorder-models.dto';
import { UpdateModelDto } from './dto/update-model.dto';

@Injectable()
export class AdminModelsService {
  private static readonly ARCHIVED_MODEL_NAME_PREFIX = '[DELETED#';

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
  ) {}

  private normalizeModeFlags(
    dto: {
      provider: string;
      modelKey: string;
      type: CreateModelDto['type'];
      supportsAgentMode?: boolean | null;
      supportsAutoMode?: boolean | null;
    },
  ) {
    const wanxKind = dto.type === 'video' && isWanxProvider(dto.provider)
      ? resolveWanxVideoModelKind(dto.modelKey)
      : null;

    if (wanxKind === 't2v' || wanxKind === 'i2v') {
      return {
        isAgentModeForcedOff: true,
        isAutoModeForcedOff: true,
        supportsAgentMode: false,
        supportsAutoMode: false,
      };
    }

    return {
      isAgentModeForcedOff: false,
      isAutoModeForcedOff: false,
      supportsAgentMode: dto.supportsAgentMode ?? null,
      supportsAutoMode: dto.supportsAutoMode ?? null,
    };
  }

  private parseChannelId(rawChannelId: string) {
    try {
      return BigInt(rawChannelId);
    } catch {
      throw new BadRequestException('Invalid channelId');
    }
  }

  private shouldExpandWanxVideoCreate(dto: CreateModelDto) {
    if (dto.type !== 'video') return false;
    if (!isWanxProvider(dto.provider)) return false;
    return !parseWanxVideoModelKey(dto.modelKey);
  }

  private buildCreateData(
    dto: CreateModelDto,
    channelId: bigint,
    overrides?: {
      modelKey?: string;
      supportsImageInput?: boolean | null;
      supportsAgentMode?: boolean | null;
      supportsAutoMode?: boolean | null;
      sortOrder?: number;
    },
  ): Prisma.AiModelUncheckedCreateInput {
    const modelKey = overrides?.modelKey ?? dto.modelKey;
    const supportsAgentMode = overrides?.supportsAgentMode ?? dto.supportsAgentMode ?? null;
    const supportsAutoMode = overrides?.supportsAutoMode ?? dto.supportsAutoMode ?? null;
    const normalizedModeFlags = this.normalizeModeFlags({
      provider: dto.provider,
      modelKey,
      type: dto.type,
      supportsAgentMode,
      supportsAutoMode,
    });

    return {
      name: dto.name,
      modelKey,
      icon: typeof dto.icon === 'string' ? dto.icon.trim() || null : null,
      type: dto.type as AiModelType,
      provider: dto.provider,
      channelId,
      creditsPerUse: dto.creditsPerUse,
      specialCreditsPerUse: dto.specialCreditsPerUse ?? null,
      extraCreditsConfig: dto.extraCreditsConfig as Prisma.InputJsonValue,
      defaultParams: dto.defaultParams as Prisma.InputJsonValue,
      paramConstraints: dto.paramConstraints as Prisma.InputJsonValue,
      isActive: dto.isActive ?? true,
      sortOrder: overrides?.sortOrder ?? dto.sortOrder ?? 0,
      description: dto.description,
      supportsImageInput: overrides?.supportsImageInput ?? dto.supportsImageInput ?? null,
      supportsResolutionSelect: dto.supportsResolutionSelect ?? null,
      supportsSizeSelect: dto.supportsSizeSelect ?? null,
      supportsQuickMode: dto.supportsQuickMode ?? null,
      supportsAgentMode: normalizedModeFlags.isAgentModeForcedOff
        ? false
        : normalizedModeFlags.supportsAgentMode,
      supportsAutoMode: normalizedModeFlags.isAutoModeForcedOff
        ? false
        : normalizedModeFlags.supportsAutoMode,
      freeUserDailyQuestionLimit: dto.freeUserDailyQuestionLimit ?? null,
      memberDailyQuestionLimit: dto.memberDailyQuestionLimit ?? null,
      maxContextRounds: dto.maxContextRounds ?? null,
    };
  }

  private buildWanxVideoCreateOverrides(dto: CreateModelDto): Array<{
    kind: WanxVideoModelKind;
    modelKey: string;
    supportsImageInput: boolean;
    supportsAgentMode: boolean | null;
    supportsAutoMode: boolean | null;
    sortOrder: number;
  }> {
    const baseModelKey = resolveWanxVideoBaseModelKey(dto.modelKey);
    const baseSortOrder = dto.sortOrder ?? 0;

    return WANX_VIDEO_MODEL_KINDS.map((kind, index) => ({
      kind,
      modelKey: buildWanxVideoModelKey(baseModelKey, kind),
      supportsImageInput: kind !== 't2v',
      supportsAgentMode: kind === 'r2v' ? dto.supportsAgentMode ?? null : false,
      supportsAutoMode: kind === 'r2v' ? dto.supportsAutoMode ?? null : false,
      sortOrder: baseSortOrder + index,
    }));
  }

  list() {
    return this.prisma.aiModel.findMany({
      where: {
        name: { not: { startsWith: AdminModelsService.ARCHIVED_MODEL_NAME_PREFIX } },
      },
      include: { channel: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateModelDto) {
    const channelId = this.parseChannelId(dto.channelId);

    if (this.shouldExpandWanxVideoCreate(dto)) {
      const variants = this.buildWanxVideoCreateOverrides(dto);
      return this.prisma.$transaction(async (tx) => {
        let r2vModel: AiModel | null = null;

        for (const variant of variants) {
          const created = await tx.aiModel.create({
            data: this.buildCreateData(dto, channelId, variant),
          });
          if (variant.kind === 'r2v') {
            r2vModel = created;
          }
        }

        if (!r2vModel) {
          throw new BadRequestException('Failed to create Wanx r2v model');
        }

        return r2vModel;
      });
    }

    return this.prisma.aiModel.create({
      data: this.buildCreateData(dto, channelId),
    });
  }

  async reorder(dto: ReorderModelsDto) {
    const modelIds = dto.modelIds.map((rawId) => {
      try {
        return BigInt(rawId);
      } catch {
        throw new BadRequestException(`Invalid model id: ${rawId}`);
      }
    });

    await this.prisma.$transaction(async (tx) => {
      const existingModels = await tx.aiModel.findMany({
        where: {
          id: { in: modelIds },
          name: { not: { startsWith: AdminModelsService.ARCHIVED_MODEL_NAME_PREFIX } },
        },
        select: { id: true },
      });

      if (existingModels.length !== modelIds.length) {
        throw new NotFoundException('One or more models were not found');
      }

      for (const [index, id] of modelIds.entries()) {
        await tx.aiModel.update({
          where: { id },
          data: { sortOrder: (index + 1) * 10 },
        });
      }
    });

    return { ok: true };
  }

  async detail(id: bigint) {
    const model = await this.prisma.aiModel.findUnique({ where: { id }, include: { channel: true } });
    if (!model) throw new NotFoundException('Model not found');
    return model;
  }

  async update(id: bigint, dto: UpdateModelDto) {
    const channelId = dto.channelId
      ? (() => {
          try {
            return BigInt(dto.channelId);
          } catch {
            throw new BadRequestException('Invalid channelId');
          }
        })()
      : undefined;

    const current = await this.prisma.aiModel.findUnique({
      where: { id },
      select: {
        provider: true,
        modelKey: true,
        type: true,
      },
    });
    if (!current) throw new NotFoundException('Model not found');

    const normalizedModeFlags = this.normalizeModeFlags({
      provider: dto.provider ?? current.provider,
      modelKey: dto.modelKey ?? current.modelKey,
      type: (dto.type ?? current.type) as CreateModelDto['type'],
      supportsAgentMode: dto.supportsAgentMode,
      supportsAutoMode: dto.supportsAutoMode,
    });

    return this.prisma.aiModel.update({
      where: { id },
      data: {
        name: dto.name,
        modelKey: dto.modelKey,
        icon: dto.icon === undefined ? undefined : (typeof dto.icon === 'string' ? dto.icon.trim() || null : null),
        type: dto.type ? (dto.type as AiModelType) : undefined,
        provider: dto.provider,
        channelId,
        creditsPerUse: dto.creditsPerUse,
        specialCreditsPerUse: dto.specialCreditsPerUse,
        extraCreditsConfig: dto.extraCreditsConfig as Prisma.InputJsonValue,
        defaultParams: dto.defaultParams as Prisma.InputJsonValue,
        paramConstraints: dto.paramConstraints as Prisma.InputJsonValue,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
        description: dto.description,
        supportsImageInput: dto.supportsImageInput,
        supportsResolutionSelect: dto.supportsResolutionSelect,
        supportsSizeSelect: dto.supportsSizeSelect,
        supportsQuickMode: dto.supportsQuickMode,
        supportsAgentMode: normalizedModeFlags.isAgentModeForcedOff
          ? false
          : dto.supportsAgentMode === undefined
            ? undefined
            : normalizedModeFlags.supportsAgentMode,
        supportsAutoMode: normalizedModeFlags.isAutoModeForcedOff
          ? false
          : dto.supportsAutoMode === undefined
            ? undefined
            : normalizedModeFlags.supportsAutoMode,
        freeUserDailyQuestionLimit: dto.freeUserDailyQuestionLimit,
        memberDailyQuestionLimit: dto.memberDailyQuestionLimit,
        maxContextRounds: dto.maxContextRounds,
      },
    });
  }

  async remove(id: bigint) {
    const model = await this.prisma.aiModel.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        modelKey: true,
        icon: true,
        type: true,
        provider: true,
        channelId: true,
        creditsPerUse: true,
        specialCreditsPerUse: true,
        extraCreditsConfig: true,
        defaultParams: true,
        paramConstraints: true,
        supportsImageInput: true,
        supportsResolutionSelect: true,
        supportsSizeSelect: true,
        supportsQuickMode: true,
        supportsAgentMode: true,
        supportsAutoMode: true,
        freeUserDailyQuestionLimit: true,
        memberDailyQuestionLimit: true,
        maxContextRounds: true,
      },
    });
    if (!model) throw new NotFoundException('Model not found');

    try {
      await this.prisma.$transaction(async (tx) => {
        // 删除模型前，先把该模型下进行中的任务标记失败并退款，避免用户资金损失。
        const [runningImageTasks, runningVideoTasks] = await Promise.all([
          tx.imageTask.findMany({
            where: { modelId: id, status: { in: [TaskStatus.pending, TaskStatus.processing] } },
            select: { id: true, userId: true, taskNo: true, creditsCost: true },
          }),
          tx.videoTask.findMany({
            where: { modelId: id, status: { in: [TaskStatus.pending, TaskStatus.processing] } },
            select: { id: true, userId: true, taskNo: true, creditsCost: true },
          }),
        ]);

        for (const task of runningImageTasks) {
          await this.credits.refundCredits(tx, task.userId, task.id, `Refund removed model image task ${task.taskNo}`, {
            scopeDescriptionContains: task.taskNo,
            maxRefundAmount: typeof task.creditsCost === 'number' ? Math.max(task.creditsCost, 0) : undefined,
          });
        }
        for (const task of runningVideoTasks) {
          await this.credits.refundCredits(tx, task.userId, task.id, `Refund removed model video task ${task.taskNo}`, {
            scopeDescriptionContains: task.taskNo,
            maxRefundAmount: typeof task.creditsCost === 'number' ? Math.max(task.creditsCost, 0) : undefined,
          });
        }

        if (runningImageTasks.length > 0) {
          await tx.imageTask.updateMany({
            where: { id: { in: runningImageTasks.map((t) => t.id) } },
            data: { status: TaskStatus.failed, errorMessage: 'MODEL_REMOVED', completedAt: new Date() },
          });
        }
        if (runningVideoTasks.length > 0) {
          await tx.videoTask.updateMany({
            where: { id: { in: runningVideoTasks.map((t) => t.id) } },
            data: { status: TaskStatus.failed, errorMessage: 'MODEL_REMOVED', completedAt: new Date() },
          });
        }

        // 创建归档模型承接历史关联数据，这样关联任务/工具不会被删除。
        const archiveNameBase = `${AdminModelsService.ARCHIVED_MODEL_NAME_PREFIX}${model.id.toString()}] ${model.name}`;
        const archiveName = archiveNameBase.length > 100 ? archiveNameBase.slice(0, 100) : archiveNameBase;
        const archiveModel = await tx.aiModel.create({
          data: {
            name: archiveName,
            modelKey: `${model.modelKey}_deleted_${Date.now()}`.slice(0, 100),
            icon: model.icon,
            type: model.type,
            provider: model.provider,
            channelId: model.channelId,
            creditsPerUse: model.creditsPerUse,
            specialCreditsPerUse: model.specialCreditsPerUse ?? null,
            extraCreditsConfig: model.extraCreditsConfig as Prisma.InputJsonValue,
            defaultParams: model.defaultParams as Prisma.InputJsonValue,
            paramConstraints: model.paramConstraints as Prisma.InputJsonValue,
            isActive: false,
            description: `Archived placeholder for deleted model ${model.id.toString()}`,
            supportsImageInput: model.supportsImageInput,
            supportsResolutionSelect: model.supportsResolutionSelect,
            supportsSizeSelect: model.supportsSizeSelect,
            supportsQuickMode: model.supportsQuickMode,
            supportsAgentMode: model.supportsAgentMode,
            supportsAutoMode: model.supportsAutoMode,
            freeUserDailyQuestionLimit: model.freeUserDailyQuestionLimit,
            memberDailyQuestionLimit: model.memberDailyQuestionLimit,
            maxContextRounds: model.maxContextRounds,
          },
        });

        // 保留关联记录，只迁移 modelId。
        await tx.imageTask.updateMany({ where: { modelId: id }, data: { modelId: archiveModel.id } });
        await tx.videoTask.updateMany({ where: { modelId: id }, data: { modelId: archiveModel.id } });
        await tx.tool.updateMany({ where: { modelId: id }, data: { modelId: archiveModel.id, isActive: false } });
        await tx.template.updateMany({
          where: { modelId: id },
          data: { modelId: archiveModel.id },
        });
        await tx.chatConversation.updateMany({
          where: { modelId: id },
          data: { modelId: archiveModel.id },
        });

        await tx.aiModel.delete({ where: { id } });
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('模型删除失败：仍存在外键引用，请检查其他业务表是否引用该模型。');
      }
      throw error;
    }

    return { ok: true };
  }
}
