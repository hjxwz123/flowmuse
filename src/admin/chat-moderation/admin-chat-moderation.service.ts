import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ChatModerationLogsQueryDto } from './dto/chat-moderation-logs-query.dto';

type UnifiedModerationSource = 'chat' | 'image_generate' | 'prompt_optimize';

type InputModerationRow = {
  id: bigint;
  source: string;
  scene: string;
  content: string;
  reason: string | null;
  providerModel: string | null;
  providerResponse: string | null;
  createdAt: Date;
  taskId: bigint | null;
  taskNo: string | null;
  userId: bigint;
  userEmail: string;
  userUsername: string | null;
  modelId: bigint | null;
  modelName: string | null;
  modelKey: string | null;
  modelProvider: string | null;
};

type InputModerationCountRow = {
  total: bigint | number;
};

@Injectable()
export class AdminChatModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async listLogs(query: ChatModerationLogsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, query.limit ?? 20));
    const skip = (page - 1) * pageSize;
    const fetchSize = page * pageSize;
    const keyword = (query.q || '').trim();
    const source = query.source ?? 'all';
    const includeChat = source === 'all' || source === 'chat';
    const includeInput = source === 'all' || source === 'image_generate' || source === 'prompt_optimize';

    const chatWhere: Prisma.ChatModerationLogWhereInput = keyword
      ? {
          OR: [
            { content: { contains: keyword } },
            { reason: { contains: keyword } },
            { providerModel: { contains: keyword } },
            { providerResponse: { contains: keyword } },
            {
              user: {
                OR: [{ email: { contains: keyword } }, { username: { contains: keyword } }],
              },
            },
            {
              conversation: {
                title: { contains: keyword },
              },
            },
          ],
        }
      : {};

    const [chatItems, chatTotal, inputItems, inputTotal] = await Promise.all([
      includeChat
        ? this.prisma.chatModerationLog.findMany({
            where: chatWhere,
            include: {
              user: { select: { id: true, email: true, username: true } },
              conversation: { select: { id: true, title: true } },
              model: { select: { id: true, name: true, modelKey: true, provider: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: fetchSize,
          })
        : Promise.resolve([]),
      includeChat ? this.prisma.chatModerationLog.count({ where: chatWhere }) : Promise.resolve(0),
      includeInput ? this.queryInputModerationRows(fetchSize, keyword, source) : Promise.resolve([]),
      includeInput ? this.countInputModerationRows(keyword, source) : Promise.resolve(0),
    ]);

    const items = [
      ...chatItems.map((item) => ({
        id: item.id.toString(),
        source: 'chat' as const,
        scene: 'chat_message',
        content: item.content,
        reason: item.reason ?? null,
        providerModel: item.providerModel ?? null,
        providerResponse: item.providerResponse ?? null,
        createdAt: item.createdAt,
        user: {
          id: item.user.id.toString(),
          email: item.user.email,
          username: item.user.username,
        },
        conversation: item.conversation
          ? {
              id: item.conversation.id.toString(),
              title: item.conversation.title,
            }
          : null,
        task: null,
        model: {
          id: item.model.id.toString(),
          name: item.model.name,
          modelKey: item.model.modelKey,
          provider: item.model.provider,
        },
      })),
      ...inputItems.map((item) => ({
        id: item.id.toString(),
        source: this.normalizeSource(item.source),
        scene: item.scene,
        content: item.content,
        reason: item.reason ?? null,
        providerModel: item.providerModel ?? null,
        providerResponse: item.providerResponse ?? null,
        createdAt: item.createdAt,
        user: {
          id: item.userId.toString(),
          email: item.userEmail,
          username: item.userUsername,
        },
        conversation: null,
        task:
          item.taskId || item.taskNo
            ? {
                id: item.taskId?.toString() ?? null,
                taskNo: item.taskNo ?? null,
              }
            : null,
        model:
          item.modelId && item.modelName && item.modelKey && item.modelProvider
            ? {
                id: item.modelId.toString(),
                name: item.modelName,
                modelKey: item.modelKey,
                provider: item.modelProvider,
              }
            : null,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(skip, skip + pageSize);

    return {
      page,
      pageSize,
      total: chatTotal + inputTotal,
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt,
      })),
    };
  }

  private async queryInputModerationRows(
    take: number,
    keyword: string,
    source: ChatModerationLogsQueryDto['source'],
  ): Promise<InputModerationRow[]> {
    try {
      const whereClause = this.buildInputModerationWhereClause(keyword, source);

      return await this.prisma.$queryRaw<InputModerationRow[]>(Prisma.sql`
        SELECT
          l.id AS id,
          l.source AS source,
          l.scene AS scene,
          l.content AS content,
          l.reason AS reason,
          l.provider_model AS providerModel,
          l.provider_response AS providerResponse,
          l.created_at AS createdAt,
          l.task_id AS taskId,
          l.task_no AS taskNo,
          u.id AS userId,
          u.email AS userEmail,
          u.username AS userUsername,
          m.id AS modelId,
          m.name AS modelName,
          m.model_key AS modelKey,
          m.provider AS modelProvider
        FROM input_moderation_logs l
        INNER JOIN users u ON u.id = l.user_id
        LEFT JOIN ai_models m ON m.id = l.model_id
        ${whereClause}
        ORDER BY l.created_at DESC
        LIMIT ${take}
      `);
    } catch (error) {
      if (this.isMissingInputModerationTable(error)) {
        return [];
      }
      throw error;
    }
  }

  private async countInputModerationRows(keyword: string, source: ChatModerationLogsQueryDto['source']) {
    try {
      const whereClause = this.buildInputModerationWhereClause(keyword, source);
      const rows = await this.prisma.$queryRaw<InputModerationCountRow[]>(Prisma.sql`
        SELECT COUNT(*) AS total
        FROM input_moderation_logs l
        INNER JOIN users u ON u.id = l.user_id
        LEFT JOIN ai_models m ON m.id = l.model_id
        ${whereClause}
      `);

      const total = rows[0]?.total ?? 0;
      return typeof total === 'bigint' ? Number(total) : Number(total);
    } catch (error) {
      if (this.isMissingInputModerationTable(error)) {
        return 0;
      }
      throw error;
    }
  }

  private buildInputModerationWhereClause(
    keyword: string,
    source: ChatModerationLogsQueryDto['source'],
  ) {
    const clauses: Prisma.Sql[] = [];

    if (source === 'image_generate' || source === 'prompt_optimize') {
      clauses.push(Prisma.sql`l.source = ${source}`);
    }

    if (keyword) {
      const search = `%${keyword}%`;
      clauses.push(Prisma.sql`
        (
          l.content LIKE ${search}
          OR l.reason LIKE ${search}
          OR l.provider_model LIKE ${search}
          OR l.provider_response LIKE ${search}
          OR l.scene LIKE ${search}
          OR l.task_no LIKE ${search}
          OR u.email LIKE ${search}
          OR u.username LIKE ${search}
          OR m.name LIKE ${search}
          OR m.model_key LIKE ${search}
        )
      `);
    }

    if (clauses.length === 0) {
      return Prisma.empty;
    }

    return Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
  }

  private normalizeSource(source: string): UnifiedModerationSource {
    if (source === 'prompt_optimize') return 'prompt_optimize';
    return 'image_generate';
  }

  private isMissingInputModerationTable(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const message = JSON.stringify(error.meta ?? {});
      return error.code === 'P2010' && message.includes('input_moderation_logs');
    }

    return error instanceof Error && error.message.includes('input_moderation_logs');
  }
}
