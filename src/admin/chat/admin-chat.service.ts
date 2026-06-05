import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AiModelType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ListConversationsDto } from './dto/list-conversations.dto';

@Injectable()
export class AdminChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversations(query: ListConversationsDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.ChatConversationWhereInput = {};

    const userId = this.parseBigInt(query.userId, 'userId');
    if (userId !== null) {
      where.userId = userId;
    }

    const modelId = this.parseBigInt(query.modelId, 'modelId');
    if (modelId !== null) {
      where.modelId = modelId;
    }

    const keyword = (query.q ?? '').trim();
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { messages: { some: { content: { contains: keyword } } } },
        { user: { is: { email: { contains: keyword } } } },
        { user: { is: { username: { contains: keyword } } } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.chatConversation.count({ where }),
      this.prisma.chatConversation.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
          model: {
            select: {
              id: true,
              name: true,
              provider: true,
              modelKey: true,
              icon: true,
              type: true,
              isActive: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              role: true,
              content: true,
              images: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      items: rows.map((row) => {
        const latest = row.messages[0];
        return {
          id: row.id.toString(),
          title: row.title,
          isPinned: row.isPinned,
          user: {
            id: row.user.id.toString(),
            email: row.user.email,
            username: row.user.username,
          },
          model: row.model ? this.mapModel(row.model) : null,
          messageCount: row._count.messages,
          lastMessagePreview: this.buildPreviewText(latest?.content ?? '', latest?.images ?? null),
          lastMessageAt: latest?.createdAt ?? row.lastMessageAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      }),
    };
  }

  async getConversationMessages(conversationIdRaw: string) {
    const conversationId = this.requireBigInt(conversationIdRaw, 'conversationId');

    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        model: {
          select: {
            id: true,
            name: true,
            provider: true,
            modelKey: true,
            icon: true,
            type: true,
            isActive: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      conversation: {
        id: conversation.id.toString(),
        title: conversation.title,
        isPinned: conversation.isPinned,
        user: {
          id: conversation.user.id.toString(),
          email: conversation.user.email,
          username: conversation.user.username,
        },
        model: conversation.model ? this.mapModel(conversation.model) : null,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: messages.map((msg) => ({
        id: msg.id.toString(),
        conversationId: msg.conversationId.toString(),
        userId: msg.userId.toString(),
        role: msg.role,
        content: msg.content,
        images: this.extractImages(msg.images),
        createdAt: msg.createdAt,
      })),
    };
  }

  async removeConversation(conversationIdRaw: string) {
    const conversationId = this.requireBigInt(conversationIdRaw, 'conversationId');

    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.chatConversation.delete({
      where: { id: conversationId },
    });

    return {
      ok: true,
      id: conversation.id.toString(),
      title: conversation.title,
    };
  }

  private buildPreviewText(content: string, images: Prisma.JsonValue | null) {
    const text = content.trim();
    if (text) return text.length > 80 ? `${text.slice(0, 80)}...` : text;

    const imageCount = this.extractImages(images).length;
    if (imageCount > 0) {
      return imageCount > 1 ? `[${imageCount} images]` : '[image]';
    }
    return '';
  }

  private mapModel(model: {
    id: bigint;
    name: string;
    provider: string;
    modelKey: string;
    icon: string | null;
    type: AiModelType;
    isActive: boolean;
  }) {
    return {
      id: model.id.toString(),
      name: model.name,
      provider: model.provider,
      modelKey: model.modelKey,
      icon: model.icon,
      type: model.type,
      isActive: model.isActive,
    };
  }

  private extractImages(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => Boolean(item));
  }

  private parseBigInt(raw: string | undefined, fieldName: string): bigint | null {
    if (!raw) return null;
    try {
      return BigInt(raw);
    } catch {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
  }

  private requireBigInt(raw: string, fieldName: string): bigint {
    try {
      return BigInt(raw);
    } catch {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
  }
}
