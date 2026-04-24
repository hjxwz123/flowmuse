import { Injectable } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';

import { SlicePaginatedResult } from '../common/dto/slice-pagination.dto';
import { serializeImageTask, serializeVideoTask } from '../common/serializers/task.serializer';
import { PrismaService } from '../prisma/prisma.service';
import { serializeResearchTask } from '../research/research.serializer';
import { canCancelVideoTask, supportsVideoTaskCancel } from '../common/utils/video-task-cancel.util';
import { QueryTaskFeedDto } from './dto/query-task-feed.dto';

type FeedRow = {
  type: 'image' | 'video' | 'research';
  id: bigint | number | string;
  createdAt: Date;
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listFeed(
    userId: bigint,
    query: QueryTaskFeedDto,
  ): Promise<SlicePaginatedResult<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const take = limit + 1;
    const statusClause = query.status
      ? Prisma.sql`AND status = ${query.status as TaskStatus}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<FeedRow[]>(Prisma.sql`
      SELECT type, id, createdAt
      FROM (
        SELECT
          'image' AS type,
          image_tasks.id AS id,
          image_tasks.created_at AS createdAt
        FROM image_tasks
        WHERE image_tasks.user_id = ${userId}
          AND image_tasks.deleted_at IS NULL
          ${statusClause}

        UNION ALL

        SELECT
          'video' AS type,
          video_tasks.id AS id,
          video_tasks.created_at AS createdAt
        FROM video_tasks
        WHERE video_tasks.user_id = ${userId}
          ${statusClause}

        UNION ALL

        SELECT
          'research' AS type,
          research_tasks.id AS id,
          research_tasks.created_at AS createdAt
        FROM research_tasks
        WHERE research_tasks.user_id = ${userId}
          ${statusClause}
      ) AS feed_rows
      ORDER BY createdAt DESC, id DESC
      LIMIT ${take}
      OFFSET ${offset}
    `);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    if (pageRows.length === 0) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          hasMore: false,
        },
      };
    }

    const imageIds = pageRows
      .filter((row) => row.type === 'image')
      .map((row) => BigInt(row.id));
    const videoIds = pageRows
      .filter((row) => row.type === 'video')
      .map((row) => BigInt(row.id));
    const researchIds = pageRows
      .filter((row) => row.type === 'research')
      .map((row) => BigInt(row.id));

    const [images, videos, researchTasks] = await Promise.all([
      imageIds.length > 0
        ? this.prisma.imageTask.findMany({
            where: { id: { in: imageIds }, userId, deletedAt: null },
            include: { tool: { select: { title: true } } },
          })
        : Promise.resolve([]),
      videoIds.length > 0
        ? this.prisma.videoTask.findMany({
            where: { id: { in: videoIds }, userId },
            include: {
              tool: { select: { title: true } },
              model: { select: { provider: true, modelKey: true } },
            },
          })
        : Promise.resolve([]),
      researchIds.length > 0
        ? this.prisma.researchTask.findMany({
            where: { id: { in: researchIds }, userId },
            include: { model: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ]);

    const imageMap = new Map(images.map((item) => [item.id.toString(), serializeImageTask(item)]));
    const videoMap = new Map(
      videos.map((item) => [
        item.id.toString(),
        serializeVideoTask(item, {
          canCancel: canCancelVideoTask(item.status, item.model.provider, item.model.modelKey),
          cancelSupported: supportsVideoTaskCancel(item.model.provider, item.model.modelKey),
        }),
      ]),
    );
    const researchMap = new Map(researchTasks.map((item) => [item.id.toString(), serializeResearchTask(item)]));

    const data = pageRows
      .map((row) => {
        const key = BigInt(row.id).toString();
        if (row.type === 'image') return imageMap.get(key) ?? null;
        if (row.type === 'video') return videoMap.get(key) ?? null;
        return researchMap.get(key) ?? null;
      })
      .filter((item) => item !== null);

    return {
      data,
      pagination: {
        page,
        limit,
        hasMore,
      },
    };
  }
}
