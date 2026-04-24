import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TaskStatus } from '@prisma/client';
import { Queue } from 'bullmq';

import { AdapterFactory } from '../../adapters/adapter.factory';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditsService } from '../../credits/credits.service';
import { EncryptionService } from '../../encryption/encryption.service';
import { serializeImageTask, serializeVideoTask, serializeImageTaskLite, serializeVideoTaskLite } from '../../common/serializers/task.serializer';
import { IMAGE_GENERATION_QUEUE, VIDEO_GENERATION_QUEUE } from '../../queues/queue-names';
import { serializeResearchTask } from '../../research/research.serializer';
import { UnifiedTasksQueryDto } from './dto/unified-tasks-query.dto';
import { BatchStatusDto } from './dto/batch-status.dto';
import { BatchDeleteDto } from './dto/batch-delete.dto';

@Injectable()
export class AdminTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly credits: CreditsService,
    @InjectQueue(IMAGE_GENERATION_QUEUE) private readonly imageQueue: Queue,
    @InjectQueue(VIDEO_GENERATION_QUEUE) private readonly videoQueue: Queue,
  ) {}

  async listImages(status?: string) {
    const items = await this.prisma.imageTask.findMany({
      where: status ? { status: status as TaskStatus } : {},
      orderBy: [{ id: 'desc' }],
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });

    return items.map((item) => ({
      ...serializeImageTaskLite(item),
      user: item.user,
    }));
  }

  async listVideos(status?: string) {
    const items = await this.prisma.videoTask.findMany({
      where: status ? { status: status as TaskStatus } : {},
      orderBy: [{ id: 'desc' }],
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });

    return items.map((item) => ({
      ...serializeVideoTaskLite(item),
      user: item.user,
    }));
  }

  async retry(id: bigint, type: 'image' | 'video') {
    if (type === 'video') {
      const updated = await this.prisma.videoTask.update({
        where: { id },
        data: {
          status: TaskStatus.pending,
          retryCount: { increment: 1 },
          errorMessage: null,
          startedAt: null,
          completedAt: null,
        },
      });
      await this.videoQueue.add('generate', { taskId: updated.id.toString() }, { jobId: `${updated.id.toString()}-${updated.retryCount}` });
      return serializeVideoTask(updated);
    }

    const updated = await this.prisma.imageTask.update({
      where: { id },
      data: {
        status: TaskStatus.pending,
        retryCount: { increment: 1 },
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      },
    });
    await this.imageQueue.add('generate', { taskId: updated.id.toString() }, { jobId: `${updated.id.toString()}-${updated.retryCount}` });
    return serializeImageTask(updated);
  }

  async listUnified(query: UnifiedTasksQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const offset = (page - 1) * pageSize;

    const parsed = this.parseFilters(query);

    const items =
      parsed.type === 'image'
        ? await this.queryImageRows(parsed.whereImage, pageSize, offset)
        : parsed.type === 'video'
          ? await this.queryVideoRows(parsed.whereVideo, pageSize, offset)
          : parsed.type === 'research'
            ? await this.queryResearchRows(parsed.whereResearch, pageSize, offset)
            : await this.queryUnionRows(parsed.whereImage, parsed.whereVideo, parsed.whereResearch, pageSize, offset);

    const total =
      parsed.type === 'image'
        ? await this.countImage(parsed.whereImage)
        : parsed.type === 'video'
          ? await this.countVideo(parsed.whereVideo)
          : parsed.type === 'research'
            ? await this.countResearch(parsed.whereResearch)
            : (await this.countImage(parsed.whereImage)) +
              (await this.countVideo(parsed.whereVideo)) +
              (await this.countResearch(parsed.whereResearch));

    return { page, pageSize, total, items };
  }

  async stats(query: UnifiedTasksQueryDto) {
    const parsed = this.parseFilters(query);

    const [imageTotal, videoTotal, researchTotal, imageByStatus, videoByStatus, researchByStatus] = await Promise.all([
      parsed.type === 'video' ? Promise.resolve(0) : this.countImage(parsed.whereImage),
      parsed.type === 'image' ? Promise.resolve(0) : this.countVideo(parsed.whereVideo),
      parsed.type === 'image' || parsed.type === 'video' ? Promise.resolve(0) : this.countResearch(parsed.whereResearch),
      parsed.type === 'video'
        ? Promise.resolve([])
        : this.prisma.imageTask.groupBy({
            by: ['status'],
            where: parsed.whereImagePrisma,
            _count: { _all: true },
          }),
      parsed.type === 'image'
        ? Promise.resolve([])
        : this.prisma.videoTask.groupBy({
            by: ['status'],
            where: parsed.whereVideoPrisma,
            _count: { _all: true },
          }),
      parsed.type === 'image' || parsed.type === 'video'
        ? Promise.resolve([])
        : this.prisma.researchTask.groupBy({
            by: ['status'],
            where: parsed.whereResearchPrisma,
            _count: { _all: true },
          }),
    ]);

    const toMap = (rows: Array<{ status: TaskStatus; _count: { _all: number } }>) => {
      const m: Record<string, number> = { pending: 0, processing: 0, completed: 0, failed: 0 };
      for (const r of rows) m[r.status] = r._count._all;
      return m;
    };

    const image = { total: imageTotal, byStatus: toMap(imageByStatus as any) };
    const video = { total: videoTotal, byStatus: toMap(videoByStatus as any) };
    const research = { total: researchTotal, byStatus: toMap(researchByStatus as any) };

    return {
      totals: { all: imageTotal + videoTotal + researchTotal, image: imageTotal, video: videoTotal, research: researchTotal },
      byStatus: {
        all: {
          pending: image.byStatus.pending + video.byStatus.pending + research.byStatus.pending,
          processing: image.byStatus.processing + video.byStatus.processing + research.byStatus.processing,
          completed: image.byStatus.completed + video.byStatus.completed + research.byStatus.completed,
          failed: image.byStatus.failed + video.byStatus.failed + research.byStatus.failed,
        },
        image: image.byStatus,
        video: video.byStatus,
        research: research.byStatus,
      },
    };
  }

  async detail(id: bigint, type?: 'image' | 'video' | 'research') {
    const resolved = await this.resolveTask(id, type);
    if (resolved.type === 'research') {
      const task = await this.prisma.researchTask.findUnique({
        where: { id },
        include: { user: { select: { id: true, email: true, username: true } }, model: true, channel: true },
      });
      if (!task) throw new NotFoundException('Task not found');
      return {
        task: {
          ...serializeResearchTask(task),
          prompt: task.topic,
          provider: task.model.provider,
          providerTaskId: null,
          negativePrompt: null,
          resultUrl: null,
          thumbnailUrl: null,
          ossKey: null,
          isPublic: false,
        },
        user: task.user,
        model: task.model,
        channel: task.channel,
      };
    }

    if (resolved.type === 'video') {
      const task = await this.prisma.videoTask.findUnique({
        where: { id },
        include: { user: { select: { id: true, email: true, username: true } }, model: true, channel: true },
      });
      if (!task) throw new NotFoundException('Task not found');
      return {
        task: serializeVideoTask(task),
        user: task.user,
        model: task.model,
        channel: task.channel,
      };
    }

    const task = await this.prisma.imageTask.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, username: true } }, model: true, channel: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return {
      task: serializeImageTask(task),
      user: task.user,
      model: task.model,
      channel: task.channel,
    };
  }

  async retryUnified(id: bigint, type?: 'image' | 'video') {
    const resolved = await this.resolveTask(id, type);
    if (resolved.type === 'research') {
      throw new BadRequestException('Research tasks do not support retry from admin tasks');
    }
    return this.retry(id, resolved.type);
  }

  async cancel(id: bigint, type?: 'image' | 'video') {
    const resolved = await this.resolveTask(id, type);

    if (resolved.type === 'video') {
      const task = await this.prisma.videoTask.findUnique({ where: { id } });
      if (!task) throw new NotFoundException('Task not found');
      if (task.status === TaskStatus.completed) throw new BadRequestException('Task already completed');

      await this.tryCancelProvider('video', task.provider, task.channelId, task.modelId, task.providerTaskId ?? null);
      await this.tryRemoveQueueJob('video', task.id.toString(), task.retryCount);

      await this.prisma.$transaction(async (tx) => {
        await tx.videoTask.update({
          where: { id },
          data: { status: TaskStatus.failed, errorMessage: 'CANCELED', completedAt: new Date() },
        });
        await this.credits.refundCredits(tx, task.userId, task.id, `Refund canceled video task ${task.taskNo}`, {
          scopeDescriptionContains: task.taskNo,
          maxRefundAmount: typeof task.creditsCost === 'number' ? Math.max(task.creditsCost, 0) : undefined,
        });
      });

      const updated = await this.prisma.videoTask.findUnique({ where: { id } });
      if (!updated) throw new NotFoundException('Task not found');
      return serializeVideoTask(updated);
    }

    const task = await this.prisma.imageTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status === TaskStatus.completed) throw new BadRequestException('Task already completed');

    await this.tryCancelProvider('image', task.provider, task.channelId, task.modelId, task.providerTaskId ?? null);
    await this.tryRemoveQueueJob('image', task.id.toString(), task.retryCount);

    await this.prisma.$transaction(async (tx) => {
      await tx.imageTask.update({
        where: { id },
        data: { status: TaskStatus.failed, errorMessage: 'CANCELED', completedAt: new Date() },
      });
      await this.credits.refundCredits(tx, task.userId, task.id, `Refund canceled image task ${task.taskNo}`, {
        scopeDescriptionContains: task.taskNo,
        maxRefundAmount: typeof task.creditsCost === 'number' ? Math.max(task.creditsCost, 0) : undefined,
      });
    });

    const updated = await this.prisma.imageTask.findUnique({ where: { id } });
    if (!updated) throw new NotFoundException('Task not found');
    return serializeImageTask(updated);
  }

  async remove(id: bigint, type?: 'image' | 'video' | 'research') {
    const resolved = await this.resolveTask(id, type);
    if (resolved.type === 'research') {
      const task = await this.prisma.researchTask.findUnique({ where: { id } });
      if (!task) throw new NotFoundException('Task not found');
      if (task.status === TaskStatus.processing || task.status === TaskStatus.pending) {
        throw new BadRequestException('Cannot delete a running task; wait for completion or mark it failed first');
      }
      await this.prisma.researchTask.delete({ where: { id } });
      return { ok: true };
    }

    if (resolved.type === 'video') {
      const task = await this.prisma.videoTask.findUnique({ where: { id } });
      if (!task) throw new NotFoundException('Task not found');
      if (task.status === TaskStatus.processing || task.status === TaskStatus.pending) {
        throw new BadRequestException('Cannot delete a running task; cancel first');
      }
      await this.prisma.videoTask.delete({ where: { id } });
      return { ok: true };
    }

    const task = await this.prisma.imageTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status === TaskStatus.processing || task.status === TaskStatus.pending) {
      throw new BadRequestException('Cannot delete a running task; cancel first');
    }
    await this.prisma.imageTask.delete({ where: { id } });
    return { ok: true };
  }

  async batchStatus(dto: BatchStatusDto) {
    const type = dto.type ?? 'auto';
    const parsedIds = dto.ids.map((x) => this.parseBigIntOrThrow(x, 'ids'));

    if (type === 'image') {
      const res = await this.prisma.imageTask.updateMany({
        where: { id: { in: parsedIds } },
        data: { status: dto.status as TaskStatus, ...(dto.errorMessage ? { errorMessage: dto.errorMessage } : {}) },
      });
      return { ok: true, updatedCount: res.count, notFoundIds: [] as string[], ambiguousIds: [] as string[] };
    }

    if (type === 'video') {
      const res = await this.prisma.videoTask.updateMany({
        where: { id: { in: parsedIds } },
        data: { status: dto.status as TaskStatus, ...(dto.errorMessage ? { errorMessage: dto.errorMessage } : {}) },
      });
      return { ok: true, updatedCount: res.count, notFoundIds: [] as string[], ambiguousIds: [] as string[] };
    }

    const [images, videos] = await Promise.all([
      this.prisma.imageTask.findMany({ where: { id: { in: parsedIds } }, select: { id: true } }),
      this.prisma.videoTask.findMany({ where: { id: { in: parsedIds } }, select: { id: true } }),
    ]);
    const imgSet = new Set(images.map((x) => x.id.toString()));
    const vidSet = new Set(videos.map((x) => x.id.toString()));

    const ambiguousIds = dto.ids.filter((idStr) => imgSet.has(idStr) && vidSet.has(idStr));
    const notFoundIds = dto.ids.filter((idStr) => !imgSet.has(idStr) && !vidSet.has(idStr));

    const imageIds = dto.ids.filter((idStr) => imgSet.has(idStr) && !vidSet.has(idStr)).map((x) => BigInt(x));
    const videoIds = dto.ids.filter((idStr) => vidSet.has(idStr) && !imgSet.has(idStr)).map((x) => BigInt(x));

    const [imgRes, vidRes] = await Promise.all([
      imageIds.length
        ? this.prisma.imageTask.updateMany({
            where: { id: { in: imageIds } },
            data: { status: dto.status as TaskStatus, ...(dto.errorMessage ? { errorMessage: dto.errorMessage } : {}) },
          })
        : Promise.resolve({ count: 0 }),
      videoIds.length
        ? this.prisma.videoTask.updateMany({
            where: { id: { in: videoIds } },
            data: { status: dto.status as TaskStatus, ...(dto.errorMessage ? { errorMessage: dto.errorMessage } : {}) },
          })
        : Promise.resolve({ count: 0 }),
    ]);

    return { ok: true, updatedCount: imgRes.count + vidRes.count, notFoundIds, ambiguousIds };
  }

  async batchDelete(dto: BatchDeleteDto) {
    const type = dto.type ?? 'auto';
    const parsedIds = dto.ids.map((x) => this.parseBigIntOrThrow(x, 'ids'));

    const ensureNotRunning = async (t: 'image' | 'video') => {
      if (t === 'image') {
        const running = await this.prisma.imageTask.count({
          where: { id: { in: parsedIds }, status: { in: [TaskStatus.pending, TaskStatus.processing] } },
        });
        if (running) throw new BadRequestException('Cannot batch delete running tasks; cancel first');
        return;
      }
      const running = await this.prisma.videoTask.count({
        where: { id: { in: parsedIds }, status: { in: [TaskStatus.pending, TaskStatus.processing] } },
      });
      if (running) throw new BadRequestException('Cannot batch delete running tasks; cancel first');
    };

    if (type === 'image') {
      await ensureNotRunning('image');
      const res = await this.prisma.imageTask.deleteMany({ where: { id: { in: parsedIds } } });
      return { ok: true, deletedCount: res.count, notFoundIds: [] as string[], ambiguousIds: [] as string[] };
    }

    if (type === 'video') {
      await ensureNotRunning('video');
      const res = await this.prisma.videoTask.deleteMany({ where: { id: { in: parsedIds } } });
      return { ok: true, deletedCount: res.count, notFoundIds: [] as string[], ambiguousIds: [] as string[] };
    }

    const [images, videos] = await Promise.all([
      this.prisma.imageTask.findMany({ where: { id: { in: parsedIds } }, select: { id: true } }),
      this.prisma.videoTask.findMany({ where: { id: { in: parsedIds } }, select: { id: true } }),
    ]);
    const imgSet = new Set(images.map((x) => x.id.toString()));
    const vidSet = new Set(videos.map((x) => x.id.toString()));

    const ambiguousIds = dto.ids.filter((idStr) => imgSet.has(idStr) && vidSet.has(idStr));
    const notFoundIds = dto.ids.filter((idStr) => !imgSet.has(idStr) && !vidSet.has(idStr));

    const imageIds = dto.ids.filter((idStr) => imgSet.has(idStr) && !vidSet.has(idStr)).map((x) => BigInt(x));
    const videoIds = dto.ids.filter((idStr) => vidSet.has(idStr) && !imgSet.has(idStr)).map((x) => BigInt(x));

    if (imageIds.length) {
      const running = await this.prisma.imageTask.count({
        where: { id: { in: imageIds }, status: { in: [TaskStatus.pending, TaskStatus.processing] } },
      });
      if (running) throw new BadRequestException('Cannot batch delete running image tasks; cancel first');
      await this.prisma.imageTask.deleteMany({ where: { id: { in: imageIds } } });
    }
    if (videoIds.length) {
      const running = await this.prisma.videoTask.count({
        where: { id: { in: videoIds }, status: { in: [TaskStatus.pending, TaskStatus.processing] } },
      });
      if (running) throw new BadRequestException('Cannot batch delete running video tasks; cancel first');
      await this.prisma.videoTask.deleteMany({ where: { id: { in: videoIds } } });
    }

    return { ok: true, deletedCount: imageIds.length + videoIds.length, notFoundIds, ambiguousIds };
  }

  private parseFilters(query: UnifiedTasksQueryDto) {
    const type = query.type;

    const whereImage: Prisma.Sql[] = [Prisma.sql`1=1`];
    const whereVideo: Prisma.Sql[] = [Prisma.sql`1=1`];
    const whereResearch: Prisma.Sql[] = [Prisma.sql`1=1`];

    const whereImagePrisma: any = {};
    const whereVideoPrisma: any = {};
    const whereResearchPrisma: any = {};

    if (query.status) {
      whereImage.push(Prisma.sql`status = ${query.status}`);
      whereVideo.push(Prisma.sql`status = ${query.status}`);
      whereResearch.push(Prisma.sql`status = ${query.status}`);
      whereImagePrisma.status = query.status as TaskStatus;
      whereVideoPrisma.status = query.status as TaskStatus;
      whereResearchPrisma.status = query.status as TaskStatus;
    }

    if (query.provider) {
      whereImage.push(Prisma.sql`provider = ${query.provider}`);
      whereVideo.push(Prisma.sql`provider = ${query.provider}`);
      whereResearch.push(Prisma.sql`m.provider = ${query.provider}`);
      whereImagePrisma.provider = query.provider;
      whereVideoPrisma.provider = query.provider;
      whereResearchPrisma.model = { provider: query.provider };
    }

    if (query.userId) {
      const userId = this.parseBigIntOrThrow(query.userId, 'userId');
      whereImage.push(Prisma.sql`user_id = ${userId}`);
      whereVideo.push(Prisma.sql`user_id = ${userId}`);
      whereResearch.push(Prisma.sql`user_id = ${userId}`);
      whereImagePrisma.userId = userId;
      whereVideoPrisma.userId = userId;
      whereResearchPrisma.userId = userId;
    }

    if (query.modelId) {
      const modelId = this.parseBigIntOrThrow(query.modelId, 'modelId');
      whereImage.push(Prisma.sql`model_id = ${modelId}`);
      whereVideo.push(Prisma.sql`model_id = ${modelId}`);
      whereResearch.push(Prisma.sql`model_id = ${modelId}`);
      whereImagePrisma.modelId = modelId;
      whereVideoPrisma.modelId = modelId;
      whereResearchPrisma.modelId = modelId;
    }

    if (query.channelId) {
      const channelId = this.parseBigIntOrThrow(query.channelId, 'channelId');
      whereImage.push(Prisma.sql`channel_id = ${channelId}`);
      whereVideo.push(Prisma.sql`channel_id = ${channelId}`);
      whereResearch.push(Prisma.sql`channel_id = ${channelId}`);
      whereImagePrisma.channelId = channelId;
      whereVideoPrisma.channelId = channelId;
      whereResearchPrisma.channelId = channelId;
    }

    if (query.isPublic) {
      const isPublic = query.isPublic === 'true';
      whereImage.push(Prisma.sql`is_public = ${isPublic ? 1 : 0}`);
      whereVideo.push(Prisma.sql`is_public = ${isPublic ? 1 : 0}`);
      whereImagePrisma.isPublic = isPublic;
      whereVideoPrisma.isPublic = isPublic;
    }

    if (query.q) {
      const like = `%${query.q}%`;
      whereImage.push(Prisma.sql`prompt LIKE ${like}`);
      whereVideo.push(Prisma.sql`prompt LIKE ${like}`);
      whereResearch.push(Prisma.sql`(topic LIKE ${like} OR task_no LIKE ${like})`);
      whereImagePrisma.prompt = { contains: query.q };
      whereVideoPrisma.prompt = { contains: query.q };
      whereResearchPrisma.OR = [{ topic: { contains: query.q } }, { taskNo: { contains: query.q } }];
    }

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && Number.isNaN(from.getTime())) throw new BadRequestException('Invalid from');
    if (to && Number.isNaN(to.getTime())) throw new BadRequestException('Invalid to');
    if (from || to) {
      whereImage.push(Prisma.sql`created_at >= ${from ?? new Date(0)}`);
      whereVideo.push(Prisma.sql`created_at >= ${from ?? new Date(0)}`);
      whereResearch.push(Prisma.sql`created_at >= ${from ?? new Date(0)}`);
      whereImage.push(Prisma.sql`created_at <= ${to ?? new Date('2100-01-01')}`);
      whereVideo.push(Prisma.sql`created_at <= ${to ?? new Date('2100-01-01')}`);
      whereResearch.push(Prisma.sql`created_at <= ${to ?? new Date('2100-01-01')}`);
      whereImagePrisma.createdAt = { gte: from, lte: to };
      whereVideoPrisma.createdAt = { gte: from, lte: to };
      whereResearchPrisma.createdAt = { gte: from, lte: to };
    }

    return {
      type,
      whereImage,
      whereVideo,
      whereResearch,
      whereImagePrisma,
      whereVideoPrisma,
      whereResearchPrisma,
    };
  }

  private parseBigIntOrThrow(value: string, field: string) {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`Invalid ${field}`);
    }
  }

  private async queryUnionRows(whereImage: Prisma.Sql[], whereVideo: Prisma.Sql[], whereResearch: Prisma.Sql[], take: number, offset: number) {
    const rows = (await this.prisma.$queryRaw<any>(Prisma.sql`
      SELECT * FROM (
        SELECT
          'image' AS type,
          id, user_id, model_id, channel_id, task_no,
          provider, provider_task_id,
          prompt, negative_prompt,
          status, result_url, thumbnail_url, oss_key,
          credits_cost, credit_source,
          is_public, error_message, retry_count,
          started_at, completed_at, created_at
        FROM image_tasks
        WHERE ${Prisma.join(whereImage, ' AND ')}
        UNION ALL
        SELECT
          'video' AS type,
          id, user_id, model_id, channel_id, task_no,
          provider, provider_task_id,
          prompt, NULL AS negative_prompt,
          status, result_url, thumbnail_url, oss_key,
          credits_cost, credit_source,
          is_public, error_message, retry_count,
          started_at, completed_at, created_at
        FROM video_tasks
        WHERE ${Prisma.join(whereVideo, ' AND ')}
        UNION ALL
        SELECT
          'research' AS type,
          r.id, r.user_id, r.model_id, r.channel_id, r.task_no,
          m.provider AS provider, NULL AS provider_task_id,
          r.topic AS prompt, NULL AS negative_prompt,
          r.status, NULL AS result_url, NULL AS thumbnail_url, NULL AS oss_key,
          r.credits_cost, r.credit_source,
          0 AS is_public, r.error_message, r.retry_count,
          r.started_at, r.completed_at, r.created_at
        FROM research_tasks r
        INNER JOIN ai_models m ON m.id = r.model_id
        WHERE ${Prisma.join(whereResearch, ' AND ')}
      ) t
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${take} OFFSET ${offset}
    `)) as any[];
    return rows.map(this.mapRawRowToApiTaskLite);
  }

  private async queryImageRows(whereImage: Prisma.Sql[], take: number, offset: number) {
    const rows = (await this.prisma.$queryRaw<any>(Prisma.sql`
      SELECT
        'image' AS type,
        id, user_id, model_id, channel_id, task_no,
        provider, provider_task_id,
        prompt, negative_prompt,
        status, result_url, thumbnail_url, oss_key,
        credits_cost, credit_source,
        is_public, error_message, retry_count,
        started_at, completed_at, created_at
      FROM image_tasks
      WHERE ${Prisma.join(whereImage, ' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT ${take} OFFSET ${offset}
    `)) as any[];
    return rows.map(this.mapRawRowToApiTaskLite);
  }

  private async queryVideoRows(whereVideo: Prisma.Sql[], take: number, offset: number) {
    const rows = (await this.prisma.$queryRaw<any>(Prisma.sql`
      SELECT
        'video' AS type,
        id, user_id, model_id, channel_id, task_no,
        provider, provider_task_id,
        prompt, NULL AS negative_prompt,
        status, result_url, thumbnail_url, oss_key,
        credits_cost, credit_source,
        is_public, error_message, retry_count,
        started_at, completed_at, created_at
      FROM video_tasks
      WHERE ${Prisma.join(whereVideo, ' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT ${take} OFFSET ${offset}
    `)) as any[];
    return rows.map(this.mapRawRowToApiTaskLite);
  }

  private async queryResearchRows(whereResearch: Prisma.Sql[], take: number, offset: number) {
    const rows = (await this.prisma.$queryRaw<any>(Prisma.sql`
      SELECT
        'research' AS type,
        r.id, r.user_id, r.model_id, r.channel_id, r.task_no,
        m.provider AS provider, NULL AS provider_task_id,
        r.topic AS prompt, NULL AS negative_prompt,
        r.status, NULL AS result_url, NULL AS thumbnail_url, NULL AS oss_key,
        r.credits_cost, r.credit_source,
        0 AS is_public, r.error_message, r.retry_count,
        r.started_at, r.completed_at, r.created_at
      FROM research_tasks r
      INNER JOIN ai_models m ON m.id = r.model_id
      WHERE ${Prisma.join(whereResearch, ' AND ')}
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ${take} OFFSET ${offset}
    `)) as any[];
    return rows.map(this.mapRawRowToApiTaskLite);
  }

  private async countImage(whereImage: Prisma.Sql[]) {
    const rows = (await this.prisma.$queryRaw<any>(Prisma.sql`
      SELECT COUNT(*) AS cnt
      FROM image_tasks
      WHERE ${Prisma.join(whereImage, ' AND ')}
    `)) as any[];
    return Number(rows?.[0]?.cnt ?? 0);
  }

  private async countVideo(whereVideo: Prisma.Sql[]) {
    const rows = (await this.prisma.$queryRaw<any>(Prisma.sql`
      SELECT COUNT(*) AS cnt
      FROM video_tasks
      WHERE ${Prisma.join(whereVideo, ' AND ')}
    `)) as any[];
    return Number(rows?.[0]?.cnt ?? 0);
  }

  private async countResearch(whereResearch: Prisma.Sql[]) {
    const rows = (await this.prisma.$queryRaw<any>(Prisma.sql`
      SELECT COUNT(*) AS cnt
      FROM research_tasks r
      INNER JOIN ai_models m ON m.id = r.model_id
      WHERE ${Prisma.join(whereResearch, ' AND ')}
    `)) as any[];
    return Number(rows?.[0]?.cnt ?? 0);
  }

  private mapRawRowToApiTask(row: any) {
    const parseJson = (v: any) => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'object') return v;
      if (typeof v === 'string') {
        const s = v.trim();
        if (!s) return null;
        try {
          return JSON.parse(s);
        } catch {
          return null;
        }
      }
      return null;
    };

    const toStr = (v: any) => (typeof v === 'bigint' ? v.toString() : String(v));
    const toDate = (v: any) => (v ? new Date(v) : null);

    return {
      type: row.type,
      id: toStr(row.id),
      userId: toStr(row.user_id),
      modelId: toStr(row.model_id),
      channelId: toStr(row.channel_id),
      taskNo: row.task_no,
      provider: row.provider,
      providerTaskId: row.provider_task_id ?? null,
      prompt: row.prompt,
      negativePrompt: row.negative_prompt ?? null,
      parameters: parseJson(row.parameters),
      providerData: parseJson(row.provider_data),
      status: row.status,
      resultUrl: row.result_url ?? null,
      thumbnailUrl: row.thumbnail_url ?? null,
      ossKey: row.oss_key ?? null,
      creditsCost: row.credits_cost ?? null,
      creditSource: row.credit_source ?? null,
      isPublic: Boolean(row.is_public),
      errorMessage: row.error_message ?? null,
      retryCount: Number(row.retry_count ?? 0),
      startedAt: toDate(row.started_at),
      completedAt: toDate(row.completed_at),
      createdAt: new Date(row.created_at),
    };
  }

  private mapRawRowToApiTaskLite(row: any) {
    const toStr = (v: any) => (typeof v === 'bigint' ? v.toString() : String(v));
    const toDate = (v: any) => (v ? new Date(v) : null);

    return {
      type: row.type,
      id: toStr(row.id),
      userId: toStr(row.user_id),
      modelId: toStr(row.model_id),
      channelId: toStr(row.channel_id),
      taskNo: row.task_no,
      provider: row.provider,
      providerTaskId: row.provider_task_id ?? null,
      prompt: row.prompt,
      negativePrompt: row.negative_prompt ?? null,
      status: row.status,
      resultUrl: row.result_url ?? null,
      thumbnailUrl: row.thumbnail_url ?? null,
      ossKey: row.oss_key ?? null,
      creditsCost: row.credits_cost ?? null,
      creditSource: row.credit_source ?? null,
      isPublic: Boolean(row.is_public),
      errorMessage: row.error_message ?? null,
      retryCount: Number(row.retry_count ?? 0),
      startedAt: toDate(row.started_at),
      completedAt: toDate(row.completed_at),
      createdAt: new Date(row.created_at),
    };
  }

  private async resolveTask(id: bigint, type?: 'image' | 'video' | 'research') {
    if (type === 'image') {
      const exists = await this.prisma.imageTask.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundException('Task not found');
      return { type: 'image' as const };
    }
    if (type === 'video') {
      const exists = await this.prisma.videoTask.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundException('Task not found');
      return { type: 'video' as const };
    }
    if (type === 'research') {
      const exists = await this.prisma.researchTask.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundException('Task not found');
      return { type: 'research' as const };
    }

    const [img, vid, research] = await Promise.all([
      this.prisma.imageTask.findUnique({ where: { id }, select: { id: true } }),
      this.prisma.videoTask.findUnique({ where: { id }, select: { id: true } }),
      this.prisma.researchTask.findUnique({ where: { id }, select: { id: true } }),
    ]);
    const matched = [img ? 'image' : null, vid ? 'video' : null, research ? 'research' : null].filter(Boolean);
    if (matched.length > 1) throw new BadRequestException('Ambiguous task id; specify type');
    if (img) return { type: 'image' as const };
    if (vid) return { type: 'video' as const };
    if (research) return { type: 'research' as const };
    throw new NotFoundException('Task not found');
  }

  private async tryRemoveQueueJob(type: 'image' | 'video', taskIdStr: string, retryCount: number) {
    const jobId = `${taskIdStr}:${retryCount}`;
    try {
      if (type === 'video') await this.videoQueue.remove(jobId);
      else await this.imageQueue.remove(jobId);
    } catch {
      // best-effort
    }
  }

  private async tryCancelProvider(
    type: 'image' | 'video',
    provider: string,
    channelId: bigint,
    modelId: bigint,
    providerTaskId: string | null,
  ) {
    if (!providerTaskId) return;
    try {
      const [channel, model] = await Promise.all([
        this.prisma.apiChannel.findUnique({ where: { id: channelId } }),
        this.prisma.aiModel.findUnique({ where: { id: modelId } }),
      ]);
      if (!channel || !model) return;

      const decryptedChannel = {
        ...channel,
        apiKey: this.encryption.decryptString(channel.apiKey),
        apiSecret: this.encryption.decryptString(channel.apiSecret),
      };

      if (type === 'video') {
        const adapter = AdapterFactory.createVideoAdapter(provider, decryptedChannel as any);
        await adapter.cancelTask(providerTaskId);
        return;
      }

      const adapter = AdapterFactory.createImageAdapter(provider, decryptedChannel as any);
      await adapter.cancelTask(providerTaskId);
    } catch {
      // best-effort
    }
  }
}
