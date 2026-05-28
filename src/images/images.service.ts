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
import { normalizeProviderKey } from '../common/utils/provider.util';
import { RegenerateImageTaskDto } from './dto/regenerate-image-task.dto';

type ImageRegenerationTargetModel = {
  provider: string;
  modelKey: string;
  supportsImageInput?: boolean | null;
  supportsResolutionSelect?: boolean | null;
  supportsSizeSelect?: boolean | null;
};

type RatioParts = {
  width: number;
  height: number;
};

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asInteger(value: unknown): number | undefined {
  const parsed = asNumber(value);
  if (parsed === undefined || !Number.isInteger(parsed)) return undefined;
  return parsed;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseRatioLike(value?: string): RatioParts | null {
  if (!value) return null;
  const normalized = value.trim();
  const ratioMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (ratioMatch) {
    const width = Number(ratioMatch[1]);
    const height = Number(ratioMatch[2]);
    if (width > 0 && height > 0) return { width, height };
  }

  const sizeMatch = normalized.match(/^(\d+)\s*[x*]\s*(\d+)$/i);
  if (sizeMatch) {
    const width = Number(sizeMatch[1]);
    const height = Number(sizeMatch[2]);
    if (width > 0 && height > 0) return { width, height };
  }

  return null;
}

function ratioToFloat(ratio: RatioParts | null) {
  if (!ratio || ratio.height <= 0) return null;
  return ratio.width / ratio.height;
}

function gcd(left: number, right: number): number {
  let a = Math.abs(Math.round(left));
  let b = Math.abs(Math.round(right));
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}

function ratioToColon(value: RatioParts | null): string | undefined {
  if (!value) return undefined;
  const divisor = gcd(value.width, value.height);
  return `${Math.round(value.width / divisor)}:${Math.round(value.height / divisor)}`;
}

function isRemoteUrl(value: string) {
  return value.startsWith('http://') || value.startsWith('https://');
}

function stripDataUrlPrefix(value: string) {
  const index = value.indexOf(',');
  return value.startsWith('data:') && index >= 0 ? value.slice(index + 1) : value;
}

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

  private resolveTaskGroupId(input?: string | null) {
    const normalized = typeof input === 'string' ? input.trim() : '';
    if (!normalized) return `grp_${nanoid(24)}`;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(normalized)) {
      throw new BadRequestException('Invalid taskGroupId');
    }
    return normalized;
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

  private getTaskParameterRecord(task: ImageTask): Record<string, unknown> {
    return isPlainRecord(task.parameters) ? { ...(task.parameters as Record<string, unknown>) } : {};
  }

  private resolveSourceRatio(params: Record<string, unknown>): RatioParts | null {
    const width = asNumber(params.width);
    const height = asNumber(params.height);
    if (width && height && width > 0 && height > 0) return { width, height };

    const direct =
      asString(params.aspectRatio) ??
      asString(params.aspect_ratio) ??
      asString(params.ratio) ??
      asString(params.size);

    return parseRatioLike(direct);
  }

  private resolveImageSize(params: Record<string, unknown>): '2K' | '4K' | undefined {
    const value =
      asString(params.imageSize) ??
      asString(params.image_size) ??
      asString(params.size) ??
      asString(params.resolution);
    const normalized = value?.toUpperCase();
    if (normalized === '2K' || normalized === '4K') return normalized;
    return undefined;
  }

  private collectRegenerationImages(params: Record<string, unknown>): string[] {
    const values: string[] = [];
    const push = (value: unknown) => {
      if (typeof value === 'string' && value.trim()) values.push(value.trim());
    };
    const pushArray = (value: unknown) => {
      if (!Array.isArray(value)) return;
      value.forEach(push);
    };

    pushArray(params.images);
    pushArray(params.imageArray);
    pushArray(params.base64Array);
    pushArray(params.referenceImages);
    push(params.image);
    push(params.imageUrl);
    push(params.imageBase64);
    push(params.referenceImage);
    push(params.initImage);
    push(params.promptImage);
    push(params.firstFrameImage);
    push(params.firstFrame);

    const seen = new Set<string>();
    return values.filter((value) => {
      if (!value) return false;
      const key = value.startsWith('data:') ? stripDataUrlPrefix(value) : value;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private targetAllowsImageInput(model: ImageRegenerationTargetModel) {
    if (model.supportsImageInput === false) return false;
    if (model.supportsImageInput === true) return true;

    const provider = normalizeProviderKey(model.provider);
    return (
      provider === 'midjourney' ||
      provider === 'gptimage' ||
      provider === 'nanobanana' ||
      provider === 'doubao' ||
      provider === 'qwen'
    );
  }

  private getTargetImageLimit(model: ImageRegenerationTargetModel) {
    const provider = normalizeProviderKey(model.provider);
    if (provider === 'midjourney') return 5;
    if (provider === 'gptimage' || provider === 'doubao' || provider === 'qwen') return 4;
    if (provider === 'nanobanana') {
      return model.modelKey === 'gemini-3-pro-image-preview' ? 14 : 3;
    }
    return 1;
  }

  private shouldUseTargetResolutionSelect(model: ImageRegenerationTargetModel) {
    if (model.supportsResolutionSelect === true) return true;
    if (model.supportsResolutionSelect === false) return false;
    const provider = normalizeProviderKey(model.provider);
    return provider === 'nanobanana' && model.modelKey.toLowerCase().includes('pro');
  }

  private shouldUseTargetSizeSelect(model: ImageRegenerationTargetModel) {
    if (model.supportsSizeSelect === true) return true;
    if (model.supportsSizeSelect === false) return false;
    return normalizeProviderKey(model.provider) === 'nanobanana';
  }

  private resolveQwenSize(params: Record<string, unknown>, ratio: RatioParts | null) {
    const sourceSize = asString(params.size);
    if (sourceSize && /^\d+\*\d+$/.test(sourceSize)) return sourceSize;
    if (sourceSize && /^\d+x\d+$/i.test(sourceSize)) return sourceSize.toLowerCase().replace('x', '*');

    const r = ratioToFloat(ratio);
    if (r === null) return undefined;
    if (r < 0.66) return '720*1280';
    if (r < 0.9) return '1024*1536';
    if (r <= 1.12) return '1024*1024';
    if (r <= 1.55) return '1536*1024';
    return '1280*720';
  }

  private resolveGptImageSize(params: Record<string, unknown>, ratio: RatioParts | null) {
    const sourceSize = asString(params.size);
    if (sourceSize && ['1024x1024', '1536x1024', '1024x1536'].includes(sourceSize.toLowerCase())) {
      return sourceSize.toLowerCase();
    }

    const r = ratioToFloat(ratio);
    if (r === null) return undefined;
    if (r < 0.9) return '1024x1536';
    if (r > 1.12) return '1536x1024';
    return '1024x1024';
  }

  private resolveFluxDimensions(params: Record<string, unknown>, ratio: RatioParts | null) {
    const width = asInteger(params.width);
    const height = asInteger(params.height);
    if (width && height && width > 0 && height > 0) return { width, height };

    const r = ratioToFloat(ratio);
    if (r === null || (r >= 0.95 && r <= 1.05)) return { width: 1024, height: 1024 };
    if (r >= 1.7) return { width: 1344, height: 768 };
    if (r <= 0.6) return { width: 768, height: 1344 };
    if (r > 1.2) return { width: 1216, height: 832 };
    return { width: 832, height: 1216 };
  }

  private appendTargetImageInputs(
    targetParams: Record<string, unknown>,
    model: ImageRegenerationTargetModel,
    sourceImages: string[],
  ) {
    if (!this.targetAllowsImageInput(model) || sourceImages.length === 0) return;

    const provider = normalizeProviderKey(model.provider);
    const images = sourceImages.slice(0, this.getTargetImageLimit(model));

    if (provider === 'midjourney') {
      const base64Images = images
        .filter((image) => !isRemoteUrl(image))
        .map(stripDataUrlPrefix)
        .filter(Boolean);
      if (base64Images.length > 0) targetParams.base64Array = base64Images;
      return;
    }

    if (provider === 'gptimage') {
      targetParams.gptImageOperation = 'edits';
      if (images.length === 1) targetParams.image = images[0];
      else targetParams.images = images;
      return;
    }

    if (provider === 'nanobanana') {
      targetParams.images = images;
      targetParams.imageFirst = true;
      return;
    }

    if (provider === 'doubao') {
      targetParams.image = images.length === 1 ? images[0] : images;
      return;
    }

    if (provider === 'qwen') {
      targetParams.images = images;
      return;
    }

    targetParams.imageBase64 = images[0];
  }

  private buildRegenerateParameters(
    sourceTask: ImageTask,
    targetModel: ImageRegenerationTargetModel,
  ): Record<string, unknown> | undefined {
    const sourceParams = this.getTaskParameterRecord(sourceTask);
    const provider = normalizeProviderKey(targetModel.provider);
    const ratio = this.resolveSourceRatio(sourceParams);
    const imageSize = this.resolveImageSize(sourceParams);
    const sourceImages = this.collectRegenerationImages(sourceParams);
    const seed = asInteger(sourceParams.seed);
    const targetParams: Record<string, unknown> = {};

    if (provider === 'qwen') {
      const size = this.resolveQwenSize(sourceParams, ratio);
      if (size) targetParams.size = size;
      targetParams.n = 1;
      targetParams.watermark = false;
    } else if (provider === 'gptimage') {
      const size = this.resolveGptImageSize(sourceParams, ratio);
      if (size) targetParams.size = size;
      targetParams.n = 1;
      targetParams.gptImageOperation = 'generations';
    } else if (provider === 'nanobanana') {
      const aspectRatio = ratioToColon(ratio);
      if (aspectRatio && this.shouldUseTargetSizeSelect(targetModel)) {
        targetParams.aspectRatio = aspectRatio;
      }
      targetParams.responseModalities = ['IMAGE'];
      if (imageSize && this.shouldUseTargetResolutionSelect(targetModel)) {
        targetParams.imageSize = imageSize;
      }
    } else if (provider === 'doubao') {
      if (imageSize) targetParams.size = imageSize;
      targetParams.response_format = 'url';
      targetParams.watermark = false;
      if (seed !== undefined && seed >= -1 && seed <= 2147483647) targetParams.seed = seed;
    } else if (provider === 'midjourney') {
      const aspectRatio = ratioToColon(ratio);
      if (aspectRatio) targetParams.aspectRatio = aspectRatio;

      const botType = asString(sourceParams.botType);
      if (botType) targetParams.botType = botType;

      for (const key of ['version', 'stylize', 'chaos', 'quality', 'weird', 'iw', 'style']) {
        const value = sourceParams[key];
        if (value !== undefined && value !== null && value !== '') targetParams[key] = value;
      }

      const no = asString(sourceParams.no) ?? asString(sourceTask.negativePrompt);
      if (no) targetParams.no = no;
      if (seed !== undefined) targetParams.seed = seed;
      if (sourceParams.tile === true) targetParams.tile = true;
      if (sourceParams.personalize === true) targetParams.personalize = true;
    } else if (provider === 'flux') {
      const dimensions = this.resolveFluxDimensions(sourceParams, ratio);
      targetParams.width = dimensions.width;
      targetParams.height = dimensions.height;
      const steps = asInteger(sourceParams.steps ?? sourceParams.num_inference_steps);
      if (steps !== undefined && steps > 0) targetParams.steps = steps;
      if (seed !== undefined) targetParams.seed = seed;
    } else {
      const aspectRatio = ratioToColon(ratio);
      if (aspectRatio) targetParams.aspectRatio = aspectRatio;
      if (seed !== undefined) targetParams.seed = seed;
    }

    this.appendTargetImageInputs(targetParams, targetModel, sourceImages);

    // Never carry provider operation context across models.
    delete targetParams.mjOperation;
    delete targetParams.taskId;
    delete targetParams.customId;
    delete targetParams.parentTaskId;
    delete targetParams.parentCompletedAt;
    delete targetParams.maskBase64;
    delete targetParams.maskUrl;
    delete targetParams.mask;

    if (provider === 'gptimage' && !targetParams.image && !targetParams.images) {
      targetParams.gptImageOperation = 'generations';
    }

    for (const [key, value] of Object.entries(targetParams)) {
      if (value === undefined || value === null || value === '') {
        delete targetParams[key];
      }
      if (Array.isArray(value) && value.length === 0) {
        delete targetParams[key];
      }
    }

    return Object.keys(targetParams).length > 0 ? targetParams : undefined;
  }

  async generateMany(userId: bigint, dto: ImageGenerateDto, count = 1) {
    const generationCount = Math.trunc(Number(count));
    if (!Number.isInteger(generationCount) || generationCount < 1 || generationCount > 9) {
      throw new BadRequestException('generationCount must be between 1 and 9');
    }

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

    const taskGroupId = this.resolveTaskGroupId(dto.taskGroupId);

    const tasks = await this.prisma.$transaction(async (tx) => {
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
      if (available.total < cost * generationCount) throw new BadRequestException('Insufficient credits');
      const projectId = await this.resolveProjectId(tx, userId, dto.projectId);
      const createdTasks: ImageTask[] = [];

      for (let index = 0; index < generationCount; index += 1) {
        const task = await tx.imageTask.create({
          data: {
            userId,
            modelId: model.id,
            channelId: model.channelId,
            ...(projectId ? { projectId } : {}),
            taskNo: `img_${nanoid(24)}`,
            taskGroupId,
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

        createdTasks.push(updated);
      }

      return createdTasks;
    });

    await Promise.all(
      tasks.map((task) =>
        this.imageQueue.add('generate', { taskId: task.id.toString() }, { jobId: `${task.id.toString()}-${task.retryCount}` }),
      ),
    );

    return tasks.map(serializeImageTask);
  }

  async generate(userId: bigint, dto: ImageGenerateDto) {
    const [task] = await this.generateMany(userId, dto, 1);
    return task;
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

  async regenerate(userId: bigint, id: bigint, dto: RegenerateImageTaskDto) {
    const sourceTask = await this.prisma.imageTask.findUnique({ where: { id } });
    const ownedTask = this.ensureActiveOwnedTask(sourceTask, userId);
    if (ownedTask.status === TaskStatus.pending || ownedTask.status === TaskStatus.processing) {
      throw new BadRequestException('Task is still running');
    }

    let targetModelId: bigint;
    try {
      targetModelId = BigInt(dto.modelId);
    } catch {
      throw new BadRequestException('Invalid modelId');
    }

    const targetModel = await this.prisma.aiModel.findUnique({
      where: { id: targetModelId },
      select: {
        id: true,
        type: true,
        provider: true,
        modelKey: true,
        supportsImageInput: true,
        supportsResolutionSelect: true,
        supportsSizeSelect: true,
        isActive: true,
      },
    });
    if (!targetModel) throw new NotFoundException('Model not found');
    if (!targetModel.isActive) throw new BadRequestException('Model disabled');
    if (targetModel.type !== AiModelType.image) throw new BadRequestException('Model is not image type');

    const parameters = this.buildRegenerateParameters(ownedTask, targetModel);
    return this.generate(userId, {
      modelId: targetModel.id.toString(),
      prompt: ownedTask.prompt,
      negativePrompt: ownedTask.negativePrompt ?? undefined,
      taskGroupId: ownedTask.taskGroupId ?? undefined,
      ...(ownedTask.projectId ? { projectId: ownedTask.projectId.toString(), skipProjectPromptTransform: true } : {}),
      ...(parameters ? { parameters } : {}),
    });
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
          taskGroupId: ownedParent.taskGroupId ?? `task_${ownedParent.id.toString()}`,
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
          taskGroupId: ownedParent.taskGroupId ?? `task_${ownedParent.id.toString()}`,
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
