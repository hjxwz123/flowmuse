import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AiModelType, ApiChannelStatus, Prisma, TaskStatus, UserStatus } from '@prisma/client';
import { nanoid } from 'nanoid';
import { Queue } from 'bullmq';

import { PaginatedResult } from '../common/dto/pagination.dto';
import { CreditsService } from '../credits/credits.service';
import { PrismaService } from '../prisma/prisma.service';
import { RESEARCH_QUEUE } from '../queues/queue-names';
import { CreateResearchTaskDto } from './dto/create-research-task.dto';
import { ResearchTasksQueryDto } from './dto/research-tasks-query.dto';
import { serializeResearchTask } from './research.serializer';

@Injectable()
export class ResearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    @InjectQueue(RESEARCH_QUEUE) private readonly researchQueue: Queue,
  ) {}

  async createTask(userId: bigint, dto: CreateResearchTaskDto) {
    const modelId = this.parseBigInt(dto.modelId, 'modelId');
    const topic = (dto.topic || '').trim();
    const fileIds = this.normalizeFileIds(dto.fileIds);
    const parsedFileIds = fileIds.map((raw) => this.parseBigInt(raw, 'fileId'));

    if (!topic && parsedFileIds.length === 0) {
      throw new BadRequestException('研究主题或文件至少提供一项');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
      if (!user) throw new NotFoundException('User not found');
      if (user.status !== UserStatus.active) throw new ForbiddenException('User is banned');

      const uploadedFiles = parsedFileIds.length > 0
        ? await tx.chatFile.findMany({
            where: {
              id: { in: parsedFileIds },
              userId,
              status: 'ready',
            },
            select: {
              id: true,
              fileName: true,
              extension: true,
              textLength: true,
            },
          })
        : [];

      if (parsedFileIds.length > 0 && uploadedFiles.length !== parsedFileIds.length) {
        throw new BadRequestException('存在无效文件，或文件不属于当前用户');
      }

      const effectiveTopic = topic || this.buildTopicFromFiles(uploadedFiles);

      const model = await tx.aiModel.findUnique({
        where: { id: modelId },
        include: {
          channel: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!model) throw new NotFoundException('Model not found');
      if (!model.isActive) throw new BadRequestException('Model disabled');
      if (model.type !== AiModelType.chat) throw new BadRequestException('Model is not chat type');
      if (model.channel.status !== ApiChannelStatus.active) throw new BadRequestException('Model channel is inactive');

      const cost = Math.max(model.deepResearchCreditsCost ?? model.creditsPerUse ?? 0, 0);
      if (cost > 0) {
        const available = await this.credits.getTotalAvailableCredits(tx, userId);
        if (available.total < cost) throw new BadRequestException('Insufficient credits');
      }

      const taskNo = `rs_${nanoid(24)}`;
      const task = await tx.researchTask.create({
        data: {
          userId,
          modelId: model.id,
          channelId: model.channelId,
          taskNo,
          topic: effectiveTopic,
          status: TaskStatus.pending,
          stage: 'queued',
          progress: 0,
          creditsCost: cost,
          providerData:
            uploadedFiles.length > 0
              ? ({
                  inputFileIds: uploadedFiles.map((item) => item.id.toString()),
                  inputFiles: uploadedFiles.map((item) => ({
                    id: item.id.toString(),
                    fileName: item.fileName,
                    extension: item.extension,
                    textLength: item.textLength,
                  })),
                } as Prisma.InputJsonValue)
              : undefined,
        },
      });

      if (cost <= 0) {
        return task;
      }

      const consumption = await this.credits.consumeCredits(tx, userId, cost, task.id, `Research task ${task.taskNo}`);
      return tx.researchTask.update({
        where: { id: task.id },
        data: {
          creditSource: consumption.creditSource,
        },
      });
    });

    await this.researchQueue.add('run', { taskId: created.id.toString() }, { jobId: `${created.id.toString()}-${created.retryCount}` });

    const withModel = await this.prisma.researchTask.findUnique({
      where: { id: created.id },
      include: {
        model: {
          select: { name: true },
        },
      },
    });

    if (!withModel) {
      throw new NotFoundException('Research task not found');
    }

    return serializeResearchTask(withModel);
  }

  async listTasks(userId: bigint, query: ResearchTasksQueryDto): Promise<PaginatedResult<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.researchTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          model: {
            select: { name: true },
          },
        },
      }),
      this.prisma.researchTask.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map((item) => serializeResearchTask(item)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  async getTask(userId: bigint, idRaw: string) {
    const id = this.parseBigInt(idRaw, 'id');

    const task = await this.prisma.researchTask.findUnique({
      where: { id },
      include: {
        model: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('No access');

    return serializeResearchTask(task);
  }

  async deleteTask(userId: bigint, idRaw: string) {
    const id = this.parseBigInt(idRaw, 'id');

    const task = await this.prisma.researchTask.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        retryCount: true,
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('No access');
    if (task.status === TaskStatus.processing) {
      throw new BadRequestException('Research task is processing and cannot be deleted yet');
    }

    if (task.status === TaskStatus.pending) {
      try {
        await this.researchQueue.remove(`${task.id.toString()}-${task.retryCount}`);
      } catch {
        // Ignore queue removal failures; the processor also guards against missing records.
      }
    }

    await this.prisma.researchTask.delete({ where: { id: task.id } });
    return { ok: true };
  }

  private parseBigInt(raw: string, fieldName: string) {
    try {
      return BigInt(raw);
    } catch {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
  }

  private normalizeFileIds(fileIds?: string[]) {
    if (!Array.isArray(fileIds)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of fileIds) {
      if (typeof raw !== 'string') continue;
      const value = raw.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
      if (out.length >= 20) break;
    }
    return out;
  }

  private buildTopicFromFiles(
    files: Array<{
      fileName: string;
    }>,
  ) {
    if (files.length === 0) return '';
    if (files.length === 1) {
      return `基于文件《${files[0].fileName}》的深度研究`;
    }
    const names = files.slice(0, 2).map((item) => `《${item.fileName}》`).join('、');
    const rest = files.length - 2;
    if (rest > 0) {
      return `基于文件 ${names} 等 ${files.length} 个文件的深度研究`;
    }
    return `基于文件 ${names} 的深度研究`;
  }
}
