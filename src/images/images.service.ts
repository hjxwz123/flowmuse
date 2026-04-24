import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AiModelType, ImageTask, PublicModerationStatus, TaskStatus, UserStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import { Queue } from 'bullmq';

import { AdapterFactory } from '../adapters/adapter.factory';
import { ImageGenerateParams } from '../adapters/base/base-image.adapter';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { CreditsService } from '../credits/credits.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializeImageTask, serializeImageTaskLite } from '../common/serializers/task.serializer';
import { IMAGE_GENERATION_QUEUE } from '../queues/queue-names';
import { ImageGenerateDto } from './dto/image-generate.dto';
import { MidjourneyActionDto } from './dto/midjourney-action.dto';
import { MidjourneyModalDto } from './dto/midjourney-modal.dto';
import { MidjourneyEditsDto } from './dto/midjourney-edits.dto';
import { calculateTotalCredits } from '../common/utils/extra-credits.util';
import type { ExtraCreditsConfig } from '../admin/models/dto/extra-credits-config.type';
import { PromptModerationService } from '../moderation/prompt-moderation.service';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class ImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly promptModeration: PromptModerationService,
    private readonly projects: ProjectsService,
    @InjectQueue(IMAGE_GENERATION_QUEUE) private readonly imageQueue: Queue,
  ) {}

  private ensureActiveOwnedTask(task: ImageTask | null, userId: bigint): ImageTask {
    if (!task || task.deletedAt) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('No access');
    return task;
  }

  private resolveBaseCredits(model: { creditsPerUse: number; specialCreditsPerUse?: number | null }): number {
    const special = typeof model.specialCreditsPerUse === 'number' ? model.specialCreditsPerUse : null;
    if (special !== null && special > 0 && special < model.creditsPerUse) return special;
    return model.creditsPerUse;
  }

  estimateTaskCredits(
    model: {
      creditsPerUse: number;
      specialCreditsPerUse?: number | null;
      extraCreditsConfig?: Prisma.JsonValue | null;
    },
    parameters: Record<string, unknown> | null | undefined,
  ) {
    const extraCreditsConfig = model.extraCreditsConfig as ExtraCreditsConfig | null;
    const baseCredits = this.resolveBaseCredits(model);
    return calculateTotalCredits(baseCredits, extraCreditsConfig, parameters);
  }

  async getAvailableCreditsTotal(userId: bigint) {
    const available = await this.prisma.$transaction((tx) => this.credits.getTotalAvailableCredits(tx, userId));
    return available.total;
  }

  private async resolveProjectId(tx: Prisma.TransactionClient, userId: bigint, projectId?: string) {
    if (!projectId) return undefined;

    let parsedProjectId: bigint;
    try {
      parsedProjectId = BigInt(projectId);
    } catch {
      throw new BadRequestException('Invalid projectId');
    }

    const project = await tx.project.findFirst({
      where: { id: parsedProjectId, userId },
      select: { id: true },
    });
    if (!project) throw new BadRequestException('Project not found');
    return project.id;
  }

  private async findOwnedTaskByIdOrTaskNo(userId: bigint, idOrTaskNo: string) {
    const normalized = String(idOrTaskNo || '').trim();
    if (!normalized) {
      throw new NotFoundException('Task not found');
    }

    try {
      const task = await this.prisma.imageTask.findUnique({
        where: { id: BigInt(normalized) },
        include: { tool: { select: { title: true } } },
      });
      return this.ensureActiveOwnedTask(task, userId);
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        if (error instanceof NotFoundException || error instanceof ForbiddenException) {
          throw error;
        }
      }
    }

    const task = await this.prisma.imageTask.findFirst({
      where: {
        userId,
        taskNo: normalized,
        deletedAt: null,
      },
      include: { tool: { select: { title: true } } },
    });
    return this.ensureActiveOwnedTask(task, userId);
  }

  async generate(userId: bigint, dto: ImageGenerateDto) {
    const modelId = BigInt(dto.modelId);
    let parsedProjectId: bigint | null = null;
    if (dto.projectId) {
      try {
        parsedProjectId = BigInt(dto.projectId);
      } catch {
        throw new BadRequestException('Invalid projectId');
      }
    }

    const projectScopedPrompt = parsedProjectId && dto.skipProjectPromptTransform !== true
      ? await this.projects.generateProjectImagePrompt(userId, parsedProjectId, dto.prompt)
      : null;
    const finalPrompt = projectScopedPrompt?.prompt ?? dto.prompt;

    await this.promptModeration.assertInputsAllowed(
      [
        { scene: 'image_generate_prompt', content: finalPrompt },
        { scene: 'image_generate_negative_prompt', content: dto.negativePrompt },
      ],
      '当前提示词未通过内容审核，请修改后重试',
      {
        userId,
        modelId,
        source: 'image_generate',
      },
    );

    const task = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
      if (!user) throw new NotFoundException('User not found');
      if (user.status !== UserStatus.active) throw new ForbiddenException('User is banned');

      const model = await tx.aiModel.findUnique({
        where: { id: modelId },
        include: { channel: true },
      });
      if (!model) throw new NotFoundException('Model not found');
      if (!model.isActive) throw new BadRequestException('Model disabled');
      if (model.type !== AiModelType.image) throw new BadRequestException('Model is not image type');

      // Validate params early (before charging credits / enqueue).
      // Merge model.defaultParams + user parameters, then inject modelKey as provider "model" if not specified.
      const mergedParams: ImageGenerateParams = {
        ...(model.defaultParams && typeof model.defaultParams === 'object' ? (model.defaultParams as any) : {}),
        ...(dto.parameters && typeof dto.parameters === 'object' ? dto.parameters : {}),
        prompt: finalPrompt,
        negativePrompt: dto.negativePrompt,
      };
      if (model.modelKey && !(mergedParams as any).model) (mergedParams as any).model = model.modelKey;

      const adapter = AdapterFactory.createImageAdapter(model.provider, model.channel as any);
      const validation = adapter.validateParams(mergedParams);
      if (!validation.valid) {
        throw new BadRequestException(validation.errors?.join(', ') ?? 'Invalid params');
      }

      // 计算总积分消耗：基础积分 + 额外积分（基于分辨率、时长等参数）
      const cost = this.estimateTaskCredits(model, dto.parameters as Record<string, unknown>);
      const available = await this.credits.getTotalAvailableCredits(tx, userId);
      if (available.total < cost) throw new BadRequestException('Insufficient credits');
      const projectId = await this.resolveProjectId(tx, userId, dto.projectId);

      const task = await tx.imageTask.create({
        data: {
          userId,
          modelId: model.id,
          channelId: model.channelId,
          ...(projectId ? { projectId } : {}),
          taskNo: `img_${nanoid(24)}`,
          provider: model.provider,
          prompt: finalPrompt,
          negativePrompt: dto.negativePrompt,
          parameters: dto.parameters as Prisma.InputJsonValue,
          status: TaskStatus.pending,
          creditsCost: cost,
          ...(dto.toolId ? { toolId: BigInt(dto.toolId) } : {}),
        },
      });

      const consumption = await this.credits.consumeCredits(tx, userId, cost, task.id, `Image task ${task.taskNo}`);

      const updated = await tx.imageTask.update({
        where: { id: task.id },
        data: { creditSource: consumption.creditSource },
      });

      return updated;
    });

    await this.imageQueue.add('generate', { taskId: task.id.toString() }, { jobId: `${task.id.toString()}-${task.retryCount}` });
    return serializeImageTask(task);
  }

  async listTasks(userId: bigint, pagination: PaginationDto, status?: string): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      deletedAt: null,
      ...(status ? { status: status as TaskStatus } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.imageTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { tool: { select: { title: true } } },
      }),
      this.prisma.imageTask.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(serializeImageTaskLite),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  async getTask(userId: bigint, idOrTaskNo: string) {
    const task = await this.findOwnedTaskByIdOrTaskNo(userId, idOrTaskNo);
    return serializeImageTask(task);
  }

  async deleteTask(userId: bigint, id: bigint) {
    const task = await this.prisma.imageTask.findUnique({ where: { id } });
    const ownedTask = this.ensureActiveOwnedTask(task, userId);

    await this.prisma.imageTask.update({
      where: { id: ownedTask.id },
      data: {
        deletedAt: new Date(),
        isPublic: false,
        publicModerationStatus: PublicModerationStatus.private,
        publicRequestedAt: null,
        publicModeratedAt: null,
        publicModeratedBy: null,
        publicModerationNote: null,
      },
    });
    return { ok: true };
  }

  async setPublic(userId: bigint, id: bigint, isPublic: boolean) {
    const task = await this.prisma.imageTask.findUnique({ where: { id } });
    const ownedTask = this.ensureActiveOwnedTask(task, userId);
    if (ownedTask.status !== TaskStatus.completed) throw new BadRequestException('Task not completed');

    const updated = await this.prisma.imageTask.update({
      where: { id: ownedTask.id },
      data: isPublic
        ? {
            isPublic: false,
            publicModerationStatus: PublicModerationStatus.pending,
            publicRequestedAt: new Date(),
            publicModeratedAt: null,
            publicModeratedBy: null,
            publicModerationNote: null,
          }
        : {
            isPublic: false,
            publicModerationStatus: PublicModerationStatus.private,
            publicRequestedAt: null,
            publicModeratedAt: null,
            publicModeratedBy: null,
            publicModerationNote: null,
          },
    });
    return serializeImageTask(updated);
  }

  async retry(userId: bigint, id: bigint) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
      if (!user) throw new NotFoundException('User not found');
      if (user.status !== UserStatus.active) throw new ForbiddenException('User is banned');

      const task = await tx.imageTask.findUnique({ where: { id } });
      const ownedTask = this.ensureActiveOwnedTask(task, userId);
      if (ownedTask.status === TaskStatus.pending || ownedTask.status === TaskStatus.processing) {
        throw new BadRequestException('Task is still running');
      }

      let cost = Math.max(ownedTask.creditsCost ?? 0, 0);
      if (cost <= 0) {
        const model = await tx.aiModel.findUnique({ where: { id: ownedTask.modelId }, select: { creditsPerUse: true } });
        cost = Math.max(model?.creditsPerUse ?? 0, 0);
      }

      let creditSource = ownedTask.creditSource;
      if (cost > 0) {
        const available = await this.credits.getTotalAvailableCredits(tx, userId);
        if (available.total < cost) throw new BadRequestException('Insufficient credits');
        const nextRetry = ownedTask.retryCount + 1;
        const consumption = await this.credits.consumeCredits(
          tx,
          userId,
          cost,
          ownedTask.id,
          `Retry image task ${ownedTask.taskNo} #${nextRetry}`,
        );
        creditSource = consumption.creditSource;
      }

      return tx.imageTask.update({
        where: { id: ownedTask.id },
        data: {
          status: TaskStatus.pending,
          retryCount: { increment: 1 },
          errorMessage: null,
          startedAt: null,
          completedAt: null,
          providerTaskId: null,
          resultUrl: null,
          thumbnailUrl: null,
          ossKey: null,
          creditsCost: cost,
          creditSource,
        },
      });
    });

    await this.imageQueue.add('generate', { taskId: updated.id.toString() }, { jobId: `${updated.id.toString()}-${updated.retryCount}` });
    return serializeImageTask(updated);
  }

  async midjourneyAction(userId: bigint, id: bigint, dto: MidjourneyActionDto) {
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
      if (!user) throw new NotFoundException('User not found');
      if (user.status !== UserStatus.active) throw new ForbiddenException('User is banned');

      const parent = await tx.imageTask.findUnique({ where: { id } });
      const ownedParent = this.ensureActiveOwnedTask(parent, userId);
      if (ownedParent.provider !== 'midjourney' && ownedParent.provider !== 'mj') throw new BadRequestException('Not a midjourney task');
      if (!ownedParent.providerTaskId) throw new BadRequestException('Missing providerTaskId');
      if (ownedParent.status !== TaskStatus.completed) throw new BadRequestException('Task not completed');

      // Follow-up operations (zoom/pan/upscale/vary region...) are only allowed within 24 hours after the parent task completed.
      const baseTime = ownedParent.completedAt ?? ownedParent.createdAt;
      if (Date.now() - baseTime.getTime() > 24 * 60 * 60 * 1000) {
        throw new BadRequestException('Task is too old to operate');
      }

      const model = await tx.aiModel.findUnique({ where: { id: ownedParent.modelId } });
      if (!model) throw new NotFoundException('Model not found');
      if (!model.isActive) throw new BadRequestException('Model disabled');
      if (model.type !== AiModelType.image) throw new BadRequestException('Model is not image type');

      const cost = model.creditsPerUse;
      const available = await this.credits.getTotalAvailableCredits(tx, userId);
      if (available.total < cost) throw new BadRequestException('Insufficient credits');

      const task = await tx.imageTask.create({
        data: {
          userId,
          modelId: ownedParent.modelId,
          channelId: ownedParent.channelId,
          ...(ownedParent.projectId ? { projectId: ownedParent.projectId } : {}),
          taskNo: `img_${nanoid(24)}`,
          provider: ownedParent.provider,
          prompt: ownedParent.prompt,
          negativePrompt: ownedParent.negativePrompt,
          parameters: {
            mjOperation: 'action',
            taskId: ownedParent.providerTaskId,
            customId: dto.customId,
            parentTaskId: ownedParent.id.toString(),
            parentCompletedAt: (ownedParent.completedAt ?? ownedParent.createdAt).toISOString(),
          } as Prisma.InputJsonValue,
          status: TaskStatus.pending,
          creditsCost: cost,
        },
      });

      const consumption = await this.credits.consumeCredits(tx, userId, cost, task.id, `Image task ${task.taskNo}`);

      const updated = await tx.imageTask.update({
        where: { id: task.id },
        data: { creditSource: consumption.creditSource },
      });

      return updated;
    });

    await this.imageQueue.add(
      'generate',
      { taskId: created.id.toString() },
      { jobId: `${created.id.toString()}-${created.retryCount}` },
    );

    return serializeImageTask(created);
  }

  async midjourneyModal(userId: bigint, id: bigint, dto: MidjourneyModalDto) {
    await this.promptModeration.assertInputsAllowed(
      [{ scene: 'midjourney_modal_prompt', content: dto.prompt }],
      '当前提示词未通过内容审核，请修改后重试',
      {
        userId,
        taskId: id,
        source: 'image_generate',
      },
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
      if (!user) throw new NotFoundException('User not found');
      if (user.status !== UserStatus.active) throw new ForbiddenException('User is banned');

      const task = await tx.imageTask.findUnique({ where: { id } });
      const ownedTask = this.ensureActiveOwnedTask(task, userId);
      if (ownedTask.provider !== 'midjourney' && ownedTask.provider !== 'mj') throw new BadRequestException('Not a midjourney task');
      if (!ownedTask.providerTaskId) throw new BadRequestException('Missing providerTaskId');
      if (ownedTask.status !== TaskStatus.processing || ownedTask.errorMessage !== 'MODAL') {
        throw new BadRequestException('Task is not waiting for modal');
      }

      // Continue modal submissions only within 24 hours after the parent task completed.
      const params = ownedTask.parameters && typeof ownedTask.parameters === 'object' ? (ownedTask.parameters as any) : {};
      const parentCompletedAt = typeof params.parentCompletedAt === 'string' ? params.parentCompletedAt.trim() : '';
      let baseTimeMs: number | null = null;
      if (parentCompletedAt) {
        const parsed = new Date(parentCompletedAt).getTime();
        if (Number.isFinite(parsed)) baseTimeMs = parsed;
      }

      if (baseTimeMs === null && typeof params.parentTaskId === 'string' && params.parentTaskId.trim()) {
        try {
          const parentId = BigInt(params.parentTaskId);
          const parent = await tx.imageTask.findUnique({
            where: { id: parentId },
            select: { userId: true, completedAt: true, createdAt: true, deletedAt: true },
          });
          if (parent && parent.userId === userId && !parent.deletedAt) {
            baseTimeMs = (parent.completedAt ?? parent.createdAt).getTime();
          }
        } catch {
          // ignore parse errors
        }
      }

      if (baseTimeMs === null) baseTimeMs = ownedTask.createdAt.getTime();

      if (Date.now() - baseTimeMs > 24 * 60 * 60 * 1000) {
        throw new BadRequestException('Task is too old to operate');
      }

      const nextParams: Record<string, unknown> =
        ownedTask.parameters && typeof ownedTask.parameters === 'object' ? { ...(ownedTask.parameters as any) } : {};
      nextParams.mjOperation = 'modal';
      nextParams.taskId = ownedTask.providerTaskId;
      if (dto.maskBase64) nextParams.maskBase64 = dto.maskBase64;

      const nextPrompt = dto.prompt?.trim();

      return tx.imageTask.update({
        where: { id: ownedTask.id },
        data: {
          status: TaskStatus.pending,
          providerTaskId: null,
          parameters: nextParams as Prisma.InputJsonValue,
          errorMessage: null,
          ...(nextPrompt ? { prompt: nextPrompt } : {}),
        },
      });
    });

    await this.imageQueue.add('generate', { taskId: updated.id.toString() }, { jobId: `${updated.id.toString()}-${Date.now()}` });
    return serializeImageTask(updated);
  }

  /**
   * Midjourney 图片编辑 (新 API: /mj/submit/edits)
   * 一步到位，不再需要 action + modal 两步
   */
  async midjourneyEdits(userId: bigint, id: bigint, dto: MidjourneyEditsDto) {
    await this.promptModeration.assertInputsAllowed(
      [{ scene: 'midjourney_edits_prompt', content: dto.prompt }],
      '当前提示词未通过内容审核，请修改后重试',
      {
        userId,
        taskId: id,
        source: 'image_generate',
      },
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
      if (!user) throw new NotFoundException('User not found');
      if (user.status !== UserStatus.active) throw new ForbiddenException('User is banned');

      const parent = await tx.imageTask.findUnique({ where: { id } });
      const ownedParent = this.ensureActiveOwnedTask(parent, userId);
      if (ownedParent.provider !== 'midjourney' && ownedParent.provider !== 'mj') throw new BadRequestException('Not a midjourney task');
      if (!ownedParent.resultUrl) throw new BadRequestException('Parent task has no result');
      if (ownedParent.status !== TaskStatus.completed) throw new BadRequestException('Task not completed');

      // 图片编辑操作允许在 24 小时内
      const baseTime = ownedParent.completedAt ?? ownedParent.createdAt;
      if (Date.now() - baseTime.getTime() > 24 * 60 * 60 * 1000) {
        throw new BadRequestException('Task is too old to operate');
      }

      const model = await tx.aiModel.findUnique({ where: { id: ownedParent.modelId } });
      if (!model) throw new NotFoundException('Model not found');
      if (!model.isActive) throw new BadRequestException('Model disabled');
      if (model.type !== AiModelType.image) throw new BadRequestException('Model is not image type');

      const cost = model.creditsPerUse;
      const available = await this.credits.getTotalAvailableCredits(tx, userId);
      if (available.total < cost) throw new BadRequestException('Insufficient credits');

      const task = await tx.imageTask.create({
        data: {
          userId,
          modelId: ownedParent.modelId,
          channelId: ownedParent.channelId,
          ...(ownedParent.projectId ? { projectId: ownedParent.projectId } : {}),
          taskNo: `img_${nanoid(24)}`,
          provider: ownedParent.provider,
          prompt: dto.prompt,
          negativePrompt: ownedParent.negativePrompt,
          parameters: {
            mjOperation: 'edits',
            image: dto.image, // 原图 URL
            maskBase64: dto.maskBase64, // 蒙版（原图+透明区域）
            parentTaskId: ownedParent.id.toString(),
            parentCompletedAt: (ownedParent.completedAt ?? ownedParent.createdAt).toISOString(),
          } as Prisma.InputJsonValue,
          status: TaskStatus.pending,
          creditsCost: cost,
        },
      });

      const consumption = await this.credits.consumeCredits(tx, userId, cost, task.id, `Image task ${task.taskNo}`);

      const updated = await tx.imageTask.update({
        where: { id: task.id },
        data: { creditSource: consumption.creditSource },
      });

      return updated;
    });

    await this.imageQueue.add(
      'generate',
      { taskId: created.id.toString() },
      { jobId: `${created.id.toString()}-${created.retryCount}` },
    );

    return serializeImageTask(created);
  }
}
