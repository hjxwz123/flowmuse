import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AiModelType, ApiChannelStatus, Prisma, TaskStatus } from '@prisma/client';

import { CreditsService } from '../../credits/credits.service';
import { EncryptionService } from '../../encryption/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiSettingsService } from '../../settings/ai-settings.service';
import { SHARED_CHAT_CHANNEL_NAME, SHARED_CHAT_PROVIDER } from '../../settings/ai-chat.constants';
import { ReorderModelsDto } from '../models/dto/reorder-models.dto';
import { CreateChatModelDto } from './dto/create-chat-model.dto';
import { UpdateChatModelDto } from './dto/update-chat-model.dto';

@Injectable()
export class AdminChatModelsService {
  private static readonly ARCHIVED_MODEL_NAME_PREFIX = '[DELETED#';

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly aiSettings: AiSettingsService,
    private readonly credits: CreditsService,
  ) {}

  async list() {
    return this.prisma.aiModel.findMany({
      where: {
        type: AiModelType.chat,
        name: { not: { startsWith: AdminChatModelsService.ARCHIVED_MODEL_NAME_PREFIX } },
      },
      select: {
        id: true,
        name: true,
        modelKey: true,
        icon: true,
        description: true,
        systemPrompt: true,
        provider: true,
        supportsImageInput: true,
        freeUserDailyQuestionLimit: true,
        maxContextRounds: true,
        deepResearchCreditsCost: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateChatModelDto) {
    const name = dto.name.trim();
    const modelKey = dto.modelKey.trim();
    const icon = this.normalizeNullableText(dto.icon);
    const description = this.normalizeNullableText(dto.description, 10000);
    const systemPrompt = this.normalizeSystemPrompt(dto.systemPrompt);

    if (!name) {
      throw new BadRequestException('模型显示名称不能为空');
    }
    if (!modelKey) {
      throw new BadRequestException('实际请求模型名不能为空');
    }

    const existing = await this.prisma.aiModel.findFirst({
      where: {
        type: AiModelType.chat,
        modelKey,
      },
      select: { id: true, name: true },
    });

    if (existing) {
      throw new BadRequestException(`请求模型名 "${modelKey}" 已存在`);
    }

    const channelId = await this.ensureSharedChatChannel();
    const maxSortOrder = await this.prisma.aiModel.aggregate({
      where: { type: AiModelType.chat },
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? 0) + 10;
    const sortOrder = dto.sortOrder ?? nextSortOrder;

    return this.prisma.aiModel.create({
      data: {
        name,
        modelKey,
        type: AiModelType.chat,
        provider: SHARED_CHAT_PROVIDER,
        channelId,
        creditsPerUse: 0,
        isActive: dto.isActive ?? true,
        sortOrder,
        icon,
        description,
        supportsImageInput: dto.supportsImageInput ?? false,
        freeUserDailyQuestionLimit: dto.freeUserDailyQuestionLimit ?? null,
        maxContextRounds: dto.maxContextRounds ?? null,
        systemPrompt,
        deepResearchCreditsCost: dto.deepResearchCreditsCost ?? null,
      },
      select: {
        id: true,
        name: true,
        modelKey: true,
        icon: true,
        description: true,
        systemPrompt: true,
        provider: true,
        supportsImageInput: true,
        freeUserDailyQuestionLimit: true,
        maxContextRounds: true,
        deepResearchCreditsCost: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(idRaw: string, dto: UpdateChatModelDto) {
    let id: bigint;
    try {
      id = BigInt(idRaw);
    } catch {
      throw new BadRequestException('Invalid model id');
    }

    const model = await this.prisma.aiModel.findUnique({
      where: { id },
      select: { id: true, type: true },
    });
    if (!model || model.type !== AiModelType.chat) {
      throw new BadRequestException('Chat model not found');
    }

    const nextName = dto.name?.trim();
    const nextModelKey = dto.modelKey?.trim();
    if (dto.name !== undefined && !nextName) {
      throw new BadRequestException('模型显示名称不能为空');
    }
    if (dto.modelKey !== undefined && !nextModelKey) {
      throw new BadRequestException('实际请求模型名不能为空');
    }

    if (nextModelKey) {
      const exists = await this.prisma.aiModel.findFirst({
        where: {
          type: AiModelType.chat,
          modelKey: nextModelKey,
          id: { not: id },
        },
        select: { id: true },
      });
      if (exists) {
        throw new BadRequestException(`请求模型名 "${nextModelKey}" 已存在`);
      }
    }

    return this.prisma.aiModel.update({
      where: { id },
      data: {
        name: nextName,
        modelKey: nextModelKey,
        icon: dto.icon === undefined ? undefined : this.normalizeNullableText(dto.icon),
        description:
          dto.description === undefined ? undefined : this.normalizeNullableText(dto.description, 10000),
        systemPrompt: dto.systemPrompt === undefined ? undefined : this.normalizeSystemPrompt(dto.systemPrompt),
        supportsImageInput: dto.supportsImageInput,
        freeUserDailyQuestionLimit: dto.freeUserDailyQuestionLimit,
        maxContextRounds: dto.maxContextRounds,
        deepResearchCreditsCost: dto.deepResearchCreditsCost,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      },
      select: {
        id: true,
        name: true,
        modelKey: true,
        icon: true,
        description: true,
        systemPrompt: true,
        provider: true,
        supportsImageInput: true,
        freeUserDailyQuestionLimit: true,
        maxContextRounds: true,
        deepResearchCreditsCost: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(idRaw: string) {
    let id: bigint;
    try {
      id = BigInt(idRaw);
    } catch {
      throw new BadRequestException('Invalid model id');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const model = await tx.aiModel.findUnique({
          where: { id },
          select: {
            id: true,
            type: true,
          },
        });

        if (!model || model.type !== AiModelType.chat) {
          throw new BadRequestException('Chat model not found');
        }

        const runningResearchTasks = await tx.researchTask.findMany({
          where: { modelId: id, status: { in: [TaskStatus.pending, TaskStatus.processing] } },
          select: { id: true, userId: true, taskNo: true, creditsCost: true },
        });

        for (const task of runningResearchTasks) {
          await this.credits.refundCredits(tx, task.userId, task.id, `Refund removed chat model research task ${task.taskNo}`, {
            scopeDescriptionContains: task.taskNo,
            maxRefundAmount: typeof task.creditsCost === 'number' ? Math.max(task.creditsCost, 0) : undefined,
          });
        }

        if (runningResearchTasks.length > 0) {
          await tx.researchTask.updateMany({
            where: { id: { in: runningResearchTasks.map((task) => task.id) } },
            data: { status: TaskStatus.failed, stage: 'failed', errorMessage: 'MODEL_REMOVED', completedAt: new Date() },
          });
        }

        await tx.chatConversation.updateMany({ where: { modelId: id }, data: { modelId: null } });
        await tx.chatModerationLog.updateMany({ where: { modelId: id }, data: { modelId: null } });
        await tx.inputModerationLog.updateMany({ where: { modelId: id }, data: { modelId: null } });
        await tx.researchTask.updateMany({ where: { modelId: id }, data: { modelId: null } });
        await tx.$executeRaw`UPDATE templates SET model_id = NULL WHERE model_id = ${id}`;

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
          type: AiModelType.chat,
          name: { not: { startsWith: AdminChatModelsService.ARCHIVED_MODEL_NAME_PREFIX } },
        },
        select: { id: true },
      });

      if (existingModels.length !== modelIds.length) {
        throw new NotFoundException('One or more chat models were not found');
      }

      for (const [index, id] of modelIds.entries()) {
        await tx.aiModel.update({
          where: { id },
          data: {
            sortOrder: (index + 1) * 10,
          },
        });
      }
    });

    return { ok: true };
  }

  private async ensureSharedChatChannel() {
    const settings = await this.aiSettings.getAiSettings();
    const baseUrl = settings.apiBaseUrl.trim();
    const apiKey = settings.apiKey.trim();

    if (!baseUrl || !apiKey) {
      throw new BadRequestException('请先在 AI 配置中填写 API 地址和 API Key');
    }

    const encryptedApiKey = this.encryption.encryptString(apiKey);

    const existing = await this.prisma.apiChannel.findFirst({
      where: {
        provider: SHARED_CHAT_PROVIDER,
        name: SHARED_CHAT_CHANNEL_NAME,
      },
      orderBy: { id: 'asc' },
      select: { id: true, timeout: true },
    });

    if (existing) {
      const updated = await this.prisma.apiChannel.update({
        where: { id: existing.id },
        data: {
          baseUrl,
          apiKey: encryptedApiKey,
          status: ApiChannelStatus.active,
          timeout: Math.max(existing.timeout, 60_000),
        },
        select: { id: true },
      });
      return updated.id;
    }

    const created = await this.prisma.apiChannel.create({
      data: {
        name: SHARED_CHAT_CHANNEL_NAME,
        provider: SHARED_CHAT_PROVIDER,
        baseUrl,
        apiKey: encryptedApiKey,
        timeout: 120_000,
        maxRetry: 2,
        status: ApiChannelStatus.active,
        priority: 0,
        description: 'Shared chat channel driven by /admin/config/ai settings',
      },
      select: { id: true },
    });

    return created.id;
  }

  private normalizeSystemPrompt(value?: string) {
    if (value === undefined) return null;
    const normalized = value.trim();
    return normalized || null;
  }

  private normalizeNullableText(value: string | undefined, maxLength?: number) {
    if (value === undefined) return null;
    const normalized = value.trim();
    const sliced = typeof maxLength === 'number' ? normalized.slice(0, maxLength) : normalized;
    return sliced || null;
  }
}
