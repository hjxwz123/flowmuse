import { BadRequestException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AiModel, AiModelType, ApiChannelStatus, ChatFile, ChatMessageRole, Prisma, ProjectAssetKind, TaskStatus, UserRole, UserStatus } from '@prisma/client';
import axios from 'axios';
import { Response } from 'express';

import { AuthUserCacheService } from '../auth/auth-user-cache.service';
import { buildBanErrorPayload, calculateBanExpireAt } from '../auth/ban.utils';
import { toBeijingDateKey } from '../common/utils/date-only.util';
import { EncryptionService } from '../encryption/encryption.service';
import { ImagesService } from '../images/images.service';
import { ModerationCounterService } from '../moderation/moderation-counter.service';
import { MembershipChatModelQuotasService } from '../memberships/membership-chat-model-quotas.service';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { PROJECT_MASTER_IMAGE_PROMPT_TITLE } from '../projects/project-prompt.constants';
import { RedisService } from '../redis/redis.service';
import { AiSettingsService } from '../settings/ai-settings.service';
import { DEFAULT_PUBLIC_SETTINGS } from '../settings/system-settings.constants';
import { SystemSettingsService } from '../settings/system-settings.service';
import { normalizeUploadedFileName } from '../common/utils/upload-filename.util';
import {
  attachAutoProjectAssetMetadata,
  extractAutoProjectAssetMetadata,
  type AutoProjectTaskAssetMetadata,
} from '../common/utils/task-provider-data.util';
import { normalizeProviderKey } from '../common/utils/provider.util';
import { canCancelVideoTask, supportsVideoTaskCancel } from '../common/utils/video-task-cancel.util';
import { isWanxProvider, resolveWanxSiblingVideoModelKey, resolveWanxVideoModelKind } from '../common/utils/wanx-model.util';
import { buildModelCapabilities } from '../models/model-capabilities';
import { ChatFileParserService } from './chat-file-parser.service';
import {
  buildChatImageTaskParameters,
  buildChatVideoTaskParameters,
} from './chat-media-task-params';
import {
  extractAutoProjectAgentFromProviderData,
  parseAutoProjectAgentContext,
} from './auto-project-workflow.metadata';
import { AutoProjectWorkflowService } from './auto-project-workflow.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateChatImageTaskDto } from './dto/create-chat-image-task.dto';
import { CreateChatVideoTaskDto } from './dto/create-chat-video-task.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { WebSearchService, type WebSearchHit } from './web-search.service';
import { VideosService } from '../videos/videos.service';

type UpstreamMessagePart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type UpstreamMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | UpstreamMessagePart[];
};

type ChatFileAttachment = {
  id: string;
  fileName: string;
  extension: string;
  mimeType: string;
  fileSize: number;
};

type ChatCitation = {
  type: 'file' | 'web';
  fileId?: string;
  fileName?: string;
  extension?: string;
  title?: string;
  url?: string;
  domain?: string;
  publishedAt?: string | null;
  snippet: string;
  score?: number;
  chunkIndex?: number;
};

type ChatTaskRef = {
  kind: 'image' | 'video';
  taskId: string;
  taskNo?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  shotId?: string;
  finalStoryboard?: boolean;
  modelId?: string;
  provider?: string;
  prompt?: string;
  thumbnailUrl?: string | null;
  resultUrl?: string | null;
  errorMessage?: string | null;
  creditsCost?: number | null;
  createdAt?: string;
  completedAt?: string | null;
  canCancel?: boolean;
  cancelSupported?: boolean;
};

type FileContextBuildResult = {
  systemMessage: string;
  attachments: ChatFileAttachment[];
  citations: ChatCitation[];
};

type WebSearchContextBuildResult = {
  systemMessage: string;
  citations: ChatCitation[];
};

type ChatFileRuntimeSettings = {
  enabled: boolean;
  maxFilesPerMessage: number;
  maxFileSizeMb: number;
  maxExtractChars: number;
  contextMode: 'full' | 'retrieval';
  retrievalTopK: number;
  chunkSize: number;
  chunkOverlap: number;
  retrievalMaxChars: number;
  allowedExtensions: string[];
};

type WebSearchRuntimeSettings = {
  enabled: boolean;
  baseUrl: string;
  mode: 'off' | 'auto' | 'always';
  language: string;
  categories: string;
  safeSearch: number;
  timeRange: '' | 'day' | 'week' | 'month' | 'year';
  topK: number;
  timeoutMs: number;
  blockedDomains: string[];
};

type WebSearchProgress = {
  stage: 'planning' | 'searching' | 'summarizing';
  message: string;
  searchedQueries?: number;
  totalQueries?: number;
  searchedArticles?: number;
  totalArticles?: number;
};

type ChatModerationCheckResult = {
  passed: boolean;
  reason: string | null;
  providerModel: string | null;
  providerResponse: string | null;
};

type ChatModerationAutoBanResult = {
  matchedRule: {
    triggerCount: number;
    banDays: number;
  };
  totalBlockedCount: number;
  banReason: string;
  banExpireAt: Date;
};

type MediaAgentContext = {
  enabled: boolean;
  modelId: string;
  preferredAspectRatio?: string | null;
  preferredResolution?: string | null;
  preferredDuration?: string | null;
  referenceImages: string[];
  referenceVideos: string[];
  referenceAudios: string[];
  autoCreate: boolean;
};

type MediaAgentStatus = 'clarify' | 'ready';
type MediaAgentIntent = 'edit' | 'generate';

type MediaAgentMetadata = {
  status: MediaAgentStatus;
  intent: MediaAgentIntent;
  optimizedPrompt: string | null;
  negativePrompt: string | null;
  suggestedReplies: string[];
  sourceUserMessageId: string;
  modelId: string;
  modelName: string;
  modelType: 'image' | 'video';
  preferredAspectRatio: string | null;
  preferredResolution: string | null;
  preferredDuration: string | null;
  referenceVideos: string[];
  referenceAudios: string[];
  referenceImageCount: number;
  referenceVideoCount: number;
  referenceAudioCount: number;
  autoCreated: boolean;
};

type ParsedMediaAgentResponse = {
  reply: string;
  status: MediaAgentStatus;
  intent: MediaAgentIntent;
  optimizedPrompt: string | null;
  negativePrompt: string | null;
  suggestedReplies: string[];
};

type ConversationComposerMode = 'chat' | 'image' | 'auto';

type DailyQuestionQuotaReservation = {
  commit: () => void;
  rollback: () => Promise<void>;
};

@Injectable()
export class ChatService {
  private static readonly DEFAULT_TITLE = 'New Chat';
  private static readonly WEB_SEARCH_TASK_QUERY_COUNT = 3;
  private static readonly WEB_SEARCH_TASK_MAX_QUERY_COUNT = 6;
  private static readonly WEB_SEARCH_INJECT_PAGE_CHARS = 1600;
  private static readonly WEB_SEARCH_TASK_FILE_CONTEXT_MAX_CHARS = 5000;
  private static readonly PROJECT_CONTEXT_MAX_ASSET_ITEMS = 20;
  private static readonly PROJECT_CONTEXT_MAX_DOCUMENT_ITEMS = 4;
  private static readonly PROJECT_CONTEXT_MAX_INSPIRATION_ITEMS = 8;
  private static readonly PROJECT_CONTEXT_MAX_PROMPT_ITEMS = 8;
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly authUserCache: AuthUserCacheService,
    private readonly encryption: EncryptionService,
    private readonly settings: SystemSettingsService,
    private readonly aiSettings: AiSettingsService,
    private readonly moderationCounters: ModerationCounterService,
    private readonly chatFileParser: ChatFileParserService,
    private readonly webSearch: WebSearchService,
    private readonly imagesService: ImagesService,
    private readonly videosService: VideosService,
    private readonly autoProjectWorkflow: AutoProjectWorkflowService,
    private readonly membershipChatModelQuotas: MembershipChatModelQuotasService,
    private readonly memberships: MembershipsService,
  ) {}

  async listConversations(userId: bigint, q?: string) {
    const keyword = this.normalizeSearchKeyword(q);
    const where: Prisma.ChatConversationWhereInput = {
      userId,
      model: { is: { type: AiModelType.chat } },
    };

    if (keyword) {
      where.title = { contains: keyword };
    }

    const rows = await this.prisma.chatConversation.findMany({
      where,
      include: {
        model: {
          select: {
            id: true,
            name: true,
            icon: true,
            type: true,
            supportsImageInput: true,
            isActive: true,
          },
        },
        projectContext: {
          select: {
            id: true,
            name: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, role: true, content: true, images: true, files: true, createdAt: true },
        },
      },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });

    return rows.map((row) => this.mapConversationSummary(row));
  }

  async createConversation(userId: bigint, dto: CreateConversationDto) {
    const modelId = this.parseBigInt(dto.modelId, 'modelId');

    const model = await this.prisma.aiModel.findFirst({
      where: {
        id: modelId,
        type: AiModelType.chat,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        icon: true,
        type: true,
        supportsImageInput: true,
        isActive: true,
      },
    });

    if (!model) {
      throw new BadRequestException('Chat model not found or inactive');
    }

    const now = new Date();
    const title = this.normalizeTitle(dto.title) ?? ChatService.DEFAULT_TITLE;

    const row = await this.prisma.chatConversation.create({
      data: {
        userId,
        modelId,
        title,
        lastMessageAt: now,
      },
      include: {
        model: {
          select: {
            id: true,
            name: true,
            icon: true,
            type: true,
            supportsImageInput: true,
            isActive: true,
          },
        },
      },
    });

    return this.mapConversationSummary({ ...row, messages: [] });
  }

  async removeConversation(userId: bigint, conversationIdRaw: string) {
    const conversationId = this.parseBigInt(conversationIdRaw, 'conversationId');
    await this.requireConversation(userId, conversationId);

    await this.prisma.chatConversation.delete({ where: { id: conversationId } });
    return { ok: true };
  }

  async updateConversation(userId: bigint, conversationIdRaw: string, dto: UpdateConversationDto) {
    const conversationId = this.parseBigInt(conversationIdRaw, 'conversationId');
    const conversation = await this.requireConversation(userId, conversationId);

    const data: Prisma.ChatConversationUpdateInput = {};

    if (dto.modelId !== undefined) {
      const nextModelId = this.parseBigInt(dto.modelId, 'modelId');
      if (nextModelId !== conversation.model.id) {
        const nextModel = await this.prisma.aiModel.findFirst({
          where: {
            id: nextModelId,
            type: AiModelType.chat,
            isActive: true,
          },
          select: { id: true },
        });
        if (!nextModel) {
          throw new BadRequestException('Chat model not found or inactive');
        }
        data.model = { connect: { id: nextModel.id } };
      }
    }

    if (dto.title !== undefined) {
      const nextTitle = this.normalizeTitle(dto.title);
      if (!nextTitle) {
        throw new BadRequestException('title cannot be empty');
      }
      data.title = nextTitle;
    }

    if (dto.isPinned !== undefined) {
      data.isPinned = dto.isPinned;
    }

    if (dto.clearProjectContext === true && conversation.projectContext) {
      data.projectContext = { disconnect: true };
    } else if (dto.projectContextId !== undefined) {
      const nextProjectId = this.parseBigInt(dto.projectContextId, 'projectContextId');
      if (nextProjectId !== conversation.projectContext?.id) {
        const project = await this.prisma.project.findFirst({
          where: {
            id: nextProjectId,
            userId,
          },
          select: { id: true },
        });
        if (!project) {
          throw new BadRequestException('Project not found');
        }
        data.projectContext = { connect: { id: project.id } };
      }
    }

    if (!Object.keys(data).length) {
      const latest = await this.prisma.chatMessage.findFirst({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        select: {
          content: true,
          images: true,
          files: true,
          createdAt: true,
        },
      });
      return this.mapConversationSummary({
        ...conversation,
        messages: latest ? [latest] : [],
      });
    }

    const updated = await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data,
      include: {
        model: {
          select: {
            id: true,
            name: true,
            icon: true,
            type: true,
            supportsImageInput: true,
            isActive: true,
          },
        },
        projectContext: {
          select: {
            id: true,
            name: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, role: true, content: true, images: true, files: true, createdAt: true },
        },
      },
    });

    return this.mapConversationSummary(updated);
  }

  async getMessages(userId: bigint, conversationIdRaw: string) {
    const conversationId = this.parseBigInt(conversationIdRaw, 'conversationId');
    const conversation = await this.requireConversation(userId, conversationId);

    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    const mappedMessages = messages.map((msg) => this.mapMessage(msg));
    const hydratedMessages = await this.hydrateTaskRefsForMessages(userId, mappedMessages);

    return {
      conversation: this.mapConversationSummary({ ...conversation, messages: [] }),
      messages: hydratedMessages,
    };
  }

  async removeMessageTurn(userId: bigint, conversationIdRaw: string, messageIdRaw: string) {
    const conversationId = this.parseBigInt(conversationIdRaw, 'conversationId');
    const conversation = await this.requireConversation(userId, conversationId);
    const messageId = this.parseBigInt(messageIdRaw, 'messageId');

    const timeline = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        role: true,
      },
    });

    const currentIndex = timeline.findIndex((item) => item.id === messageId);
    if (currentIndex < 0) {
      throw new NotFoundException('Message not found');
    }

    const pivot = timeline[currentIndex];
    if (pivot.role !== ChatMessageRole.user) {
      throw new BadRequestException('Only user message can be used to remove a turn');
    }

    const deleteIds: bigint[] = [pivot.id];
    for (let idx = currentIndex + 1; idx < timeline.length; idx += 1) {
      const candidate = timeline[idx];
      if (candidate.role === ChatMessageRole.user) {
        break;
      }
      if (candidate.role === ChatMessageRole.assistant || candidate.role === ChatMessageRole.system) {
        deleteIds.push(candidate.id);
      }
    }

    const updatedConversation = await this.prisma.$transaction(async (tx) => {
      await tx.chatMessage.deleteMany({
        where: {
          conversationId,
          id: { in: deleteIds },
        },
      });

      const remainingMessages = await tx.chatMessage.findMany({
        where: { conversationId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          createdAt: true,
          providerData: true,
        },
      });
      const latest = remainingMessages[remainingMessages.length - 1];

      return tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: latest?.createdAt ?? conversation.createdAt,
          composerMode: this.resolveComposerModeLockFromMessages(remainingMessages),
        },
        include: {
          model: {
            select: {
              id: true,
              name: true,
              icon: true,
              type: true,
              supportsImageInput: true,
              isActive: true,
            },
          },
          projectContext: {
            select: {
              id: true,
              name: true,
            },
          },
          messages: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: { id: true, role: true, content: true, images: true, files: true, createdAt: true },
          },
        },
      });
    });

    return {
      ok: true,
      deletedMessageIds: deleteIds.map((id) => id.toString()),
      conversation: this.mapConversationSummary(updatedConversation),
    };
  }

  async uploadFiles(userId: bigint, conversationIdRaw: string, files: Express.Multer.File[]) {
    const conversationId = this.parseBigInt(conversationIdRaw, 'conversationId');
    await this.requireConversation(userId, conversationId);

    const settings = await this.getChatFileRuntimeSettings();

    if (!settings.enabled) {
      throw new BadRequestException('管理员已关闭聊天文件上传功能');
    }
    if (!Array.isArray(files) || files.length === 0) {
      throw new BadRequestException('请至少上传一个文件');
    }

    if (files.length > settings.maxFilesPerMessage) {
      throw new BadRequestException(`单次最多上传 ${settings.maxFilesPerMessage} 个文件`);
    }

    const acceptedExtSet = new Set(settings.allowedExtensions);
    const uploaded = [];

    for (const file of files) {
      const fileSize = file.size ?? 0;
      const maxBytes = settings.maxFileSizeMb * 1024 * 1024;
      if (fileSize > maxBytes) {
        throw new BadRequestException(
          `文件 ${normalizeUploadedFileName(file.originalname)} 超过大小限制（${settings.maxFileSizeMb}MB）`,
        );
      }

      const parsed = await this.chatFileParser.parse(file, settings.maxExtractChars);
      if (!acceptedExtSet.has(parsed.extension)) {
        throw new BadRequestException(`文件 ${parsed.fileName} 的扩展名不在允许列表内`);
      }

      const created = await this.prisma.chatFile.create({
        data: {
          userId,
          conversationId,
          fileName: parsed.fileName,
          mimeType: parsed.mimeType,
          fileSize: parsed.fileSize,
          extension: parsed.extension,
          extractedText: parsed.extractedText,
          textLength: parsed.extractedText.length,
          status: 'ready',
        },
      });

      uploaded.push(this.mapChatFile(created));
    }

    return { files: uploaded };
  }

  async sendMessage(userId: bigint, conversationIdRaw: string, dto: SendMessageDto) {
    const conversationId = this.parseBigInt(conversationIdRaw, 'conversationId');
    const conversation = await this.requireConversationWithChannel(userId, conversationId);

    if (conversation.model.type !== AiModelType.chat) {
      throw new BadRequestException('Conversation model is not chat type');
    }
    if (!conversation.model.isActive) {
      throw new BadRequestException('Conversation model is inactive');
    }
    if (conversation.model.channel.status !== ApiChannelStatus.active) {
      throw new BadRequestException('Model channel is inactive');
    }

    const content = (dto.content ?? '').trim();
    const images = this.normalizeImages(dto.images);
    const fileIds = this.normalizeFileIds(dto.fileIds);
    const mediaAgent = this.normalizeMediaAgentContext(dto.mediaAgent ?? dto.imageAgent);
    const autoProjectAgent = parseAutoProjectAgentContext(dto.autoProjectAgent);
    const requestedMode = this.resolveConversationComposerMode({
      mediaAgent,
      autoProjectAgent,
    });

    if (!content && images.length === 0 && fileIds.length === 0) {
      throw new BadRequestException('content, images or files is required');
    }

    await this.assertConversationComposerMode({
      conversationId,
      requestedMode,
    });

    if (mediaAgent?.enabled && autoProjectAgent?.enabled) {
      throw new BadRequestException('Media Agent and Auto Project Agent cannot be enabled together');
    }

    if (mediaAgent?.enabled && fileIds.length > 0) {
      throw new BadRequestException('Media Agent does not support file attachments');
    }
    if (autoProjectAgent?.enabled && (images.length > 0 || fileIds.length > 0)) {
      throw new BadRequestException('Auto Project Agent does not support direct attachments');
    }

    const supportsImageInput = Boolean(conversation.model.supportsImageInput);
    if (images.length > 0 && !supportsImageInput && !mediaAgent?.enabled) {
      throw new BadRequestException('Current model does not support image uploads');
    }

    await this.assertChatMessageAllowed({
      userId,
      conversationId,
      modelId: conversation.model.id,
      content,
    });

    const fileContext: FileContextBuildResult = { systemMessage: '', attachments: [], citations: [] };
    const webContext: WebSearchContextBuildResult = { systemMessage: '', citations: [] };
    let projectContextSystemMessage = '';
    let projectActionSystemMessage = '';
    let mergedCitations: ChatCitation[] = [];

    if (!mediaAgent?.enabled && !autoProjectAgent?.enabled) {
      const chatFileSettings = await this.getChatFileRuntimeSettings();
      if (fileIds.length > 0 && !chatFileSettings.enabled) {
        throw new BadRequestException('管理员已关闭聊天文件上传功能');
      }
      const webSearchSettings = await this.getWebSearchRuntimeSettings();
      const shouldUseWebSearch = await this.resolveShouldUseWebSearch(content, dto.webSearch, webSearchSettings);

      const builtFileContext = await this.buildFileContext({
        userId,
        conversationId,
        fileIds,
        query: content,
        settings: chatFileSettings,
      });
      const builtWebContext = await this.buildWebSearchContext({
        query: content,
        fileContext: builtFileContext.systemMessage,
        shouldUse: shouldUseWebSearch,
        explicitRequested: dto.webSearch === true,
        settings: webSearchSettings,
      });

      fileContext.systemMessage = builtFileContext.systemMessage;
      fileContext.attachments = builtFileContext.attachments;
      fileContext.citations = builtFileContext.citations;
      webContext.systemMessage = builtWebContext.systemMessage;
      webContext.citations = builtWebContext.citations;
      projectContextSystemMessage = await this.buildConversationProjectContextSystemMessage(
        userId,
        conversation.projectContext?.id ?? null,
      );
      projectActionSystemMessage = projectContextSystemMessage
        ? this.buildProjectPromptActionSystemMessage(conversation.projectContext?.name ?? null)
        : '';
      mergedCitations = [...builtFileContext.citations, ...builtWebContext.citations];
    }

    const dailyQuestionQuota = await this.assertDailyQuestionLimit(userId, conversation.model.id, {
      freeUserDailyQuestionLimit: conversation.model.freeUserDailyQuestionLimit,
    });

    const now = new Date();
    const userMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        userId,
        role: ChatMessageRole.user,
        content,
        images: images.length > 0 ? (images as Prisma.InputJsonValue) : undefined,
        files: fileContext.attachments.length > 0 ? (fileContext.attachments as Prisma.InputJsonValue) : undefined,
      },
    }).catch(async (error) => {
      await dailyQuestionQuota?.rollback();
      throw error;
    });
    dailyQuestionQuota?.commit();

    const conversationUpdateData: Prisma.ChatConversationUpdateInput = {
      lastMessageAt: now,
      composerMode: requestedMode,
    };

    const nextTitle = this.buildAutoTitle(conversation.title, content);
    if (nextTitle) {
      conversationUpdateData.title = nextTitle;
    }

    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: conversationUpdateData,
    });

    const recentMessagesDesc = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: this.resolveRecentMessageTake(conversation.model.maxContextRounds),
    });
    const recentMessages = recentMessagesDesc.reverse();
    const completion = autoProjectAgent?.enabled
      ? await this.autoProjectWorkflow.completeTurn({
          userId,
          conversationId,
          conversation,
          recentMessages,
          autoProjectAgent,
          userInput: content,
        })
      : mediaAgent?.enabled
        ? await this.completeMediaAgentTurn({
            userId,
            conversationId,
            conversation,
            recentMessages,
            mediaAgent,
            sourceUserMessageId: userMessage.id.toString(),
          })
        : await this.requestChatCompletion(
            conversation,
            this.injectSystemContextIntoUpstream(
              this.toUpstreamMessages(recentMessages, {
                includeImages: supportsImageInput,
              }),
              conversation.model.systemPrompt,
              projectContextSystemMessage,
              projectActionSystemMessage,
              fileContext.systemMessage,
              webContext.systemMessage,
            ),
          );

    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        userId,
        role: ChatMessageRole.assistant,
        content: completion.content,
        providerData: {
          ...(completion.providerData as Record<string, unknown>),
          ...(mergedCitations.length > 0 ? { citations: mergedCitations } : {}),
        } as Prisma.InputJsonValue,
      },
    });

    const updatedConversation = await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
      include: {
        model: {
          select: {
            id: true,
            name: true,
            icon: true,
            type: true,
            supportsImageInput: true,
            isActive: true,
          },
        },
        projectContext: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      conversation: this.mapConversationSummary({ ...updatedConversation, messages: [assistantMessage] }),
      userMessage: this.mapMessage(userMessage),
      assistantMessage: this.mapMessage(assistantMessage),
    };
  }

  async createImageTask(userId: bigint, conversationIdRaw: string, dto: CreateChatImageTaskDto) {
    const conversationId = this.parseBigInt(conversationIdRaw, 'conversationId');
    const conversation = await this.requireConversation(userId, conversationId);
    const userContent = (dto.userMessageContent ?? dto.prompt ?? '').trim();
    const currentImages = this.normalizeImages(dto.images, 20);

    if (!userContent) {
      throw new BadRequestException('prompt is required');
    }

    const { createdTask } = await this.generateConversationImageTask({
      userId,
      conversationId,
      imageModelIdRaw: dto.modelId,
      projectId: conversation.projectContext?.id ?? null,
      prompt: dto.prompt,
      negativePrompt: dto.negativePrompt,
      currentImages,
      useConversationContextEdit: dto.useConversationContextEdit === true,
      preferredAspectRatio: dto.preferredAspectRatio ?? null,
      preferredResolution: dto.preferredResolution ?? null,
      parameters: dto.parameters && typeof dto.parameters === 'object' ? { ...dto.parameters } : {},
    });

    const now = new Date();
    const userMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        userId,
        role: ChatMessageRole.user,
        content: userContent,
        ...(currentImages.length > 0
          ? { images: currentImages as Prisma.InputJsonValue }
          : {}),
      },
    });

    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        userId,
        role: ChatMessageRole.assistant,
        content: '已创建绘图任务，生成完成后会自动刷新。',
        providerData: {
          taskRefs: [
            {
              kind: 'image',
              taskId: createdTask.id,
              taskNo: createdTask.taskNo,
              status: createdTask.status,
              modelId: createdTask.modelId,
              provider: createdTask.provider,
              prompt: createdTask.prompt,
              thumbnailUrl: createdTask.thumbnailUrl,
              resultUrl: createdTask.resultUrl,
              errorMessage: createdTask.errorMessage,
              creditsCost: createdTask.creditsCost,
              createdAt: createdTask.createdAt,
              completedAt: createdTask.completedAt,
            },
          ],
        } as Prisma.InputJsonValue,
      },
    });

    await this.markConfirmedMediaAgentMessage({
      userId,
      conversationId,
      sourceAssistantMessageId: dto.sourceAssistantMessageId,
    });

    const conversationUpdateData: Prisma.ChatConversationUpdateInput = {
      lastMessageAt: now,
      composerMode: 'image',
    };
    const nextTitle = this.buildAutoTitle(conversation.title, userContent);
    if (nextTitle) {
      conversationUpdateData.title = nextTitle;
    }

    const updatedConversation = await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: conversationUpdateData,
      include: {
        model: {
          select: {
            id: true,
            name: true,
            icon: true,
            type: true,
            supportsImageInput: true,
            isActive: true,
          },
        },
        projectContext: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      conversation: this.mapConversationSummary({ ...updatedConversation, messages: [assistantMessage] }),
      userMessage: this.mapMessage(userMessage),
      assistantMessage: this.mapMessage(assistantMessage),
    };
  }

  async createVideoTask(userId: bigint, conversationIdRaw: string, dto: CreateChatVideoTaskDto) {
    const conversationId = this.parseBigInt(conversationIdRaw, 'conversationId');
    const conversation = await this.requireConversation(userId, conversationId);
    const userContent = (dto.userMessageContent ?? dto.prompt ?? '').trim();
    const currentImages = this.normalizeImages(dto.images, 20);
    const currentVideos = this.normalizeStringList(dto.videos, 10);
    const currentAudios = this.normalizeStringList(dto.audios, 10);

    if (!userContent) {
      throw new BadRequestException('prompt is required');
    }

    const { createdTask } = await this.generateConversationVideoTask({
      userId,
      conversationId,
      videoModelIdRaw: dto.modelId,
      projectId: conversation.projectContext?.id ?? null,
      prompt: dto.prompt,
      currentImages,
      currentVideos,
      currentAudios,
      useConversationContextEdit: dto.useConversationContextEdit === true,
      preferredAspectRatio: dto.preferredAspectRatio ?? null,
      preferredResolution: dto.preferredResolution ?? null,
      preferredDuration: dto.preferredDuration ?? null,
      parameters: dto.parameters && typeof dto.parameters === 'object' ? { ...dto.parameters } : {},
    });

    const now = new Date();
    const userMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        userId,
        role: ChatMessageRole.user,
        content: userContent,
        ...(currentImages.length > 0
          ? { images: currentImages as Prisma.InputJsonValue }
          : {}),
      },
    });

    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        userId,
        role: ChatMessageRole.assistant,
        content: '已创建视频任务，生成完成后会自动刷新。',
        providerData: {
          taskRefs: [this.toChatVideoTaskRef(createdTask)],
        } as Prisma.InputJsonValue,
      },
    });

    await this.markConfirmedMediaAgentMessage({
      userId,
      conversationId,
      sourceAssistantMessageId: dto.sourceAssistantMessageId,
    });

    const conversationUpdateData: Prisma.ChatConversationUpdateInput = {
      lastMessageAt: now,
      composerMode: 'image',
    };
    const nextTitle = this.buildAutoTitle(conversation.title, userContent);
    if (nextTitle) {
      conversationUpdateData.title = nextTitle;
    }

    const updatedConversation = await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: conversationUpdateData,
      include: {
        model: {
          select: {
            id: true,
            name: true,
            icon: true,
            type: true,
            supportsImageInput: true,
            isActive: true,
          },
        },
        projectContext: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      conversation: this.mapConversationSummary({ ...updatedConversation, messages: [assistantMessage] }),
      userMessage: this.mapMessage(userMessage),
      assistantMessage: this.mapMessage(assistantMessage),
    };
  }

  private async markConfirmedMediaAgentMessage(params: {
    userId: bigint;
    conversationId: bigint;
    sourceAssistantMessageId?: string;
  }) {
    if (!params.sourceAssistantMessageId?.trim()) return;

    const assistantMessageId = this.parseBigInt(params.sourceAssistantMessageId, 'sourceAssistantMessageId');
    const sourceMessage = await this.prisma.chatMessage.findFirst({
      where: {
        id: assistantMessageId,
        conversationId: params.conversationId,
        userId: params.userId,
        role: ChatMessageRole.assistant,
      },
      select: {
        id: true,
        providerData: true,
      },
    });

    if (
      !sourceMessage?.providerData ||
      typeof sourceMessage.providerData !== 'object' ||
      Array.isArray(sourceMessage.providerData)
    ) {
      return;
    }

    const providerData = { ...(sourceMessage.providerData as Record<string, unknown>) };
    const rawMediaAgent = providerData.mediaAgent ?? providerData.imageAgent;
    if (!rawMediaAgent || typeof rawMediaAgent !== 'object' || Array.isArray(rawMediaAgent)) {
      return;
    }

    providerData.mediaAgent = {
      ...(rawMediaAgent as Record<string, unknown>),
      autoCreated: true,
    };

    await this.prisma.chatMessage.update({
      where: { id: assistantMessageId },
      data: {
        providerData: providerData as Prisma.InputJsonValue,
      },
    });
  }

  async streamMessage(userId: bigint, conversationIdRaw: string, dto: SendMessageDto, res: Response) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    (res as Response & { socket?: { setNoDelay?: (noDelay?: boolean) => void } }).socket?.setNoDelay?.(true);
    res.write(': connected\n\n');

    let closed = false;
    let keepAlive: ReturnType<typeof setInterval> | null = null;
    res.on('close', () => {
      closed = true;
      if (keepAlive) {
        clearInterval(keepAlive);
        keepAlive = null;
      }
    });
    const sendSse = (payload: Record<string, unknown>) => {
      if (closed || res.writableEnded) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      (res as Response & { flush?: () => void }).flush?.();
    };
    const closeSse = () => {
      if (closed || res.writableEnded) return;
      closed = true;
      res.write('data: [DONE]\n\n');
      res.end();
    };
    keepAlive = setInterval(() => {
      if (closed || res.writableEnded) return;
      try {
        res.write(': ping\n\n');
        (res as Response & { flush?: () => void }).flush?.();
      } catch {
        closed = true;
      }
    }, 10_000);

    try {
      const conversationId = this.parseBigInt(conversationIdRaw, 'conversationId');
      const conversation = await this.requireConversationWithChannel(userId, conversationId);

      if (conversation.model.type !== AiModelType.chat) {
        throw new BadRequestException('Conversation model is not chat type');
      }
      if (!conversation.model.isActive) {
        throw new BadRequestException('Conversation model is inactive');
      }
      if (conversation.model.channel.status !== ApiChannelStatus.active) {
        throw new BadRequestException('Model channel is inactive');
      }

      const content = (dto.content ?? '').trim();
      const images = this.normalizeImages(dto.images);
      const fileIds = this.normalizeFileIds(dto.fileIds);
      const mediaAgent = this.normalizeMediaAgentContext(dto.mediaAgent ?? dto.imageAgent);
      const autoProjectAgent = parseAutoProjectAgentContext(dto.autoProjectAgent);
      const requestedMode = this.resolveConversationComposerMode({
        mediaAgent,
        autoProjectAgent,
      });

      if (!content && images.length === 0 && fileIds.length === 0) {
        throw new BadRequestException('content, images or files is required');
      }

      await this.assertConversationComposerMode({
        conversationId,
        requestedMode,
      });

      if (mediaAgent?.enabled && autoProjectAgent?.enabled) {
        throw new BadRequestException('Media Agent and Auto Project Agent cannot be enabled together');
      }

      if (mediaAgent?.enabled && fileIds.length > 0) {
        throw new BadRequestException('Media Agent does not support file attachments');
      }
      if (autoProjectAgent?.enabled && (images.length > 0 || fileIds.length > 0)) {
        throw new BadRequestException('Auto Project Agent does not support direct attachments');
      }

      const supportsImageInput = Boolean(conversation.model.supportsImageInput);
      if (images.length > 0 && !supportsImageInput && !mediaAgent?.enabled) {
        throw new BadRequestException('Current model does not support image uploads');
      }

      await this.assertChatMessageAllowed({
        userId,
        conversationId,
        modelId: conversation.model.id,
        content,
      });

      const fileContext: FileContextBuildResult = { systemMessage: '', attachments: [], citations: [] };
      const webContext: WebSearchContextBuildResult = { systemMessage: '', citations: [] };
      let projectContextSystemMessage = '';
      let projectActionSystemMessage = '';
      let mergedCitations: ChatCitation[] = [];
      let shouldUseWebSearch = false;

      if (!mediaAgent?.enabled && !autoProjectAgent?.enabled) {
        const chatFileSettings = await this.getChatFileRuntimeSettings();
        if (fileIds.length > 0 && !chatFileSettings.enabled) {
          throw new BadRequestException('管理员已关闭聊天文件上传功能');
        }
        const webSearchSettings = await this.getWebSearchRuntimeSettings();
        shouldUseWebSearch = await this.resolveShouldUseWebSearch(content, dto.webSearch, webSearchSettings);
        const builtFileContext = await this.buildFileContext({
          userId,
          conversationId,
          fileIds,
          query: content,
          settings: chatFileSettings,
        });
        const builtWebContext = await this.buildWebSearchContext({
          query: content,
          fileContext: builtFileContext.systemMessage,
          shouldUse: shouldUseWebSearch,
          explicitRequested: dto.webSearch === true,
          settings: webSearchSettings,
          onProgress: (progress) => {
            sendSse({
              type: 'status',
              stage: progress.stage,
              message: progress.message,
              searchedQueries: progress.searchedQueries,
              totalQueries: progress.totalQueries,
              searchedArticles: progress.searchedArticles,
              totalArticles: progress.totalArticles,
            });
          },
        });

        fileContext.systemMessage = builtFileContext.systemMessage;
        fileContext.attachments = builtFileContext.attachments;
        fileContext.citations = builtFileContext.citations;
        webContext.systemMessage = builtWebContext.systemMessage;
        webContext.citations = builtWebContext.citations;
        projectContextSystemMessage = await this.buildConversationProjectContextSystemMessage(
          userId,
          conversation.projectContext?.id ?? null,
        );
        projectActionSystemMessage = projectContextSystemMessage
          ? this.buildProjectPromptActionSystemMessage(conversation.projectContext?.name ?? null)
          : '';
        mergedCitations = [...builtFileContext.citations, ...builtWebContext.citations];
      }

      const dailyQuestionQuota = await this.assertDailyQuestionLimit(userId, conversation.model.id, {
        freeUserDailyQuestionLimit: conversation.model.freeUserDailyQuestionLimit,
      });

      const now = new Date();
      const userMessage = await this.prisma.chatMessage.create({
        data: {
          conversationId,
          userId,
          role: ChatMessageRole.user,
          content,
          images: images.length > 0 ? (images as Prisma.InputJsonValue) : undefined,
          files: fileContext.attachments.length > 0 ? (fileContext.attachments as Prisma.InputJsonValue) : undefined,
        },
      }).catch(async (error) => {
        await dailyQuestionQuota?.rollback();
        throw error;
      });
      dailyQuestionQuota?.commit();

      const conversationUpdateData: Prisma.ChatConversationUpdateInput = {
        lastMessageAt: now,
        composerMode: requestedMode,
      };
      const nextTitle = this.buildAutoTitle(conversation.title, content);
      if (nextTitle) {
        conversationUpdateData.title = nextTitle;
      }

      await this.prisma.chatConversation.update({
        where: { id: conversationId },
        data: conversationUpdateData,
      });

      const startConversation = await this.prisma.chatConversation.findUnique({
        where: { id: conversationId },
        include: {
          model: {
            select: {
              id: true,
              name: true,
              icon: true,
              type: true,
              supportsImageInput: true,
              isActive: true,
            },
          },
          projectContext: {
            select: {
              id: true,
              name: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, role: true, content: true, images: true, files: true, createdAt: true },
          },
        },
      });

      if (startConversation) {
        sendSse({
          type: 'start',
          conversation: this.mapConversationSummary(startConversation),
          userMessage: this.mapMessage(userMessage),
        });
      }

      if (shouldUseWebSearch) {
        const webCitationCount = webContext.citations.length;
        sendSse({
          type: 'status',
          stage: 'summarizing',
          message:
            webCitationCount > 0
              ? `已整理 ${webCitationCount} 条联网资料，正在生成回答`
              : '联网搜索未获得可用资料，将谨慎回答',
          searchedArticles: webCitationCount,
          totalArticles: webCitationCount,
        });
      }

      const recentMessagesDesc = await this.prisma.chatMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: this.resolveRecentMessageTake(conversation.model.maxContextRounds),
      });
      const recentMessages = recentMessagesDesc.reverse();
      const completion = autoProjectAgent?.enabled
        ? await this.autoProjectWorkflow.completeTurn({
            userId,
            conversationId,
            conversation,
            recentMessages,
            autoProjectAgent,
            userInput: content,
            onStatus: (message) => {
              sendSse({ type: 'status', stage: 'planning', message });
            },
          })
        : mediaAgent?.enabled
          ? await this.completeMediaAgentTurn({
              userId,
              conversationId,
              conversation,
              recentMessages,
              mediaAgent,
              sourceUserMessageId: userMessage.id.toString(),
            })
          : await this.requestChatCompletionStream(
              conversation,
              this.injectSystemContextIntoUpstream(
                this.toUpstreamMessages(recentMessages, {
                  includeImages: supportsImageInput,
                }),
                conversation.model.systemPrompt,
                projectContextSystemMessage,
                projectActionSystemMessage,
                fileContext.systemMessage,
                webContext.systemMessage,
              ),
              (chunk) => {
                sendSse({ type: 'delta', content: chunk });
              },
              (chunk) => {
                sendSse({ type: 'reasoning_delta', content: chunk });
              },
            );

      if (mediaAgent?.enabled || autoProjectAgent?.enabled) {
        sendSse({ type: 'delta', content: completion.content });
      }

      const assistantMessage = await this.prisma.chatMessage.create({
        data: {
          conversationId,
          userId,
          role: ChatMessageRole.assistant,
          content: completion.content,
          providerData: {
            ...(completion.providerData as Record<string, unknown>),
            ...(mergedCitations.length > 0 ? { citations: mergedCitations } : {}),
          } as Prisma.InputJsonValue,
        },
      });

      const updatedConversation = await this.prisma.chatConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
        include: {
          model: {
            select: {
              id: true,
              name: true,
              icon: true,
              type: true,
              supportsImageInput: true,
              isActive: true,
            },
          },
          projectContext: {
            select: {
              id: true,
              name: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, role: true, content: true, images: true, files: true, createdAt: true },
          },
        },
      });

      sendSse({
        type: 'done',
        conversation: this.mapConversationSummary(updatedConversation),
        assistantMessage: this.mapMessage(assistantMessage),
      });
      closeSse();
    } catch (error) {
      const message = this.normalizeExceptionMessage(error);
      this.logger.error(`Chat stream failed: ${message}`, error instanceof Error ? error.stack : undefined);
      sendSse({ type: 'error', message });
      closeSse();
    } finally {
      if (keepAlive) {
        clearInterval(keepAlive);
        keepAlive = null;
      }
    }
  }

  private async assertChatMessageAllowed(input: {
    userId: bigint;
    conversationId: bigint;
    modelId: bigint;
    content: string;
  }) {
    const content = (input.content || '').trim();
    if (!content) return;

    const settings = await this.aiSettings.getAiSettings();
    if (!settings.chatModerationEnabled) return;

    const apiBaseUrl = settings.chatModerationApiBaseUrl.trim();
    const apiKey = settings.chatModerationApiKey.trim();
    const modelName = settings.chatModerationModelName.trim();
    const systemPrompt = (settings.chatModerationSystemPrompt || '').trim();

    if (!apiBaseUrl || !apiKey || !modelName) {
      throw new BadRequestException('聊天审核已开启，但审核模型配置不完整');
    }

    const result = await this.requestChatModerationDecision({
      apiBaseUrl,
      apiKey,
      modelName,
      systemPrompt,
      content,
    });

    if (result.passed) return;

    const autoBanResult = await this.recordFailedModerationAttempt({
      userId: input.userId,
      conversationId: input.conversationId,
      modelId: input.modelId,
      content,
      reason: result.reason,
      providerModel: result.providerModel,
      providerResponse: result.providerResponse,
      settings,
    });

    if (autoBanResult) {
      throw new ForbiddenException({
        ...buildBanErrorPayload(autoBanResult.banReason, autoBanResult.banExpireAt),
        message: `当前消息未通过内容审核，账号已自动封禁 ${autoBanResult.matchedRule.banDays} 天`,
      });
    }

    throw new BadRequestException(result.reason || '当前消息未通过内容审核，请修改后重试');
  }

  private async recordFailedModerationAttempt(input: {
    userId: bigint;
    conversationId: bigint;
    modelId: bigint;
    content: string;
    reason: string | null;
    providerModel: string | null;
    providerResponse: string | null;
    settings: Awaited<ReturnType<AiSettingsService['getAiSettings']>>;
  }): Promise<ChatModerationAutoBanResult | null> {
    await this.prisma.chatModerationLog.create({
      data: {
        userId: input.userId,
        conversationId: input.conversationId,
        modelId: input.modelId,
        content: input.content,
        reason: input.reason,
        providerModel: input.providerModel,
        providerResponse: input.providerResponse,
      },
    });

    if (!input.settings.chatModerationAutoBanEnabled || input.settings.chatModerationAutoBanRules.length === 0) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        role: true,
        status: true,
      },
    });

    if (!user || user.role === UserRole.admin || user.status !== UserStatus.active) {
      return null;
    }

    const [chatCount, inputCount] = await Promise.all([
      this.moderationCounters.incrementChatBlockedCount(input.userId),
      this.moderationCounters.getInputBlockedCount(input.userId),
    ]);
    const totalBlockedCount = chatCount + inputCount;

    const matchedRule = [...input.settings.chatModerationAutoBanRules]
      .sort((a, b) => b.triggerCount - a.triggerCount)
      .find((rule) => totalBlockedCount >= rule.triggerCount);

    if (!matchedRule) return null;

    const banExpireAt = calculateBanExpireAt(matchedRule.banDays);
    if (!banExpireAt) return null;

    const latestReason = input.reason?.trim();
    const banReason = latestReason
      ? `聊天内容审核累计拦截达到 ${matchedRule.triggerCount} 次，系统自动封禁 ${matchedRule.banDays} 天。最近一次拦截原因：${latestReason}`
      : `聊天内容审核累计拦截达到 ${matchedRule.triggerCount} 次，系统自动封禁 ${matchedRule.banDays} 天。`;

    await this.prisma.user.update({
      where: { id: input.userId },
      data: {
        status: UserStatus.banned,
        banReason,
        banExpireAt,
      },
    });
    await this.authUserCache.invalidate(input.userId);

    return {
      matchedRule,
      totalBlockedCount,
      banReason,
      banExpireAt,
    };
  }

  private async requestChatModerationDecision(params: {
    apiBaseUrl: string;
    apiKey: string;
    modelName: string;
    systemPrompt: string;
    content: string;
  }): Promise<ChatModerationCheckResult> {
    try {
      const response = await axios.post(
        this.buildChatCompletionUrl(params.apiBaseUrl),
        {
          model: params.modelName,
          messages: [
            {
              role: 'system',
              content: params.systemPrompt,
            },
            {
              role: 'user',
              content: params.content,
            },
          ],
          stream: false,
          temperature: 0,
          max_tokens: 8,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${params.apiKey}`,
          },
          timeout: 15_000,
          validateStatus: () => true,
        },
      );

      if (response.status >= 400) {
        throw new BadRequestException(`聊天审核服务调用失败（HTTP ${response.status}）`);
      }

      const payload = response.data;
      const upstreamError = this.extractErrorMessage(payload);
      if (upstreamError) {
        throw new BadRequestException(`聊天审核服务返回错误：${upstreamError}`);
      }

      const providerModel =
        typeof payload?.model === 'string' && payload.model.trim() ? payload.model.trim() : params.modelName;
      const providerResponse = this.extractAssistantContent(payload).trim();
      const decision = this.parseBooleanModerationDecision(providerResponse);

      if (decision === null) {
        throw new BadRequestException('聊天审核模型返回格式无效，必须只返回 true 或 false');
      }

      return {
        passed: decision,
        reason: decision ? null : '当前消息未通过内容审核，请修改后重试',
        providerModel,
        providerResponse: providerResponse || null,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('聊天审核服务暂不可用，请稍后重试');
    }
  }

  private parseBooleanModerationDecision(raw: string) {
    const normalized = raw.trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;

    const parsed = this.tryParseJson(normalized);
    if (typeof parsed === 'boolean') return parsed;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const candidates = [record.allowed, record.compliant, record.pass, record.result, record.value];
      for (const candidate of candidates) {
        if (typeof candidate === 'boolean') return candidate;
        if (typeof candidate === 'string') {
          const nested = candidate.trim().toLowerCase();
          if (nested === 'true') return true;
          if (nested === 'false') return false;
        }
      }
    }

    return null;
  }

  private async requestChatCompletionStream(
    conversation: {
      model: {
        modelKey: string;
        defaultParams: Prisma.JsonValue | null;
        channel: {
          baseUrl: string;
          apiKey: string | null;
          extraHeaders: Prisma.JsonValue | null;
          timeout: number;
        };
      };
    },
    messages: UpstreamMessage[],
    onDelta: (delta: string) => void,
    onReasoningDelta: (delta: string) => void,
  ) {
    const decryptedApiKey = this.encryption.decryptString(conversation.model.channel.apiKey);
    if (!decryptedApiKey) {
      throw new BadRequestException('Channel API key is not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json',
      Authorization: `Bearer ${decryptedApiKey}`,
    };

    const extraHeaders = this.normalizeExtraHeaders(conversation.model.channel.extraHeaders);
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers[key] = value;
    }

    const defaultParams =
      conversation.model.defaultParams && typeof conversation.model.defaultParams === 'object'
        ? (conversation.model.defaultParams as Record<string, unknown>)
        : {};

    const payload: Record<string, unknown> = {
      ...defaultParams,
      model: conversation.model.modelKey,
      messages,
      stream: true,
    };

    const timeout = Math.max(5_000, Math.min(conversation.model.channel.timeout ?? 60_000, 600_000));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(this.buildChatCompletionUrl(conversation.model.channel.baseUrl), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const parsed = this.tryParseJson(body);
        const message =
          (parsed ? this.extractErrorMessage(parsed) : null) ||
          body.trim() ||
          `Upstream chat request failed (${response.status})`;
        throw new BadRequestException(message);
      }

      const providerData: Record<string, unknown> = {
        id: null,
        model: null,
        usage: null,
        reasoning: null,
      };
      const setProviderData = (payloadChunk: unknown) => {
        if (!payloadChunk || typeof payloadChunk !== 'object') return;
        const obj = payloadChunk as Record<string, unknown>;
        if (typeof obj.id === 'string') providerData.id = obj.id;
        if (typeof obj.model === 'string') providerData.model = obj.model;
        if ('usage' in obj && obj.usage) providerData.usage = obj.usage;
      };

      let fullText = '';
      let fullReasoning = '';
      const appendDelta = (incomingDelta: string) => {
        if (!incomingDelta) return;

        let incremental = incomingDelta;
        if (incomingDelta.startsWith(fullText)) {
          // Some providers stream cumulative content; emit only incremental suffix.
          incremental = incomingDelta.slice(fullText.length);
        } else if (fullText.endsWith(incomingDelta)) {
          // Duplicate chunk; ignore.
          incremental = '';
        }

        if (!incremental) return;

        for (const char of incremental) {
          fullText += char;
          onDelta(char);
        }
      };

      const appendReasoningDelta = (incomingDelta: string) => {
        if (!incomingDelta) return;

        let incremental = incomingDelta;
        if (incomingDelta.startsWith(fullReasoning)) {
          incremental = incomingDelta.slice(fullReasoning.length);
        } else if (fullReasoning.endsWith(incomingDelta)) {
          incremental = '';
        }

        if (!incremental) return;

        for (const char of incremental) {
          fullReasoning += char;
          onReasoningDelta(char);
        }
      };

      const processPayload = (raw: string) => {
        if (!raw || raw === '[DONE]') return;

        const parsed = this.tryParseJson(raw);
        if (!parsed) {
          appendDelta(raw);
          return;
        }

        setProviderData(parsed);

        const err = this.extractErrorMessage(parsed);
        if (err) {
          throw new BadRequestException(err);
        }

        const reasoningDelta = this.extractReasoningDelta(parsed);
        if (reasoningDelta) {
          appendReasoningDelta(reasoningDelta);
        }

        const delta = this.extractAssistantDelta(parsed);
        if (delta) {
          appendDelta(delta);
        }
      };

      const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
      const reader = response.body?.getReader();

      if (!reader) {
        const raw = await response.text();
        if (raw) processPayload(raw);
      } else {
        const decoder = new TextDecoder();
        let buffer = '';
        let isLineStream =
          contentType.includes('text/event-stream') ||
          contentType.includes('ndjson') ||
          contentType.includes('stream');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;

          if (!isLineStream && chunk.includes('data:')) {
            isLineStream = true;
          }

          if (!isLineStream) {
            // Plain text chunk stream (raw passthrough).
            appendDelta(chunk);
            continue;
          }

          buffer += chunk;
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const normalizedLine = line.trimEnd();
            if (!normalizedLine) continue;
            if (normalizedLine.startsWith('data:')) {
              processPayload(normalizedLine.slice(5).trimStart());
              continue;
            }
            if (normalizedLine.startsWith('{') || normalizedLine.startsWith('[')) {
              processPayload(normalizedLine);
              continue;
            }
            appendDelta(normalizedLine);
          }
        }

        if (buffer) {
          if (isLineStream) {
            const tail = buffer.trim();
            if (tail.startsWith('data:')) {
              processPayload(tail.slice(5).trimStart());
            } else if (tail.startsWith('{') || tail.startsWith('[')) {
              processPayload(tail);
            } else {
              appendDelta(buffer);
            }
          } else {
            appendDelta(buffer);
          }
        }
      }

      if (!fullReasoning.trim()) {
        const extractedThink = this.extractThinkBlock(fullText);
        if (extractedThink.reasoning) {
          fullReasoning = extractedThink.reasoning;
          if (extractedThink.content) {
            fullText = extractedThink.content;
          }
        }
      }

      if (!fullText.trim() && fullReasoning.trim()) {
        fullText = fullReasoning;
      }

      if (!fullText.trim()) {
        throw new BadRequestException('Upstream chat returned empty content');
      }

      if (fullReasoning.trim()) {
        providerData.reasoning = fullReasoning;
      }

      return {
        content: fullText,
        providerData,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BadRequestException('Upstream chat request timeout');
      }
      throw new BadRequestException('Upstream chat request failed');
    } finally {
      clearTimeout(timer);
    }
  }

  private async requestChatCompletion(
    conversation: {
      model: {
        modelKey: string;
        defaultParams: Prisma.JsonValue | null;
        channel: {
          baseUrl: string;
          apiKey: string | null;
          extraHeaders: Prisma.JsonValue | null;
          timeout: number;
        };
      };
    },
    messages: UpstreamMessage[],
  ) {
    const decryptedApiKey = this.encryption.decryptString(conversation.model.channel.apiKey);
    if (!decryptedApiKey) {
      throw new BadRequestException('Channel API key is not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    headers.Authorization = `Bearer ${decryptedApiKey}`;

    const extraHeaders = this.normalizeExtraHeaders(conversation.model.channel.extraHeaders);
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers[key] = value;
    }

    const baseUrl = conversation.model.channel.baseUrl;
    const url = this.buildChatCompletionUrl(baseUrl);

    const defaultParams =
      conversation.model.defaultParams && typeof conversation.model.defaultParams === 'object'
        ? (conversation.model.defaultParams as Record<string, unknown>)
        : {};

    const payload: Record<string, unknown> = {
      ...defaultParams,
      model: conversation.model.modelKey,
      messages,
      stream: false,
    };

    const timeout = Math.max(5_000, Math.min(conversation.model.channel.timeout ?? 60_000, 600_000));

    const response = await axios.post(url, payload, {
      headers,
      timeout,
      validateStatus: () => true,
    });

    const body = response.data;

    if (response.status >= 400) {
      const message = this.extractErrorMessage(body) ?? `Upstream chat request failed (${response.status})`;
      throw new BadRequestException(message);
    }

    const upstreamError = this.extractErrorMessage(body);
    if (upstreamError) {
      throw new BadRequestException(upstreamError);
    }

    let content = this.extractAssistantContent(body);
    let reasoning = this.extractAssistantReasoning(body);

    if (!reasoning) {
      const extractedThink = this.extractThinkBlock(content);
      if (extractedThink.reasoning) {
        reasoning = extractedThink.reasoning;
        if (extractedThink.content) {
          content = extractedThink.content;
        }
      }
    }

    if (!content.trim() && reasoning.trim()) {
      content = reasoning;
    }

    if (!content.trim()) {
      throw new BadRequestException('Upstream chat returned empty content');
    }

    return {
      content,
      providerData: {
        id: typeof body?.id === 'string' ? body.id : null,
        model: typeof body?.model === 'string' ? body.model : null,
        usage: body?.usage ?? null,
        reasoning: reasoning || null,
      },
    };
  }

  private extractAssistantContent(payload: any): string {
    if (!payload || typeof payload !== 'object') return '';

    const firstChoice = payload.choices?.[0];
    const candidates = [
      firstChoice?.message?.content,
      firstChoice?.delta?.content,
      firstChoice?.text,
      payload.output_text,
      payload.content,
      payload.text,
    ];

    for (const value of candidates) {
      const normalized = this.normalizeUpstreamContent(value);
      if (normalized) return normalized;
    }

    return '';
  }

  private extractAssistantDelta(payload: any): string {
    if (!payload || typeof payload !== 'object') return '';

    const firstChoice = payload.choices?.[0];
    const deltaCandidates = [
      firstChoice?.delta?.content,
      firstChoice?.delta?.text,
      payload.delta?.content,
      payload.delta?.text,
      payload.content_block?.text,
    ];

    for (const value of deltaCandidates) {
      const normalized = this.normalizeUpstreamContent(value);
      if (normalized) return normalized;
    }

    // Some providers return plain JSON in a non-SSE response even when stream=true.
    const fallbackCandidates = [firstChoice?.message?.content, firstChoice?.text, payload.output_text, payload.content, payload.text];
    for (const value of fallbackCandidates) {
      const normalized = this.normalizeUpstreamContent(value);
      if (normalized) return normalized;
    }

    return '';
  }

  private extractReasoningDelta(payload: any): string {
    if (!payload || typeof payload !== 'object') return '';

    const firstChoice = payload.choices?.[0];
    const deltaCandidates = [
      firstChoice?.delta?.reasoning_content,
      firstChoice?.delta?.reasoning,
      firstChoice?.reasoning_content,
      firstChoice?.reasoning,
      payload.delta?.reasoning_content,
      payload.delta?.reasoning,
      payload.reasoning_content,
      payload.reasoning,
      payload.thinking,
      payload.thought,
      payload.content_block?.reasoning,
      payload.content_block?.thinking,
      payload.content_block?.thought,
    ];

    for (const value of deltaCandidates) {
      const normalized = this.normalizeUpstreamContent(value);
      if (normalized) return normalized;
    }

    return '';
  }

  private extractAssistantReasoning(payload: any): string {
    if (!payload || typeof payload !== 'object') return '';

    const firstChoice = payload.choices?.[0];
    const candidates = [
      firstChoice?.message?.reasoning_content,
      firstChoice?.message?.reasoning,
      firstChoice?.reasoning_content,
      firstChoice?.reasoning,
      payload.reasoning_content,
      payload.reasoning,
      payload.thinking,
      payload.thought,
      payload.output_reasoning,
    ];

    for (const value of candidates) {
      const normalized = this.normalizeUpstreamContent(value);
      if (normalized) return normalized;
    }

    return '';
  }

  private extractThinkBlock(raw: string): { content: string; reasoning: string } {
    const source = (raw ?? '').trim();
    if (!source) {
      return { content: '', reasoning: '' };
    }

    const regex = /<think>([\s\S]*?)<\/think>/gi;
    const reasoningParts: string[] = [];
    let match: RegExpExecArray | null = null;
    while ((match = regex.exec(source)) !== null) {
      const block = (match[1] ?? '').trim();
      if (block) {
        reasoningParts.push(block);
      }
    }

    if (reasoningParts.length === 0) {
      return { content: source, reasoning: '' };
    }

    const content = source.replace(regex, '').trim();
    const reasoning = reasoningParts.join('\n\n').trim();
    return { content, reasoning };
  }

  private tryParseJson(raw: string) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private normalizeUpstreamContent(value: unknown): string {
    if (typeof value === 'string') return value;

    if (Array.isArray(value)) {
      return value
        .map((part) => {
          if (typeof part === 'string') return part;
          if (!part || typeof part !== 'object') return '';

          const partObj = part as Record<string, unknown>;
          if (typeof partObj.text === 'string') return partObj.text;
          if (typeof partObj.content === 'string') return partObj.content;
          return '';
        })
        .join('');
    }

    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (typeof obj.text === 'string') return obj.text;
      if (typeof obj.content === 'string') return obj.content;
      if (Array.isArray(obj.content)) return this.normalizeUpstreamContent(obj.content);
    }

    return '';
  }

  private extractErrorMessage(payload: any): string | null {
    if (!payload || typeof payload !== 'object') return null;

    const err = payload.error;
    if (!err) return null;
    if (typeof err === 'string') return err;
    if (typeof err === 'object' && typeof err.message === 'string') return err.message;

    return 'Upstream provider returned an error';
  }

  private toUpstreamMessages(
    messages: Array<{ role: ChatMessageRole; content: string; images: Prisma.JsonValue | null; files?: Prisma.JsonValue | null }>,
    options?: { includeImages?: boolean },
  ) {
    const includeImages = options?.includeImages !== false;

    return messages
      .map((msg): UpstreamMessage | null => {
        const role = msg.role as UpstreamMessage['role'];

        if (role !== 'assistant' && role !== 'system' && role !== 'user') return null;

        if (role !== 'user') {
          return {
            role,
            content: msg.content,
          };
        }

        const images = includeImages ? this.extractImages(msg.images) : [];
        if (!includeImages) {
          const plainText = msg.content.trim();
          if (plainText) {
            return {
              role,
              content: msg.content,
            };
          }

          const previousImageCount = this.extractImages(msg.images).length;
          if (previousImageCount > 0) {
            return {
              role,
              content: previousImageCount > 1 ? `[${previousImageCount} images omitted]` : '[image omitted]',
            };
          }

          const fileCount = this.extractMessageFiles(msg.files ?? null).length;
          if (fileCount > 0) {
            return {
              role,
              content: fileCount > 1 ? `[${fileCount} files attached]` : '[file attached]',
            };
          }

          return null;
        }

        if (images.length === 0) {
          const plainText = msg.content.trim();
          if (!plainText) {
            const fileCount = this.extractMessageFiles(msg.files ?? null).length;
            if (fileCount > 0) {
              return {
                role,
                content: fileCount > 1 ? `[${fileCount} files attached]` : '[file attached]',
              };
            }

            return null;
          }

          return {
            role,
            content: msg.content,
          };
        }

        const parts: UpstreamMessagePart[] = [];
        if (msg.content) {
          parts.push({ type: 'text', text: msg.content });
        }

        for (const image of images) {
          parts.push({
            type: 'image_url',
            image_url: { url: this.toImageUrl(image) },
          });
        }

        return {
          role,
          content: parts,
        };
      })
      .filter((msg): msg is UpstreamMessage => Boolean(msg));
  }

  private toImageUrl(value: string) {
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image/')) {
      return value;
    }

    return `data:image/jpeg;base64,${value}`;
  }

  private buildChatCompletionUrl(baseUrl: string): string {
    const trimmed = baseUrl.replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
    return `${trimmed}/chat/completions`;
  }

  private normalizeExtraHeaders(raw: Prisma.JsonValue | null): Record<string, string> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!key) continue;
      if (typeof value === 'string') {
        out[key] = value;
        continue;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        out[key] = String(value);
      }
    }
    return out;
  }

  private async assertDailyQuestionLimit(
    userId: bigint,
    modelId: bigint,
    limits: {
      freeUserDailyQuestionLimit: number | null;
    },
  ): Promise<DailyQuestionQuotaReservation | null> {
    const now = new Date();
    const membershipLevelId = await this.getActiveMembershipLevelId(userId, now);
    const isMember = membershipLevelId !== null;
    const limit = isMember
      ? await this.membershipChatModelQuotas.getDailyLimit(membershipLevelId, modelId)
      : limits.freeUserDailyQuestionLimit;

    if (limit === null || limit === undefined) {
      return null;
    }

    const normalizedLimit = Math.max(0, Math.floor(limit));
    const { startOfDay, startOfNextDay } = this.getDayRange(now);
    const label = isMember ? '会员用户' : '免费用户';

    try {
      const dateKey = toBeijingDateKey(now);
      const counterKey = `chat:daily:${userId.toString()}:${modelId.toString()}:${dateKey}`;
      const expireAtSeconds = Math.ceil(startOfNextDay.getTime() / 1000);

      const cached = await this.redis.get(counterKey);
      if (cached === null) {
        const seededCount = await this.countDailyQuestionsFromDb(userId, modelId, startOfDay, startOfNextDay);
        await this.redis.setNx(counterKey, String(seededCount));
      }

      const nextCount = await this.redis.incr(counterKey);
      const ttl = await this.redis.ttl(counterKey);
      if (ttl < 0) {
        await this.redis.expireAt(counterKey, expireAtSeconds);
      }

      if (nextCount > normalizedLimit) {
        await this.safeRollbackDailyQuestionCounter(counterKey);
        throw new BadRequestException(`${label}今日提问次数已达上限（${normalizedLimit}次）`);
      }

      let committed = false;
      return {
        commit: () => {
          committed = true;
        },
        rollback: async () => {
          if (committed) return;
          await this.safeRollbackDailyQuestionCounter(counterKey);
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.warn(
        `Daily question Redis counter unavailable, falling back to DB: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const askedCount = await this.countDailyQuestionsFromDb(userId, modelId, startOfDay, startOfNextDay);
    if (askedCount >= normalizedLimit) {
      throw new BadRequestException(`${label}今日提问次数已达上限（${normalizedLimit}次）`);
    }

    return null;
  }

  private async getActiveMembershipLevelId(userId: bigint, now: Date) {
    return this.memberships.getActiveMembershipLevelId(userId, now);
  }

  private getDayRange(now: Date) {
    const [yearRaw, monthRaw, dayRaw] = toBeijingDateKey(now).split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    const startOfDay = new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0));
    const startOfNextDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    return { startOfDay, startOfNextDay };
  }

  private async countDailyQuestionsFromDb(
    userId: bigint,
    modelId: bigint,
    startOfDay: Date,
    startOfNextDay: Date,
  ) {
    return this.prisma.chatMessage.count({
      where: {
        userId,
        role: ChatMessageRole.user,
        createdAt: {
          gte: startOfDay,
          lt: startOfNextDay,
        },
        conversation: {
          modelId,
        },
      },
    });
  }

  private async safeRollbackDailyQuestionCounter(counterKey: string) {
    try {
      await this.redis.decr(counterKey);
    } catch (error) {
      this.logger.warn(
        `Failed to rollback Redis daily question counter: ${error instanceof Error ? error.message : String(error)}`,
      );
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

  private resolveRecentMessageTake(maxContextRounds: number | null) {
    if (maxContextRounds === null || maxContextRounds === undefined) {
      return 40;
    }
    const rounds = Math.max(1, Math.min(Math.trunc(maxContextRounds), 200));
    return Math.max(2, rounds * 2);
  }

  private async getChatFileRuntimeSettings(): Promise<ChatFileRuntimeSettings> {
    const settings = await this.settings.getPublicSettings();
    const parsedAllowed = settings.chatFileAllowedExtensions
      .split(',')
      .map((item) => item.trim().toLowerCase().replace(/^\./, ''))
      .filter((item) => item.length > 0);

    const supportedByParser = new Set(this.chatFileParser.getSupportedExtensions());
    const allowedExtensions = parsedAllowed.filter((item) => supportedByParser.has(item));
    if (allowedExtensions.length === 0) {
      for (const fallback of DEFAULT_PUBLIC_SETTINGS.chatFileAllowedExtensions.split(',')) {
        const ext = fallback.trim();
        if (ext && supportedByParser.has(ext)) allowedExtensions.push(ext);
      }
    }

    return {
      enabled: settings.chatFileUploadEnabled,
      maxFilesPerMessage: Math.max(1, settings.chatFileMaxFilesPerMessage),
      maxFileSizeMb: Math.max(1, settings.chatFileMaxFileSizeMb),
      maxExtractChars: Math.max(1000, settings.chatFileMaxExtractChars),
      contextMode: settings.chatFileContextMode === 'full' ? 'full' : 'retrieval',
      retrievalTopK: Math.max(1, settings.chatFileRetrievalTopK),
      chunkSize: Math.max(200, settings.chatFileChunkSize),
      chunkOverlap: Math.max(0, Math.min(settings.chatFileChunkOverlap, settings.chatFileChunkSize - 1)),
      retrievalMaxChars: Math.max(1000, settings.chatFileRetrievalMaxChars),
      allowedExtensions: Array.from(new Set(allowedExtensions)),
    };
  }

  private async getWebSearchRuntimeSettings(): Promise<WebSearchRuntimeSettings> {
    const settings = await this.settings.getPublicSettings();

    const modeRaw = (settings.webSearchMode || '').trim().toLowerCase();
    const mode: WebSearchRuntimeSettings['mode'] =
      modeRaw === 'always' ? 'always' : modeRaw === 'auto' ? 'auto' : 'off';

    const timeRangeRaw = (settings.webSearchTimeRange || '').trim().toLowerCase();
    const timeRange: WebSearchRuntimeSettings['timeRange'] =
      timeRangeRaw === 'day' || timeRangeRaw === 'week' || timeRangeRaw === 'month' || timeRangeRaw === 'year'
        ? timeRangeRaw
        : '';

    return {
      enabled: settings.webSearchEnabled,
      baseUrl: (settings.webSearchBaseUrl || '').trim(),
      mode,
      language: (settings.webSearchLanguage || 'zh-CN').trim() || 'zh-CN',
      categories: (settings.webSearchCategories || 'general').trim() || 'general',
      safeSearch: Math.max(0, Math.min(2, Math.trunc(settings.webSearchSafeSearch))),
      timeRange,
      topK: Math.max(1, Math.min(20, Math.trunc(settings.webSearchTopK))),
      timeoutMs: Math.max(1000, Math.min(30_000, Math.trunc(settings.webSearchTimeoutMs))),
      blockedDomains: this.normalizeBlockedDomains(settings.webSearchBlockedDomains),
    };
  }

  private async resolveShouldUseWebSearch(
    content: string,
    requestValue: boolean | undefined,
    settings: WebSearchRuntimeSettings,
  ) {
    if (!settings.enabled || settings.mode === 'off') {
      if (requestValue === true) {
        throw new BadRequestException('未开启联网搜索');
      }
      return false;
    }

    // 用户显式开启时优先联网
    if (requestValue === true) return true;

    // auto: 仅用户手动开启才联网
    if (settings.mode === 'auto') return false;

    // always(自动触发): 使用 function call 判定是否联网
    if (settings.mode === 'always') return this.shouldAutoSearchByFunctionCall(content);

    return false;
  }

  private async shouldAutoSearchByFunctionCall(content: string) {
    const query = (content || '').trim();
    if (!query) return false;

    const aiSettings = await this.aiSettings.getAiSettings();
    const modelName = (aiSettings.webSearchTaskModelName || '').trim();
    const apiBaseUrl = (aiSettings.apiBaseUrl || '').trim();
    const apiKey = (aiSettings.apiKey || '').trim();
    if (!modelName || !apiBaseUrl || !apiKey) {
      return false;
    }

    const now = new Date();
    const currentDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(now);
    const userInput = [`用户问题：${query}`, `当前日期：${currentDate}`].join('\n');

    try {
      const response = await axios.post(
        this.buildChatCompletionUrl(apiBaseUrl),
        {
          model: modelName,
          messages: [
            {
              role: 'system',
              content: this.buildWebSearchAutoTriggerPrompt(),
            },
            {
              role: 'user',
              content: userInput,
            },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'set_web_search',
                description: 'Decide whether this user question needs web search before answering.',
                parameters: {
                  type: 'object',
                  properties: {
                    needWebSearch: { type: 'boolean', description: 'Whether to enable web search.' },
                    reason: { type: 'string', description: 'Brief reason for this decision.' },
                  },
                  required: ['needWebSearch'],
                },
              },
            },
          ],
          tool_choice: {
            type: 'function',
            function: {
              name: 'set_web_search',
            },
          },
          stream: false,
          temperature: 0,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 15_000,
          validateStatus: () => true,
        },
      );

      if (response.status >= 400) {
        this.logger.warn(`Web search auto trigger function call returned HTTP ${response.status}`);
        return false;
      }

      const payload = response.data;
      const upstreamError = this.extractErrorMessage(payload);
      if (upstreamError) {
        this.logger.warn(`Web search auto trigger function call error: ${upstreamError}`);
        return false;
      }

      const args = this.extractFunctionCallArguments(payload, 'set_web_search');
      if (args) {
        const decision = this.resolveAutoWebSearchDecision(args);
        if (decision !== null) return decision;
      }

      const content = this.extractAssistantContent(payload).trim();
      if (content) {
        const parsed = this.tryParseJson(content);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const decision = this.resolveAutoWebSearchDecision(parsed as Record<string, unknown>);
          if (decision !== null) return decision;
        }
      }

      return false;
    } catch (error) {
      this.logger.warn(`Web search auto trigger function call fallback: ${this.normalizeExceptionMessage(error)}`);
      return false;
    }
  }

  private buildWebSearchAutoTriggerPrompt() {
    return [
      '你是联网搜索开关判定器。',
      '你需要判断当前用户问题在回答前是否必须联网搜索。',
      '请严格使用 function call 返回结果，不要输出自然语言正文。',
      '判定标准：',
      '1) 涉及时效性、动态变化、需要最新事实的数据（新闻、价格、汇率、比分、政策、公告、公司动态等）=> needWebSearch=true。',
      '2) 依赖外部事实核验、可能受时间影响的具体事实问题 => needWebSearch=true。',
      '3) 纯常识、数学推导、通用写作改写、无需实时数据的问题 => needWebSearch=false。',
      '4) 当不确定且可能因时效导致答错时，优先 needWebSearch=true。',
    ].join('\n');
  }

  private isFreshnessSensitiveQuery(query: string) {
    const normalized = (query || '').trim().toLowerCase();
    if (!normalized) return false;

    const hints = [
      '今天', '今日', '最新', '实时', '刚刚', '刚才', '近况',
      'today', 'latest', 'real-time', 'breaking', 'recent', 'current', 'now',
    ];
    return hints.some((token) => normalized.includes(token.toLowerCase()));
  }

  private hasExplicitYear(query: string) {
    return /(?:19|20)\d{2}/.test(query || '');
  }

  private containsStaleYear(query: string, minYear: number) {
    const matches = (query || '').match(/(?:19|20)\d{2}/g);
    if (!matches || matches.length === 0) return false;

    for (const raw of matches) {
      const year = Number(raw);
      if (!Number.isFinite(year)) continue;
      if (year < minYear) return true;
    }
    return false;
  }

  private resolveEffectiveWebSearchTimeRange(
    query: string,
    configured: WebSearchRuntimeSettings['timeRange'],
  ): WebSearchRuntimeSettings['timeRange'] {
    if (configured) return configured;

    const normalized = (query || '').trim().toLowerCase();
    if (!normalized) return '';

    if (
      normalized.includes('今天') ||
      normalized.includes('今日') ||
      normalized.includes('刚刚') ||
      normalized.includes('最新') ||
      normalized.includes('实时') ||
      normalized.includes('today') ||
      normalized.includes('latest') ||
      normalized.includes('breaking') ||
      normalized.includes('real-time') ||
      normalized.includes('now')
    ) {
      return 'day';
    }

    if (
      normalized.includes('本周') ||
      normalized.includes('这周') ||
      normalized.includes('最近一周') ||
      normalized.includes('this week') ||
      normalized.includes('past week')
    ) {
      return 'week';
    }

    if (
      normalized.includes('本月') ||
      normalized.includes('这个月') ||
      normalized.includes('this month') ||
      normalized.includes('past month')
    ) {
      return 'month';
    }

    if (
      normalized.includes('今年') ||
      normalized.includes('this year')
    ) {
      return 'year';
    }

    return '';
  }

  private getFreshnessWindowMs(timeRange: WebSearchRuntimeSettings['timeRange']) {
    if (timeRange === 'day') return 3 * 24 * 60 * 60 * 1000;
    if (timeRange === 'week') return 14 * 24 * 60 * 60 * 1000;
    if (timeRange === 'month') return 45 * 24 * 60 * 60 * 1000;
    if (timeRange === 'year') return 400 * 24 * 60 * 60 * 1000;
    return null;
  }

  private filterHitsByFreshness(
    hits: WebSearchHit[],
    query: string,
    timeRange: WebSearchRuntimeSettings['timeRange'],
  ) {
    if (hits.length === 0) return hits;
    const freshnessSensitive = this.isFreshnessSensitiveQuery(query);
    if (!freshnessSensitive && !timeRange) return hits;

    const windowMs = this.getFreshnessWindowMs(timeRange || 'week');
    if (!windowMs) return hits;

    const now = Date.now();
    const filtered = hits.filter((hit) => {
      if (!hit.publishedAt) return true;
      const timestamp = Date.parse(hit.publishedAt);
      if (!Number.isFinite(timestamp)) return true;
      return now - timestamp <= windowMs;
    });

    return filtered.length > 0 ? filtered : hits;
  }

  private async buildFileContext(params: {
    userId: bigint;
    conversationId: bigint;
    fileIds: string[];
    query: string;
    settings: ChatFileRuntimeSettings;
  }): Promise<FileContextBuildResult> {
    if (params.fileIds.length === 0) {
      return { systemMessage: '', attachments: [], citations: [] };
    }

    if (params.fileIds.length > params.settings.maxFilesPerMessage) {
      throw new BadRequestException(`单条消息最多绑定 ${params.settings.maxFilesPerMessage} 个文件`);
    }

    const parsedIds = params.fileIds.map((raw) => this.parseBigInt(raw, 'fileId'));
    const files = await this.prisma.chatFile.findMany({
      where: {
        id: { in: parsedIds },
        userId: params.userId,
        conversationId: params.conversationId,
        status: 'ready',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (files.length !== parsedIds.length) {
      throw new BadRequestException('存在无效文件，或文件不属于当前会话');
    }

    const attachments = files.map((file) => this.mapChatFile(file));
    if (params.settings.contextMode === 'full') {
      const { message, citations } = this.buildFullFileContext(files, params.settings.retrievalMaxChars);
      return { systemMessage: message, attachments, citations };
    }

    const { message, citations } = this.buildRetrievalFileContext(files, params.query, {
      topK: params.settings.retrievalTopK,
      chunkSize: params.settings.chunkSize,
      chunkOverlap: params.settings.chunkOverlap,
      maxChars: params.settings.retrievalMaxChars,
    });
    return { systemMessage: message, attachments, citations };
  }

  private async buildWebSearchContext(params: {
    query: string;
    fileContext?: string;
    shouldUse: boolean;
    explicitRequested: boolean;
    settings: WebSearchRuntimeSettings;
    onProgress?: (progress: WebSearchProgress) => void;
  }): Promise<WebSearchContextBuildResult> {
    if (!params.shouldUse) {
      return { systemMessage: '', citations: [] };
    }

    const normalizedQuery = (params.query || '').trim();
    if (!normalizedQuery) {
      return { systemMessage: '', citations: [] };
    }

    try {
      const effectiveTimeRange = this.resolveEffectiveWebSearchTimeRange(normalizedQuery, params.settings.timeRange);

      params.onProgress?.({
        stage: 'planning',
        message: '正在搜索...',
      });

      const plannedQueries = await this.generateWebSearchQueries({
        query: normalizedQuery,
        fileContext: params.fileContext,
        maxQueries: ChatService.WEB_SEARCH_TASK_QUERY_COUNT,
      });

      const allQueries = [...plannedQueries, normalizedQuery]
        .map((item) => this.normalizeWebSearchQuery(item))
        .filter((item): item is string => Boolean(item));

      const queries: string[] = [];
      const seenQueries = new Set<string>();
      for (const query of allQueries) {
        const normalized = query.toLowerCase();
        if (seenQueries.has(normalized)) continue;
        seenQueries.add(normalized);
        queries.push(query);
        if (queries.length >= ChatService.WEB_SEARCH_TASK_MAX_QUERY_COUNT) break;
      }

      if (queries.length === 0) {
        return {
          systemMessage: this.buildWebSearchNoResultSystemMessage(normalizedQuery),
          citations: [],
        };
      }

      const urlMap = new Map<string, WebSearchHit>();
      for (let i = 0; i < queries.length; i += 1) {
        const query = queries[i];
        params.onProgress?.({
          stage: 'searching',
          message: `搜索中（${i + 1}/${queries.length}）：${query}`,
          searchedQueries: i,
          totalQueries: queries.length,
          searchedArticles: urlMap.size,
        });

        const hits = await this.searchWebHitsWithFilters({
          baseUrl: params.settings.baseUrl,
          query,
          language: params.settings.language,
          categories: params.settings.categories,
          safeSearch: params.settings.safeSearch,
          timeRange: effectiveTimeRange,
          topK: params.settings.topK,
          timeoutMs: params.settings.timeoutMs,
          blockedDomains: params.settings.blockedDomains,
        });

        for (const hit of hits) {
          const url = (hit.url || '').trim();
          if (!url || urlMap.has(url)) continue;
          urlMap.set(url, hit);
          if (urlMap.size >= params.settings.topK) break;
        }

        params.onProgress?.({
          stage: 'searching',
          message: `已搜索 ${i + 1}/${queries.length} 组，累计 ${urlMap.size} 篇资料`,
          searchedQueries: i + 1,
          totalQueries: queries.length,
          searchedArticles: urlMap.size,
        });

        if (urlMap.size >= params.settings.topK) break;
      }

      const rawHits = Array.from(urlMap.values());
      const hits = this.filterHitsByFreshness(rawHits, normalizedQuery, effectiveTimeRange).slice(0, params.settings.topK);
      if (hits.length === 0) {
        params.onProgress?.({
          stage: 'summarizing',
          message: '未检索到可用联网资料，将谨慎回答',
          searchedArticles: 0,
          totalArticles: 0,
        });
        return {
          systemMessage: this.buildWebSearchNoResultSystemMessage(normalizedQuery),
          citations: [],
        };
      }

      params.onProgress?.({
        stage: 'summarizing',
        message: `总结中... 共 ${hits.length} 篇资料`,
        searchedArticles: hits.length,
        totalArticles: hits.length,
      });

      const enrichedHits: Array<WebSearchHit & { pageContent: string }> = [];
      for (let index = 0; index < hits.length; index += 1) {
        const hit = hits[index];
        const pageContent = await this.webSearch.fetchPageContent(hit.url, {
          maxChars: ChatService.WEB_SEARCH_INJECT_PAGE_CHARS,
          timeoutMs: Math.max(1500, Math.min(params.settings.timeoutMs, 12_000)),
        });

        enrichedHits.push({
          ...hit,
          pageContent,
        });

        params.onProgress?.({
          stage: 'summarizing',
          message: `总结中... 已处理 ${index + 1}/${hits.length} 篇资料`,
          searchedArticles: index + 1,
          totalArticles: hits.length,
        });
      }

      const blocks: string[] = [];
      const citations: ChatCitation[] = [];
      enrichedHits.forEach((hit, idx) => {
        const ref = `[W${idx + 1}]`;
        const title = hit.title || `网页来源${idx + 1}`;
        const snippet = (hit.snippet || '').trim();
        const pageContent = (hit.pageContent || '').trim();
        const bodyExcerpt = [pageContent, snippet]
          .filter((item) => item.length > 0)
          .join(' ')
          .slice(0, ChatService.WEB_SEARCH_INJECT_PAGE_CHARS)
          .trim();
        const lines = [
          `${ref} ${title}`,
          `URL: ${hit.url}`,
        ];
        if (hit.domain) lines.push(`Domain: ${hit.domain}`);
        if (hit.publishedAt) lines.push(`Published: ${hit.publishedAt}`);
        if (snippet) lines.push(`Snippet: ${snippet}`);
        if (bodyExcerpt) lines.push(`正文摘要: ${bodyExcerpt}`);
        blocks.push(lines.join('\n'));

        citations.push({
          type: 'web',
          title,
          url: hit.url,
          domain: hit.domain,
          publishedAt: hit.publishedAt,
          snippet: (bodyExcerpt || title).slice(0, 320),
          score: typeof hit.score === 'number' ? Number(hit.score.toFixed(4)) : undefined,
        });
      });

      const systemMessage = [
        '以下是联网搜索结果，请优先基于这些结果回答。',
        '如果结果不足以支撑结论，请明确说明信息不足并给出谨慎建议。',
        '联网搜索结果开始：',
        ...blocks,
        '联网搜索结果结束。',
      ].join('\n\n');

      return { systemMessage, citations };
    } catch (error) {
      if (params.explicitRequested) {
        throw error;
      }
      this.logger.warn(`Web search fallback to disabled for this message: ${this.normalizeExceptionMessage(error)}`);
      return { systemMessage: '', citations: [] };
    }
  }

  private buildWebSearchNoResultSystemMessage(query: string) {
    const shortQuery = query.trim().slice(0, 120);
    const queryLabel = shortQuery ? `“${shortQuery}”` : '当前问题';

    return [
      `系统已尝试联网搜索 ${queryLabel}，但未检索到可注入的有效网页结果。`,
      '禁止把模型已有知识描述成刚刚联网查到的最新信息，也不要伪造来源或引用。',
      '如果用户要求新闻、实时信息、最新动态或网页资料，请明确说明本次联网搜索未获得可用结果，并建议用户稍后重试或缩小查询范围。',
    ].join('\n');
  }

  private async searchWebHitsWithFilters(options: {
    baseUrl: string;
    query: string;
    language: string;
    categories: string;
    safeSearch: number;
    timeRange: '' | 'day' | 'week' | 'month' | 'year';
    topK: number;
    timeoutMs: number;
    blockedDomains: string[];
  }) {
    const targetCount = Math.max(1, Math.min(20, Math.trunc(options.topK)));
    const blockedDomains = options.blockedDomains.filter((item) => item.length > 0);
    const maxPages = blockedDomains.length > 0 ? 5 : 1;
    const perPage = blockedDomains.length > 0 ? 20 : targetCount;

    const output: WebSearchHit[] = [];
    const seenUrls = new Set<string>();

    for (let page = 1; page <= maxPages; page += 1) {
      const seenCountBefore = seenUrls.size;
      const rows = await this.webSearch.search({
        baseUrl: options.baseUrl,
        query: options.query,
        language: options.language,
        categories: options.categories,
        safeSearch: options.safeSearch,
        timeRange: options.timeRange,
        topK: perPage,
        timeoutMs: options.timeoutMs,
        page,
      });

      if (rows.length === 0) break;

      for (const hit of rows) {
        const url = (hit.url || '').trim();
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);

        if (this.isHitBlockedByDomain(hit, blockedDomains)) continue;

        output.push(hit);
        if (output.length >= targetCount) break;
      }

      if (output.length >= targetCount) break;
      if (seenUrls.size === seenCountBefore) break;
    }

    return output;
  }

  private normalizeBlockedDomains(raw: string) {
    const out: string[] = [];
    const seen = new Set<string>();

    for (const token of (raw || '').split(/[\n,;]+/)) {
      const normalized = token
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/^\.*/, '')
        .replace(/\/.*$/, '')
        .replace(/:\d+$/, '')
        .trim();
      if (!normalized) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
      if (out.length >= 200) break;
    }

    return out;
  }

  private isHitBlockedByDomain(hit: WebSearchHit, blockedDomains: string[]) {
    if (blockedDomains.length === 0) return false;

    const domain = (hit.domain || '').trim().toLowerCase();
    let hostname = domain;

    if (!hostname && hit.url) {
      try {
        hostname = new URL(hit.url).hostname.toLowerCase();
      } catch {
        hostname = '';
      }
    }

    if (!hostname) return false;
    return blockedDomains.some((blocked) => this.doesDomainMatch(hostname, blocked));
  }

  private doesDomainMatch(hostnameRaw: string, blockedRaw: string) {
    const hostname = hostnameRaw.trim().toLowerCase().replace(/^www\./, '');
    const blocked = blockedRaw.trim().toLowerCase().replace(/^www\./, '').replace(/^\.*/, '');
    if (!hostname || !blocked) return false;
    return hostname === blocked || hostname.endsWith(`.${blocked}`);
  }

  private async generateWebSearchQueries(params: {
    query: string;
    fileContext?: string;
    maxQueries: number;
  }) {
    const normalizedQuery = this.normalizeWebSearchQuery(params.query);
    if (!normalizedQuery) return [];

    const settings = await this.aiSettings.getAiSettings();
    const modelName = (settings.webSearchTaskModelName || '').trim();
    const apiBaseUrl = (settings.apiBaseUrl || '').trim();
    const apiKey = (settings.apiKey || '').trim();

    if (!modelName || !apiBaseUrl || !apiKey) {
      return [];
    }

    const maxQueries = Math.max(1, Math.min(params.maxQueries, ChatService.WEB_SEARCH_TASK_MAX_QUERY_COUNT));
    const clippedFileContext = (params.fileContext || '')
      .trim()
      .slice(0, ChatService.WEB_SEARCH_TASK_FILE_CONTEXT_MAX_CHARS);

    const userInput = [
      `用户问题：${normalizedQuery}`,
      clippedFileContext ? `补充上下文（来自用户文件）：\n${clippedFileContext}` : '',
    ]
      .filter((item) => item.length > 0)
      .join('\n\n');
    try {
      const response = await axios.post(
        this.buildChatCompletionUrl(apiBaseUrl),
        {
          model: modelName,
          messages: [
            {
              role: 'system',
              content: this.buildWebSearchTaskPlannerPrompt(maxQueries),
            },
            {
              role: 'user',
              content: userInput,
            },
          ],
          stream: false,
          temperature: 0.2,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 20_000,
          validateStatus: () => true,
        },
      );

      if (response.status >= 400) {
        this.logger.warn(`Web search task model returned HTTP ${response.status}`);
        return [];
      }

      const payload = response.data;
      const upstreamError = this.extractErrorMessage(payload);
      if (upstreamError) {
        this.logger.warn(`Web search task model error: ${upstreamError}`);
        return [];
      }

      const content = this.extractAssistantContent(payload);
      let queries = this.parsePlannedSearchQueries(content, maxQueries);
      const freshnessSensitive = this.isFreshnessSensitiveQuery(normalizedQuery);
      const hasYearInUserQuery = this.hasExplicitYear(normalizedQuery);
      if (freshnessSensitive && !hasYearInUserQuery) {
        // 对“今日/最新/实时”类问题，过滤掉明显过旧的年份关键词，避免任务模型注入陈旧日期。
        const minAllowedYear = new Date().getFullYear() - 1;
        queries = queries.filter((item) => !this.containsStaleYear(item, minAllowedYear));
      }
      if (queries.length === 0) {
        return [];
      }
      return queries;
    } catch (error) {
      this.logger.warn(`Web search task model fallback: ${this.normalizeExceptionMessage(error)}`);
      return [];
    }
  }

  private buildWebSearchTaskPlannerPrompt(maxQueries: number) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(now);

    return [
      '你是联网检索任务规划器。你的目标是基于用户问题生成可直接用于搜索引擎的检索词。',
      `当前日期：${currentDate}；当前年份：${currentYear}。`,
      `请给出 ${maxQueries} 条检索词，要求：`,
      '1) 覆盖核心实体、时效信息和权威来源角度。',
      '2) 每条检索词简洁且可执行，不要超过 32 个词。',
      '3) 若用户未明确指定历史时间，且问题属于“今日/最新/实时”语义，不得擅自使用过去年份（如 2024）。',
      '4) 不要输出解释文字。',
      '仅输出 JSON，格式：{"queries":["检索词1","检索词2"]}',
    ].join('\n');
  }

  private parsePlannedSearchQueries(raw: string, maxQueries: number) {
    const clean = (raw || '').trim();
    if (!clean) return [];

    const normalizedLimit = Math.max(1, Math.min(maxQueries, ChatService.WEB_SEARCH_TASK_MAX_QUERY_COUNT));
    const candidates: string[] = [];
    const seen = new Set<string>();

    const pushQuery = (value: string) => {
      const compact = this.normalizeWebSearchQuery(value);
      if (!compact) return;
      const key = compact.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push(compact);
    };

    const parseJsonPayload = (payload: string) => {
      try {
        const parsed = JSON.parse(payload) as unknown;
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (typeof item === 'string') pushQuery(item);
          });
          return;
        }
        if (!parsed || typeof parsed !== 'object') return;
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.queries)) {
          obj.queries.forEach((item) => {
            if (typeof item === 'string') pushQuery(item);
          });
        }
      } catch {
        // no-op
      }
    };

    const fencedMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      parseJsonPayload(fencedMatch[1].trim());
    }
    parseJsonPayload(clean);

    if (candidates.length === 0) {
      clean
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
        .filter((line) => line.length > 0)
        .forEach((line) => pushQuery(line));
    }

    return candidates.slice(0, normalizedLimit);
  }

  private extractFunctionCallArguments(payload: any, expectedFunctionName: string) {
    if (!payload || typeof payload !== 'object') return null;

    const firstChoice = payload.choices?.[0];
    const message = firstChoice?.message;

    const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
    for (const call of toolCalls) {
      const name = call?.function?.name;
      if (name !== expectedFunctionName) continue;
      const args = call?.function?.arguments;
      if (args && typeof args === 'object' && !Array.isArray(args)) {
        return args as Record<string, unknown>;
      }
      if (typeof args === 'string') {
        const parsed = this.tryParseJson(args);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      }
    }

    const functionCall = message?.function_call;
    if (functionCall?.name === expectedFunctionName) {
      const args = functionCall.arguments;
      if (args && typeof args === 'object' && !Array.isArray(args)) {
        return args as Record<string, unknown>;
      }
      if (typeof args === 'string') {
        const parsed = this.tryParseJson(args);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      }
    }

    return null;
  }

  private normalizeBooleanLike(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null;
      if (value === 1) return true;
      if (value === 0) return false;
      return null;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
      if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    }
    return null;
  }

  private resolveAutoWebSearchDecision(args: Record<string, unknown>) {
    const candidates: unknown[] = [
      args.needWebSearch,
      args.need_web_search,
      args.webSearch,
      args.web_search,
      args.enabled,
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeBooleanLike(candidate);
      if (normalized !== null) return normalized;
    }

    return null;
  }

  private buildFullFileContext(files: ChatFile[], maxChars: number) {
    const sections: string[] = [];
    const citations: ChatCitation[] = [];
    let budget = Math.max(1000, maxChars);

    for (const file of files) {
      if (budget <= 0) break;
      const source = (file.extractedText ?? '').trim();
      if (!source) continue;

      const clipped = source.slice(0, budget);
      budget -= clipped.length;

      const ref = `[F${file.id.toString()}]`;
      sections.push(`${ref} ${file.fileName}\n${clipped}`);
      citations.push({
        type: 'file',
        fileId: file.id.toString(),
        fileName: file.fileName,
        extension: file.extension,
        snippet: clipped.slice(0, 260),
      });
    }

    if (sections.length === 0) {
      return { message: '', citations: [] as ChatCitation[] };
    }

    const message = [
      '以下是用户上传文件内容，请优先基于这些内容回答；如果资料不足请明确说明。',
      '文件内容开始：',
      ...sections,
      '文件内容结束。',
    ].join('\n\n');

    return { message, citations };
  }

  private buildRetrievalFileContext(
    files: ChatFile[],
    query: string,
    options: { topK: number; chunkSize: number; chunkOverlap: number; maxChars: number },
  ) {
    const queryTokens = this.tokenizeForSearch(query);
    const candidates: Array<{
      file: ChatFile;
      chunkIndex: number;
      text: string;
      score: number;
    }> = [];

    for (const file of files) {
      const chunks = this.chunkText(file.extractedText ?? '', options.chunkSize, options.chunkOverlap);
      chunks.forEach((chunk, idx) => {
        const score = this.scoreChunkByTokens(chunk, queryTokens);
        candidates.push({
          file,
          chunkIndex: idx + 1,
          text: chunk,
          score,
        });
      });
    }

    candidates.sort((a, b) => b.score - a.score || b.text.length - a.text.length);

    const selected: typeof candidates = [];
    let budget = Math.max(1000, options.maxChars);
    for (const item of candidates) {
      if (selected.length >= options.topK || budget <= 0) break;
      const chunk = item.text.slice(0, budget);
      if (!chunk.trim()) continue;
      selected.push({ ...item, text: chunk });
      budget -= chunk.length;
    }

    if (selected.length === 0) {
      return { message: '', citations: [] as ChatCitation[] };
    }

    const citations: ChatCitation[] = selected.map((item) => ({
      type: 'file',
      fileId: item.file.id.toString(),
      fileName: item.file.fileName,
      extension: item.file.extension,
      snippet: item.text.slice(0, 260),
      score: Number(item.score.toFixed(4)),
      chunkIndex: item.chunkIndex,
    }));

    const blocks = selected.map((item) => {
      const ref = `[F${item.file.id.toString()}-${item.chunkIndex}]`;
      return `${ref} ${item.file.fileName}\n${item.text}`;
    });

    const message = [
      '以下为基于用户问题召回的文件片段，请优先参考这些片段回答，并避免编造不存在的内容。',
      '召回片段开始：',
      ...blocks,
      '召回片段结束。',
    ].join('\n\n');

    return { message, citations };
  }

  private chunkText(text: string, chunkSize: number, overlap: number) {
    const source = (text ?? '').trim();
    if (!source) return [];

    const normalizedSize = Math.max(200, chunkSize);
    const normalizedOverlap = Math.max(0, Math.min(overlap, normalizedSize - 1));
    const step = Math.max(1, normalizedSize - normalizedOverlap);
    const chunks: string[] = [];

    for (let start = 0; start < source.length; start += step) {
      const chunk = source.slice(start, start + normalizedSize).trim();
      if (chunk) chunks.push(chunk);
      if (start + normalizedSize >= source.length) break;
    }

    return chunks;
  }

  private tokenizeForSearch(input: string) {
    return (input || '')
      .toLowerCase()
      .replace(/[^\\p{L}\\p{N}\\s]/gu, ' ')
      .split(/\\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
      .slice(0, 80);
  }

  private scoreChunkByTokens(chunk: string, queryTokens: string[]) {
    const source = chunk.toLowerCase();
    if (queryTokens.length === 0) {
      return Math.min(chunk.length / 3000, 1);
    }

    let hitCount = 0;
    let weighted = 0;
    for (const token of queryTokens) {
      if (!source.includes(token)) continue;
      hitCount += 1;
      weighted += Math.min(token.length, 12);
    }

    if (hitCount === 0) return 0;
    const coverage = hitCount / queryTokens.length;
    const depth = weighted / (queryTokens.length * 10);
    const lengthBonus = Math.min(chunk.length / 2000, 0.2);
    return coverage * 0.65 + depth * 0.35 + lengthBonus;
  }

  private truncateProjectContextText(value: string | null | undefined, maxLength: number) {
    const normalized = (value || '').trim().replace(/\n{3,}/g, '\n\n');
    if (!normalized) return '';
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
  }

  private buildProjectPromptActionSystemMessage(projectName?: string | null) {
    const projectLabel = this.truncateProjectContextText(projectName, 80) || '当前导入项目';

    return [
      `当前聊天已导入项目「${projectLabel}」。`,
      '如果用户明确表达了“新增 / 保存 / 沉淀 / 加入项目提示词”这一类意图，或者明确要求“修改 / 更新 / 重写 / 覆盖 / 替换 项目主提示词、统一风格提示词、风格锚点提示词”，你可以在正常回答结尾追加一个机器可解析的动作块。',
      '动作块格式必须严格如下，且只能追加一次；根据意图二选一：',
      '<project_prompt_action>{"action":"create_project_prompt","type":"image|video","title":"提示词标题","prompt":"完整提示词正文"}</project_prompt_action>',
      '<project_prompt_action>{"action":"upsert_project_master_image_prompt","prompt":"完整的项目统一风格主提示词"}</project_prompt_action>',
      '输出规则：',
      '1. 先正常回答，再单独输出动作块。',
      '2. 动作块必须是纯 JSON，不能放进 Markdown 代码块，不能附带额外解释。',
      '3. 只有在用户确实希望把某条提示词沉淀到项目里，或明确要求修改项目统一风格主提示词时，才输出动作块；普通问答不要输出。',
      `4. 如果用户要改的是当前项目的“主提示词 / 风格提示词 / 统一风格提示词”，优先输出 action="upsert_project_master_image_prompt"；不要再把它当成普通项目提示词新建一条。`,
      '5. 当 action=create_project_prompt 时，title 要简洁明确，prompt 要是可以直接保存复用的完整提示词。',
      `6. 当 action=upsert_project_master_image_prompt 时，prompt 必须是一条完整、专业、可复用的项目级图片统一风格主提示词，用来整体约束后续画风；它对应项目内标题为「${PROJECT_MASTER_IMAGE_PROMPT_TITLE}」的主提示词。`,
      '7. 如果项目已有描述、文档、灵感、分镜或项目提示词体现了既定视觉风格，新提示词必须严格继承同一风格，不要擅自切换画风、镜头语言、色彩体系或材质质感；只有用户明确要求换风格时，才重写主提示词。',
    ].join('\n\n');
  }

  private async buildConversationProjectContextSystemMessage(userId: bigint, projectId?: bigint | null) {
    if (!projectId) return '';

    const [project, documentFiles, assetKindCounts] = await Promise.all([
      this.prisma.project.findFirst({
        where: {
          id: projectId,
          userId,
        },
        select: {
          id: true,
          name: true,
          concept: true,
          description: true,
          _count: {
            select: {
              assets: true,
              inspirations: true,
              prompts: true,
            },
          },
          assets: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: ChatService.PROJECT_CONTEXT_MAX_ASSET_ITEMS,
            select: {
              kind: true,
              title: true,
              description: true,
              sourcePrompt: true,
              fileName: true,
            },
          },
          inspirations: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: ChatService.PROJECT_CONTEXT_MAX_INSPIRATION_ITEMS,
            select: {
              title: true,
              episodeNumber: true,
              ideaText: true,
              contextText: true,
              plotText: true,
              generatedPrompt: true,
            },
          },
          prompts: {
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            take: ChatService.PROJECT_CONTEXT_MAX_PROMPT_ITEMS * 3,
            select: {
              type: true,
              title: true,
              prompt: true,
            },
          },
        },
      }),
      this.prisma.chatFile.findMany({
        where: {
          userId,
          status: 'ready',
          projectAsset: {
            projectId,
            kind: ProjectAssetKind.document,
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: ChatService.PROJECT_CONTEXT_MAX_DOCUMENT_ITEMS,
        select: {
          fileName: true,
          extractedText: true,
          projectAsset: {
            select: {
              title: true,
            },
          },
        },
      }),
      this.prisma.projectAsset.groupBy({
        by: ['kind'],
        where: {
          userId,
          projectId,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    if (!project) return '';

    const masterImagePromptIndex = project.prompts.findIndex(
      (item) =>
        item.type === 'image' &&
        item.title.trim() === PROJECT_MASTER_IMAGE_PROMPT_TITLE &&
        item.prompt.trim().length > 0,
    );
    const prioritizedProjectPrompts =
      masterImagePromptIndex >= 0
        ? [
            project.prompts[masterImagePromptIndex],
            ...project.prompts.filter((_, index) => index !== masterImagePromptIndex),
          ]
        : [...project.prompts];
    const projectPromptItems = prioritizedProjectPrompts.slice(
      0,
      ChatService.PROJECT_CONTEXT_MAX_PROMPT_ITEMS,
    );

    const countByKind = assetKindCounts.reduce(
      (acc, item) => {
        acc[item.kind] = item._count._all;
        return acc;
      },
      {
        [ProjectAssetKind.image]: 0,
        [ProjectAssetKind.video]: 0,
        [ProjectAssetKind.document]: 0,
      } as Record<ProjectAssetKind, number>,
    );

    let assetBudget = 4200;
    const assetSection = project.assets
      .map((asset, index) => {
        if (assetBudget <= 0) return '';

        const kindLabel =
          asset.kind === ProjectAssetKind.image
            ? '图片'
            : asset.kind === ProjectAssetKind.video
              ? '视频'
              : '文档';
        const lines = [
          `[素材${index + 1}] ${kindLabel}｜${this.truncateProjectContextText(asset.title, 120) || '未命名素材'}`,
          asset.fileName ? `文件名：${this.truncateProjectContextText(asset.fileName, 120)}` : null,
          asset.description ? `描述：${this.truncateProjectContextText(asset.description, 320)}` : null,
          asset.sourcePrompt ? `来源提示词：${this.truncateProjectContextText(asset.sourcePrompt, 520)}` : null,
        ]
          .filter(Boolean)
          .join('\n');

        if (!lines) return '';
        assetBudget -= lines.length;
        return lines;
      })
      .filter((item) => item.length > 0)
      .join('\n\n');

    let documentBudget = 5200;
    const documentSection = documentFiles
      .map((item, index) => {
        if (documentBudget <= 0) return '';
        const excerpt = this.truncateProjectContextText(item.extractedText, Math.min(1400, documentBudget));
        if (!excerpt) return '';
        documentBudget -= excerpt.length;
        return [
          `[文档${index + 1}] ${
            this.truncateProjectContextText(item.projectAsset?.title || item.fileName, 120) || '未命名文档'
          }`,
          excerpt,
        ].join('\n');
      })
      .filter((item) => item.length > 0)
      .join('\n\n');

    let inspirationBudget = 4200;
    const inspirationSection = project.inspirations
      .map((item, index) => {
        if (inspirationBudget <= 0) return '';
        const episodeLabel = item.episodeNumber ? `第${item.episodeNumber}集` : `灵感${index + 1}`;
        const lines = [
          `[${episodeLabel}] ${this.truncateProjectContextText(item.title, 120) || '未命名灵感'}`,
          item.ideaText ? `核心想法：${this.truncateProjectContextText(item.ideaText, 700)}` : null,
          item.contextText ? `上下文：${this.truncateProjectContextText(item.contextText, 520)}` : null,
          item.plotText ? `剧情：${this.truncateProjectContextText(item.plotText, 620)}` : null,
          item.generatedPrompt
            ? `已生成分镜提示词：${this.truncateProjectContextText(item.generatedPrompt, 900)}`
            : null,
        ]
          .filter(Boolean)
          .join('\n');

        if (!lines) return '';
        inspirationBudget -= lines.length;
        return lines;
      })
      .filter((item) => item.length > 0)
      .join('\n\n');

    let promptBudget = 3600;
    const promptSection = projectPromptItems
      .map((item, index) => {
        if (promptBudget <= 0) return '';
        const isMasterImagePrompt =
          item.type === 'image' && item.title.trim() === PROJECT_MASTER_IMAGE_PROMPT_TITLE;
        const typeLabel = isMasterImagePrompt
          ? '图片提示词｜项目统一风格主提示词'
          : item.type === 'video'
            ? '视频提示词'
            : '图片提示词';
        const lines = [
          `[项目提示词${index + 1}] ${typeLabel}｜${this.truncateProjectContextText(item.title, 120) || '未命名提示词'}`,
          this.truncateProjectContextText(item.prompt, Math.min(900, promptBudget)),
        ]
          .filter(Boolean)
          .join('\n');

        if (!lines) return '';
        promptBudget -= lines.length;
        return lines;
      })
      .filter((item) => item.length > 0)
      .join('\n\n');

    return [
      '以下是当前聊天已导入的项目上下文。请把它视为本轮对话持续生效的背景资料，并在理解需求、生成描述、生成分镜提示词、生成图片提示词、生成视频提示词时主动参考。',
      '不要声称你看到了项目中的具体图片或视频画面，因为你现在拿到的是项目的文字资料、素材元数据、文档解析文本、灵感、分镜和已有提示词，而不是素材像素内容。',
      `项目名称：${this.truncateProjectContextText(project.name, 120)}`,
      project.concept ? `项目主题 / 灵感：${this.truncateProjectContextText(project.concept, 1600)}` : null,
      project.description ? `项目描述：${this.truncateProjectContextText(project.description, 2400)}` : null,
      `项目概览：共 ${project._count.assets} 个素材（图片 ${countByKind[ProjectAssetKind.image]}、视频 ${countByKind[ProjectAssetKind.video]}、文档 ${countByKind[ProjectAssetKind.document]}），${project._count.inspirations} 条灵感，${project._count.prompts} 条项目提示词。`,
      assetSection ? `项目素材信息：\n${assetSection}` : null,
      documentSection ? `项目文档解析内容：\n${documentSection}` : null,
      inspirationSection ? `项目灵感与分镜信息：\n${inspirationSection}` : null,
      promptSection ? `项目已有提示词：\n${promptSection}` : null,
      '使用要求：',
      '1. 优先继承项目里已经确立的人物设定、世界观规则、叙事方向、镜头逻辑和视觉风格。',
      `2. 如果项目已有标题为「${PROJECT_MASTER_IMAGE_PROMPT_TITLE}」的图片提示词，把它视为当前项目后续所有单图生成的最高优先级风格锚点；除非用户明确要求改风格，否则不要偏离它。`,
      '3. 如果用户让你生成新的项目描述、分镜提示词、图片提示词或视频提示词，必须主动吸收项目文档、灵感、已有提示词和素材说明中的关键信息。',
      '4. 同一个项目里的所有图片提示词都应保持严格一致的风格锚点；除非用户明确要求改风格，否则不要擅自改变画风、镜头语言、色彩体系、光影策略或材质质感。',
    ]
      .filter((item): item is string => Boolean(item && item.trim()))
      .join('\n\n');
  }

  private injectSystemContextIntoUpstream(
    messages: UpstreamMessage[],
    ...contexts: Array<string | null | undefined>
  ) {
    const mergedContext = contexts
      .map((item) => (item || '').trim())
      .filter((item) => item.length > 0)
      .join('\n\n');
    if (!mergedContext) return messages;

    const injected: UpstreamMessage = {
      role: 'system',
      content: mergedContext,
    };

    const firstMessage = messages[0];
    if (firstMessage?.role === 'system') {
      const firstContent = this.normalizeUpstreamContent(firstMessage.content).trim();
      const mergedSystemMessage: UpstreamMessage = {
        role: 'system',
        content: [firstContent, mergedContext].filter((item) => item.length > 0).join('\n\n'),
      };
      return [
        mergedSystemMessage,
        ...messages.slice(1),
      ];
    }

    return [injected, ...messages];
  }

  private normalizeMediaAgentContext(
    raw?: SendMessageDto['mediaAgent'] | SendMessageDto['imageAgent'],
  ): MediaAgentContext | null {
    if (!raw?.enabled) return null;

    const source = raw as unknown as Record<string, unknown>;
    const modelIdCandidate =
      (typeof source.modelId === 'string' ? source.modelId : '') ||
      (typeof source.imageModelId === 'string' ? source.imageModelId : '');
    const modelId = modelIdCandidate.trim();
    if (!modelId) {
      throw new BadRequestException('mediaAgent.modelId is required');
    }

    const preferredAspectRatio =
      typeof source.preferredAspectRatio === 'string' && source.preferredAspectRatio.trim()
        ? source.preferredAspectRatio.trim().slice(0, 40)
        : null;
    const preferredResolution =
      typeof source.preferredResolution === 'string' && source.preferredResolution.trim()
        ? source.preferredResolution.trim().slice(0, 40)
        : null;
    const preferredDuration =
      typeof source.preferredDuration === 'string' && source.preferredDuration.trim()
        ? source.preferredDuration.trim().slice(0, 40)
        : null;

    return {
      enabled: true,
      modelId,
      preferredAspectRatio,
      preferredResolution,
      preferredDuration,
      referenceImages: this.normalizeImages(Array.isArray(source.referenceImages) ? (source.referenceImages as string[]) : [], 20),
      referenceVideos: this.normalizeStringList(source.referenceVideos, 10),
      referenceAudios: this.normalizeStringList(source.referenceAudios, 10),
      autoCreate: source.autoCreate === true,
    };
  }

  private supportsMediaAgentImageModel(
    model: AiModel,
    capabilities: ReturnType<typeof buildModelCapabilities>,
  ) {
    return model.type === AiModelType.image && capabilities.supports.contextualEdit;
  }

  private supportsMediaAgentVideoModel(
    model: AiModel,
    capabilities: ReturnType<typeof buildModelCapabilities>,
  ) {
    if (model.type !== AiModelType.video) return false;
    if (isWanxProvider(model.provider)) {
      return this.isWanxR2vVideoModel(model) && capabilities.supports.contextualEdit;
    }
    return capabilities.supports.contextualEdit;
  }

  private isWanxR2vVideoModel(model: {
    provider: string;
    modelKey?: string | null;
  }) {
    return isWanxProvider(model.provider) && resolveWanxVideoModelKind(model.modelKey) === 'r2v';
  }

  private resolveWanxT2vVideoModelOverride(model: {
    provider: string;
    modelKey?: string | null;
  }) {
    if (!this.isWanxR2vVideoModel(model)) return null;
    return resolveWanxSiblingVideoModelKey(model.modelKey, 't2v');
  }

  private hasAnyNonEmptyMediaInput(input: {
    currentImages: string[];
    currentVideos: string[];
    currentAudios: string[];
  }) {
    return [...input.currentImages, ...input.currentVideos, ...input.currentAudios]
      .some((item) => typeof item === 'string' && item.trim().length > 0);
  }

  private isSeedance20VideoModel(model: {
    provider: string;
    modelKey?: string | null;
  }) {
    const providerKey = normalizeProviderKey(model.provider);
    const remoteModel = String(model.modelKey ?? '').trim().toLowerCase();
    return (
      (providerKey.includes('doubao') || providerKey.includes('bytedance') || providerKey.includes('ark'))
      && remoteModel.includes('seedance-2-0')
    );
  }

  private buildWanxR2vContextVideoParameters(input: {
    currentImages: string[];
    currentVideos: string[];
    currentAudios: string[];
    firstFrameImage?: string | null;
  }) {
    const parameters: Record<string, unknown> = {};
    const firstFrame = input.firstFrameImage?.trim() || null;
    const totalVisualBudget = Math.max(0, 5 - (firstFrame ? 1 : 0));

    let referenceImages = input.currentImages
      .map((item) => item.trim())
      .filter((item) => Boolean(item));
    let referenceVideos = input.currentVideos
      .map((item) => item.trim())
      .filter((item) => Boolean(item));

    if (referenceImages.length === 0 && referenceVideos.length === 0 && firstFrame) {
      referenceImages = [firstFrame];
    }

    const cappedImages = referenceImages.slice(0, totalVisualBudget);
    const remainingVisualBudget = Math.max(0, totalVisualBudget - cappedImages.length);
    const cappedVideos = referenceVideos.slice(0, remainingVisualBudget);
    const visualCount = cappedImages.length + cappedVideos.length;
    const cappedAudios = input.currentAudios
      .map((item) => item.trim())
      .filter((item) => Boolean(item))
      .slice(0, visualCount);

    if (firstFrame) {
      parameters.firstFrame = firstFrame;
    }
    if (cappedImages.length > 0) {
      parameters.referenceImages = cappedImages;
    }
    if (cappedVideos.length > 0) {
      parameters.referenceVideos = cappedVideos;
    }
    if (cappedAudios.length > 0) {
      parameters.referenceAudios = cappedAudios;
    }

    return parameters;
  }

  private resolveConversationComposerMode(input: {
    mediaAgent: MediaAgentContext | null;
    autoProjectAgent: ReturnType<typeof parseAutoProjectAgentContext>;
  }): ConversationComposerMode {
    if (input.autoProjectAgent?.enabled) return 'auto';
    if (input.mediaAgent?.enabled) return 'image';
    return 'chat';
  }

  private async assertConversationComposerMode(input: {
    conversationId: bigint;
    requestedMode: ConversationComposerMode;
  }) {
    const lockedMode = await this.resolveConversationComposerModeLock(input.conversationId);
    if (!lockedMode || lockedMode === input.requestedMode) {
      return;
    }

    const modeLabel =
      lockedMode === 'auto'
        ? 'Auto Mode'
        : lockedMode === 'image'
          ? 'Agent Mode'
          : 'Chat Mode';
    throw new BadRequestException(`This conversation is locked to ${modeLabel}`);
  }

  private async resolveConversationComposerModeLock(
    conversationId: bigint,
  ): Promise<ConversationComposerMode | null> {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { composerMode: true },
    });
    const persistedMode = this.normalizeConversationComposerMode(conversation?.composerMode);
    if (persistedMode) {
      return persistedMode;
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        providerData: true,
      },
    });

    const resolvedMode = this.resolveComposerModeLockFromMessages(messages);
    if (resolvedMode) {
      await this.prisma.chatConversation.updateMany({
        where: {
          id: conversationId,
          composerMode: null,
        },
        data: {
          composerMode: resolvedMode,
        },
      });
    }

    return resolvedMode;
  }

  private resolveComposerModeLockFromMessages(
    messages: Array<{ providerData: Prisma.JsonValue | null }>,
  ): ConversationComposerMode | null {
    if (messages.length === 0) {
      return null;
    }

    for (const message of messages) {
      if (extractAutoProjectAgentFromProviderData(message.providerData ?? null)) {
        return 'auto';
      }
      if (this.extractMediaAgentFromProviderData(message.providerData ?? null)) {
        return 'image';
      }
    }

    return 'chat';
  }

  private normalizeConversationComposerMode(
    value: string | null | undefined,
  ): ConversationComposerMode | null {
    if (value === 'chat' || value === 'image' || value === 'auto') {
      return value;
    }
    return null;
  }

  private buildMediaAgentSystemPrompt(input: {
    targetModel: AiModel;
    preferredAspectRatio: string | null;
    preferredResolution: string | null;
    preferredDuration: string | null;
    referenceImageCount: number;
    referenceVideoCount: number;
    referenceAudioCount: number;
    autoCreate: boolean;
    hasConversationGeneratedMedia: boolean;
  }) {
    const mediaLabel = input.targetModel.type === AiModelType.video ? 'video' : 'image';
    const isVideoTarget = input.targetModel.type === AiModelType.video;
    const isSeedance20VideoTarget = isVideoTarget && this.isSeedance20VideoModel(input.targetModel);
    const submissionHint = input.autoCreate
      ? `- When the request is specific enough, mark the result as ready so the system can create the ${mediaLabel} task immediately after your response.`
      : input.hasConversationGeneratedMedia
        ? `- Default behavior: when the request is specific enough, mark the result as ready, show the polished prompt, and explicitly ask the user to confirm before any ${mediaLabel} task is submitted. Exception: if the user is clearly asking to revise or edit an earlier generated ${mediaLabel} result in this conversation and the request is already specific enough, mark the result as ready so the system can submit the edit task immediately. In that edit case, do not ask for confirmation.`
        : `- When the request is specific enough, mark the result as ready, show the polished prompt, and explicitly ask the user to confirm before any ${mediaLabel} task is submitted.`;
    const aspectRatioHint = input.preferredAspectRatio
      ? `- Manual aspect ratio is already locked to "${input.preferredAspectRatio}". Respect it unless the user explicitly wants to change it.`
      : `- No manual aspect ratio is locked. Only ask about framing if it materially changes the ${mediaLabel}.`;
    const resolutionHint = input.preferredResolution
      ? `- Manual resolution/size is already locked to "${input.preferredResolution}".`
      : '- No manual resolution/size is locked.';
    const durationHint =
      input.targetModel.type === AiModelType.video
        ? input.preferredDuration
          ? `- Manual duration is already locked to "${input.preferredDuration}".`
          : '- No manual duration is locked.'
        : '- Duration is not relevant unless the user is generating video.';
    const referenceHints = [
      input.referenceImageCount > 0
        ? `- ${input.referenceImageCount} reference image(s) are attached.`
        : '- No reference images are attached right now.',
      input.referenceVideoCount > 0
        ? `- ${input.referenceVideoCount} reference video(s) are attached.`
        : '- No reference videos are attached right now.',
      input.referenceAudioCount > 0
        ? `- ${input.referenceAudioCount} reference audio file(s) are attached.`
        : '- No reference audio files are attached right now.',
      input.hasConversationGeneratedMedia
        ? `- Earlier generated ${mediaLabel} results exist in this conversation and can be reused when the user clearly wants an edit or revision.`
        : `- There is no earlier generated ${mediaLabel} result available for reuse right now.`,
    ];
    const mediaQualityHints = isVideoTarget
      ? [
          '- For video prompts, act like a prompt director: produce an engineered, production-ready video prompt rather than a loose pile of adjectives.',
          '- The final optimizedPrompt must be direct model-ready prompt text only. Do not include explanation, checklist, JSON fragments, or meta commentary inside optimizedPrompt.',
          '- The final optimizedPrompt does not need a fixed heading template, but the content itself must clearly cover these dimensions when relevant: shot setup (shot size, camera position, one dominant camera move, total duration), narrative goal (who the subject is, what action happens, what emotion is maintained), timeline execution split into exactly 3 beats (opening entry, middle main action, ending resolution), dialogue handling (lip-sync and pause-sync when there is dialogue; breathing, gaze, and body language when there is no dialogue), ending transition pose for the next shot, consistency constraints, style supplements, and quality constraints.',
          '- Make the shot setup explicit inside the prompt: shot size, camera position, one dominant camera movement, and the total duration or duration intent.',
          '- Make the narrative goal explicit: who the subject is, what the main action is, and what emotion should stay consistent through the shot.',
          '- Even without fixed headings, write the temporal execution in exactly 3 beats: opening entry, middle main action, ending resolution.',
          '- If there is dialogue, explicitly require lip-sync and pause-sync. If there is no dialogue, explicitly require emotion to be carried by breathing, gaze, and body language.',
          '- Require the ending to land in a pose or state that can naturally connect into the next shot.',
          '- If reference images are attached, explicitly require clothing, scene, and props to remain stable and not drift.',
          '- Preserve and fold the style words and the base action description into the final prompt instead of dropping them.',
          '- Explicitly stress coherent motion, physical plausibility, and avoiding frame skipping or deformation.',
          '- If reference images, reference videos, or reference audio are attached, use them semantically to preserve identity, appearance, motion, rhythm, framing, or atmosphere. Do not invent numbered labels, fake placeholders, filenames, or any system-internal identifiers inside optimizedPrompt.',
          isSeedance20VideoTarget
            ? '- For Seedance 2.0, a previous/reference video should be used as style and consistency context only. Do not write first-frame or hard continuation wording such as “以...为首帧”, “接着...继续生成”, or “从上一段末尾继续” in optimizedPrompt; describe the new shot as an independent shot that references the previous video style, lighting, character appearance, and rhythm.'
            : '',
          '- If the user is editing or revising an existing result, preserve subject identity, motion direction, framing logic, and scene continuity unless the user explicitly asks to change them.',
          '- Keep one dominant camera movement per shot or beat. Remove conflicting instructions such as push-in plus pan-left plus pull-back unless one clear movement remains.',
          '- You may express temporal progression naturally with phrases like "开场", "中段", and "结尾". A rigid title format is optional, but the 3-beat execution logic is required. If manual duration is already locked, use that duration as the basis of the 3-beat plan.',
          '- For multi-character, frontal, or high-motion scenes, add strong spatial anchors, clothing or identity anchors, and simpler camera language to reduce face drift, body glitches, and role swapping.',
          '- End video optimizedPrompt with high-quality and anti-collapse constraints such as 4K高清、细节丰富、人物面部稳定、五官清晰、肢体自然、无变形、无穿模、动作连贯、物理合理、避免跳帧、镜头稳定衔接.',
        ]
      : [
          '- For image prompts, make composition, subject, style, and lighting explicit when helpful.',
        ];

    return [
      `You are an AI ${mediaLabel} creation agent working inside a chat product.`,
      `The target ${mediaLabel} model for the final generation is "${input.targetModel.name}" (provider: ${input.targetModel.provider}).`,
      aspectRatioHint,
      resolutionHint,
      durationHint,
      ...referenceHints,
      submissionHint,
      `- Your job is to help the user reach a production-ready ${mediaLabel} prompt, not to answer broadly unrelated questions.`,
      '- If the request is still underspecified, ask only the next most valuable question. Keep it concise, concrete, and helpful.',
      '- Choose intent="edit" only when the user is clearly trying to revise an existing result or use current reference media as the editing context.',
      '- Choose intent="generate" when the user wants a fresh new result or a clear restart.',
      ...mediaQualityHints,
      '- Suggested quick replies must be short, clickable, and mutually distinct.',
      '- The fields "optimizedPrompt" and "negativePrompt" must always be written in Simplified Chinese, regardless of the user language.',
      '- The user-facing "reply" and "suggestedReplies" can follow the user language, but the actual generation prompt must stay in Simplified Chinese.',
      '- Return ONLY valid JSON. Do not use markdown fences. Do not add any text outside the JSON object.',
      'Use exactly this JSON schema:',
      '{"reply":"string","status":"clarify|ready","intent":"edit|generate","optimizedPrompt":"string|null","negativePrompt":"string|null","suggestedReplies":["string"]}',
      '- reply: user-visible assistant reply.',
      '- status: "clarify" if you still need one more round, "ready" if the system can generate now.',
      '- intent: "edit" when the generation should reuse an existing result/reference context, otherwise "generate".',
      '- optimizedPrompt: final polished prompt only when status is "ready"; otherwise null.',
      '- negativePrompt: optional negative prompt for image generation; otherwise null.',
      '- suggestedReplies: 0 to 4 short suggestions. When clarifying, prefer 2 to 4. When ready, use them only for revisions or confirmation shortcuts if truly helpful.',
    ].join('\n');
  }

  private parseMediaAgentResponse(rawContent: string): ParsedMediaAgentResponse {
    const raw = (rawContent || '').trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1]?.trim() || raw;
    const parsed = this.tryParseJson(candidate);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        reply: raw || 'I need one more detail before I generate the media.',
        status: 'clarify',
        intent: 'generate',
        optimizedPrompt: null,
        negativePrompt: null,
        suggestedReplies: [],
      };
    }

    const source = parsed as Record<string, unknown>;
    const replyCandidate = this.normalizeUpstreamContent(
      source.reply ?? source.message ?? source.assistantReply,
    ).trim();
    const statusRaw = this.normalizeUpstreamContent(source.status ?? source.stage).trim().toLowerCase();
    const intentRaw = this.normalizeUpstreamContent(source.intent ?? source.generationIntent).trim().toLowerCase();
    const optimizedPrompt = this.normalizeUpstreamContent(
      source.optimizedPrompt ?? source.prompt ?? source.finalPrompt,
    ).trim();
    const negativePrompt = this.normalizeUpstreamContent(source.negativePrompt).trim();
    const suggestedReplies = Array.isArray(source.suggestedReplies)
      ? source.suggestedReplies
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0)
          .slice(0, 4)
      : [];

    const normalizedStatus: MediaAgentStatus =
      statusRaw === 'ready' && optimizedPrompt
        ? 'ready'
        : 'clarify';

    return {
      reply:
        replyCandidate ||
        (normalizedStatus === 'ready'
          ? 'I have enough detail and the media can be generated now.'
          : 'I need one more detail before I generate the media.'),
      status: normalizedStatus,
      intent: intentRaw === 'edit' ? 'edit' : 'generate',
      optimizedPrompt: normalizedStatus === 'ready' ? optimizedPrompt : null,
      negativePrompt: negativePrompt || null,
      suggestedReplies,
    };
  }

  private isLikelyChineseText(value: string) {
    return /[\u4e00-\u9fff]/.test(value);
  }

  private sanitizeSeedance20MediaAgentPrompt(prompt: string | null) {
    const normalized = (prompt ?? '').trim();
    if (!normalized) return prompt;

    const forbiddenSentencePattern = /(首帧|接着.{0,30}继续生成|从上一.{0,20}末尾|上一段末尾|同一镜头续拍)/;
    const parts = normalized
      .split(/(?<=[。！？!?])|\n+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    const kept = parts.filter((part) => !forbiddenSentencePattern.test(part));

    if (kept.length > 0 && kept.length < parts.length) {
      return kept.join('\n').trim();
    }

    return normalized
      .replace(/请?以[^，。；;]{0,40}为首帧[，,。；;]?/g, '')
      .replace(/接着[^，。；;]{0,40}继续生成[，,。；;]?/g, '')
      .trim();
  }

  private needsChinesePromptRewrite(value: string | null | undefined) {
    const normalized = (value ?? '').trim();
    if (!normalized) return false;
    return !this.isLikelyChineseText(normalized);
  }

  private async rewriteCreativePromptPairToChinese(params: {
    conversation: {
      model: {
        modelKey: string;
        defaultParams: Prisma.JsonValue | null;
        channel: {
          baseUrl: string;
          apiKey: string | null;
          extraHeaders: Prisma.JsonValue | null;
          timeout: number;
        };
      };
    };
    kind: 'image' | 'video';
    prompt: string;
    negativePrompt?: string | null;
  }) {
    const prompt = params.prompt.trim();
    const negativePrompt = (params.negativePrompt ?? '').trim() || null;

    if (!this.needsChinesePromptRewrite(prompt) && !this.needsChinesePromptRewrite(negativePrompt)) {
      return {
        prompt,
        negativePrompt,
      };
    }

    try {
      const completion = await this.requestChatCompletion(params.conversation, [
        {
          role: 'system',
          content: [
            'You are a localization editor for AI image and video generation prompts.',
            'Rewrite the provided prompt content into polished Simplified Chinese for direct model generation.',
            'Keep the original creative intent, subject, composition, style, lighting, motion, camera language, pacing, aspect ratios, durations, resolutions, and technical constraints unchanged.',
            'Preserve product names, brand names, model names, IDs, file names, URLs, and special tokens exactly when needed.',
            'negativePrompt must also be Simplified Chinese when present.',
            'Return ONLY valid JSON without markdown fences.',
            'Use exactly this JSON schema:',
            '{"prompt":"string","negativePrompt":"string|null"}',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            kind: params.kind,
            prompt,
            negativePrompt,
          }),
        },
      ]);

      const raw = completion.content.trim();
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = fenced?.[1]?.trim() || raw;
      const parsed = this.tryParseJson(candidate);

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { prompt, negativePrompt };
      }

      const source = parsed as Record<string, unknown>;
      const rewrittenPrompt = this.normalizeUpstreamContent(source.prompt).trim() || prompt;
      const rewrittenNegativePrompt =
        this.normalizeUpstreamContent(source.negativePrompt).trim() || negativePrompt;

      return {
        prompt: rewrittenPrompt,
        negativePrompt: rewrittenNegativePrompt || null,
      };
    } catch {
      return {
        prompt,
        negativePrompt,
      };
    }
  }

  private toChatImageTaskRef(task: {
    id: string;
    taskNo: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    modelId: string;
    provider: string;
    prompt: string;
    thumbnailUrl: string | null;
    resultUrl: string | null;
    errorMessage: string | null;
    creditsCost: number | null;
    createdAt: Date;
    completedAt: Date | null;
  }): ChatTaskRef {
    return {
      kind: 'image',
      taskId: task.id,
      taskNo: task.taskNo,
      status: task.status,
      modelId: task.modelId,
      provider: task.provider,
      prompt: task.prompt,
      thumbnailUrl: task.thumbnailUrl,
      resultUrl: task.resultUrl,
      errorMessage: task.errorMessage,
      creditsCost: task.creditsCost,
      createdAt: task.createdAt.toISOString(),
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    };
  }

  private toChatVideoTaskRef(task: {
    id: string;
    taskNo: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    modelId: string;
    provider: string;
    prompt: string;
    thumbnailUrl: string | null;
    resultUrl: string | null;
    errorMessage: string | null;
    creditsCost: number | null;
    createdAt: Date;
    completedAt: Date | null;
    canCancel?: boolean;
    cancelSupported?: boolean;
  }, metadata?: {
    shotId?: string | null;
    finalStoryboard?: boolean;
  }): ChatTaskRef {
    const taskRef: ChatTaskRef = {
      kind: 'video',
      taskId: task.id,
      taskNo: task.taskNo,
      status: task.status,
      modelId: task.modelId,
      provider: task.provider,
      prompt: task.prompt,
      thumbnailUrl: task.thumbnailUrl,
      resultUrl: task.resultUrl,
      errorMessage: task.errorMessage,
      creditsCost: task.creditsCost,
      createdAt: task.createdAt.toISOString(),
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      ...(typeof task.canCancel === 'boolean' ? { canCancel: task.canCancel } : {}),
      ...(typeof task.cancelSupported === 'boolean' ? { cancelSupported: task.cancelSupported } : {}),
    };

    if (metadata?.shotId) {
      taskRef.shotId = metadata.shotId;
    }
    if (metadata?.finalStoryboard === true) {
      taskRef.finalStoryboard = true;
    }

    return taskRef;
  }

  private async completeMediaAgentTurn(params: {
    userId: bigint;
    conversationId: bigint;
    conversation: {
      projectContext?: {
        id: bigint;
      } | null;
      model: {
        id: bigint;
        name: string;
        provider: string;
        modelKey: string;
        defaultParams: Prisma.JsonValue | null;
        supportsImageInput: boolean | null;
        channel: {
          baseUrl: string;
          apiKey: string | null;
          extraHeaders: Prisma.JsonValue | null;
          timeout: number;
        };
        systemPrompt: string | null;
      };
    };
    recentMessages: Array<{
      role: ChatMessageRole;
      content: string;
      images: Prisma.JsonValue | null;
      files?: Prisma.JsonValue | null;
    }>;
    mediaAgent: MediaAgentContext;
    sourceUserMessageId: string;
  }) {
    const latestUserInput =
      [...params.recentMessages]
        .reverse()
        .find((message) => message.role === ChatMessageRole.user)
        ?.content
        ?.trim() || '';
    const preferChinese = this.isLikelyChineseText(latestUserInput);
    const targetModelId = this.parseBigInt(params.mediaAgent.modelId, 'mediaAgent.modelId');
    const targetModel = await this.prisma.aiModel.findFirst({
      where: {
        id: targetModelId,
        type: { in: [AiModelType.image, AiModelType.video] },
        isActive: true,
      },
    });
    if (!targetModel) {
      throw new BadRequestException('Target media model not found or inactive');
    }

    const targetCapabilities = buildModelCapabilities(targetModel as AiModel, null);
    const supportsMediaAgent =
      targetModel.type === AiModelType.image
        ? this.supportsMediaAgentImageModel(targetModel, targetCapabilities)
        : this.supportsMediaAgentVideoModel(targetModel, targetCapabilities);

    if (!supportsMediaAgent) {
      throw new BadRequestException('Selected model does not support contextual editing in chat');
    }

    const existingGeneratedMedia = await this.collectConversationGeneratedMediaAssets({
      userId: params.userId,
      conversationId: params.conversationId,
      kind: targetModel.type === AiModelType.video ? 'video' : 'image',
      limit: 1,
    });
    const projectContextSystemMessage = await this.buildConversationProjectContextSystemMessage(
      params.userId,
      params.conversation.projectContext?.id ?? null,
    );

    const upstreamMessages = this.toUpstreamMessages(params.recentMessages, {
      includeImages: Boolean(params.conversation.model.supportsImageInput),
    });
    const completion = await this.requestChatCompletion(
      params.conversation,
      this.injectSystemContextIntoUpstream(
        upstreamMessages,
        params.conversation.model.systemPrompt,
        projectContextSystemMessage,
        this.buildMediaAgentSystemPrompt({
          targetModel,
          preferredAspectRatio: params.mediaAgent.preferredAspectRatio ?? null,
          preferredResolution: params.mediaAgent.preferredResolution ?? null,
          preferredDuration: params.mediaAgent.preferredDuration ?? null,
          referenceImageCount: params.mediaAgent.referenceImages.length,
          referenceVideoCount: params.mediaAgent.referenceVideos.length,
          referenceAudioCount: params.mediaAgent.referenceAudios.length,
          autoCreate: params.mediaAgent.autoCreate,
          hasConversationGeneratedMedia: existingGeneratedMedia.length > 0,
        }),
      ),
    );

    const parsed = this.parseMediaAgentResponse(completion.content);
    const localizedPromptPair =
      parsed.optimizedPrompt || parsed.negativePrompt
        ? await this.rewriteCreativePromptPairToChinese({
            conversation: params.conversation,
            kind: targetModel.type === AiModelType.video ? 'video' : 'image',
            prompt: parsed.optimizedPrompt ?? '',
            negativePrompt: parsed.negativePrompt ?? null,
          })
        : null;
    const rawFinalOptimizedPrompt = localizedPromptPair?.prompt || parsed.optimizedPrompt;
    const finalOptimizedPrompt =
      targetModel.type === AiModelType.video &&
      this.isSeedance20VideoModel(targetModel) &&
      (params.mediaAgent.referenceVideos.length > 0 || existingGeneratedMedia.length > 0)
        ? this.sanitizeSeedance20MediaAgentPrompt(rawFinalOptimizedPrompt)
        : rawFinalOptimizedPrompt;
    const finalNegativePrompt =
      targetModel.type === AiModelType.image
        ? localizedPromptPair?.negativePrompt ?? parsed.negativePrompt
        : null;
    const autoCreateFromConversationEdit =
      parsed.status === 'ready' &&
      parsed.intent === 'edit' &&
      existingGeneratedMedia.length > 0 &&
      !params.mediaAgent.autoCreate;
    const providerData: Record<string, unknown> =
      completion.providerData && typeof completion.providerData === 'object'
        ? { ...(completion.providerData as Record<string, unknown>) }
        : {};

    let taskRefs: ChatTaskRef[] = [];
    let autoCreated = false;

    if (
      parsed.status === 'ready' &&
      finalOptimizedPrompt &&
      (params.mediaAgent.autoCreate || autoCreateFromConversationEdit)
    ) {
      if (targetModel.type === AiModelType.image) {
        const { createdTask } = await this.generateConversationImageTask({
          userId: params.userId,
          conversationId: params.conversationId,
          imageModelIdRaw: params.mediaAgent.modelId,
          projectId: params.conversation.projectContext?.id ?? null,
          prompt: finalOptimizedPrompt,
          negativePrompt: finalNegativePrompt ?? undefined,
          currentImages: params.mediaAgent.referenceImages,
          useConversationContextEdit: parsed.intent === 'edit',
          preferredAspectRatio: params.mediaAgent.preferredAspectRatio ?? null,
          preferredResolution: params.mediaAgent.preferredResolution ?? null,
        });
        taskRefs = [this.toChatImageTaskRef(createdTask)];
      } else {
        const { createdTask } = await this.generateConversationVideoTask({
          userId: params.userId,
          conversationId: params.conversationId,
          videoModelIdRaw: params.mediaAgent.modelId,
          projectId: params.conversation.projectContext?.id ?? null,
          prompt: finalOptimizedPrompt,
          currentImages: params.mediaAgent.referenceImages,
          currentVideos: params.mediaAgent.referenceVideos,
          currentAudios: params.mediaAgent.referenceAudios,
          useConversationContextEdit: parsed.intent === 'edit',
          preferredAspectRatio: params.mediaAgent.preferredAspectRatio ?? null,
          preferredResolution: params.mediaAgent.preferredResolution ?? null,
          preferredDuration: params.mediaAgent.preferredDuration ?? null,
        });
        taskRefs = [this.toChatVideoTaskRef(createdTask)];
      }
      autoCreated = taskRefs.length > 0;
    }

    const mediaAgentMetadata: MediaAgentMetadata = {
      status: parsed.status,
      intent: parsed.intent,
      optimizedPrompt: finalOptimizedPrompt,
      negativePrompt: finalNegativePrompt,
      suggestedReplies: parsed.suggestedReplies,
      sourceUserMessageId: params.sourceUserMessageId,
      modelId: params.mediaAgent.modelId,
      modelName: targetModel.name,
      modelType: targetModel.type === AiModelType.video ? 'video' : 'image',
      preferredAspectRatio: params.mediaAgent.preferredAspectRatio ?? null,
      preferredResolution: params.mediaAgent.preferredResolution ?? null,
      preferredDuration: params.mediaAgent.preferredDuration ?? null,
      referenceVideos: params.mediaAgent.referenceVideos,
      referenceAudios: params.mediaAgent.referenceAudios,
      referenceImageCount: params.mediaAgent.referenceImages.length,
      referenceVideoCount: params.mediaAgent.referenceVideos.length,
      referenceAudioCount: params.mediaAgent.referenceAudios.length,
      autoCreated,
    };

    providerData.mediaAgent = mediaAgentMetadata;
    if (taskRefs.length > 0) {
      providerData.taskRefs = taskRefs;
    }

    const autoCreatedConversationEditReply =
      targetModel.type === AiModelType.video
        ? preferChinese
          ? '已根据上一版结果直接提交视频编辑任务，我会沿用已有生成结果作为编辑上下文。'
          : 'I submitted the video edit task directly using the previous result as editing context.'
        : preferChinese
          ? '已根据上一版结果直接提交图片编辑任务，我会沿用已有生成结果作为编辑上下文。'
          : 'I submitted the image edit task directly using the previous result as editing context.';

    return {
      content: autoCreateFromConversationEdit && autoCreated
        ? autoCreatedConversationEditReply
        : parsed.reply,
      providerData,
    };
  }

  private async collectConversationGeneratedMediaAssets(params: {
    userId: bigint;
    conversationId: bigint;
    kind: 'image' | 'video';
    limit: number;
  }) {
    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId: params.conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        providerData: true,
      },
    });

    const orderedTaskIds: string[] = [];
    const fallbackMap = new Map<string, { resultUrl: string | null; thumbnailUrl: string | null }>();
    const numericTaskIds: bigint[] = [];
    const seen = new Set<string>();

    for (const message of messages) {
      const taskRefs = this.extractTaskRefsFromProviderData(message.providerData ?? null);
      for (const taskRef of taskRefs) {
        if (taskRef.kind !== params.kind || seen.has(taskRef.taskId)) continue;
        seen.add(taskRef.taskId);
        orderedTaskIds.push(taskRef.taskId);
        fallbackMap.set(taskRef.taskId, {
          resultUrl: taskRef.resultUrl ?? null,
          thumbnailUrl: taskRef.thumbnailUrl ?? null,
        });
        try {
          numericTaskIds.push(BigInt(taskRef.taskId));
        } catch {
          continue;
        }
        if (orderedTaskIds.length >= params.limit) break;
      }
      if (orderedTaskIds.length >= params.limit) break;
    }

    if (orderedTaskIds.length === 0) return [];

    if (params.kind === 'image') {
      const tasks = await this.prisma.imageTask.findMany({
        where: {
          id: { in: numericTaskIds },
          userId: params.userId,
          deletedAt: null,
        },
        select: {
          id: true,
          resultUrl: true,
          thumbnailUrl: true,
        },
      });

      const taskMap = new Map(
        tasks.map((task) => [
          task.id.toString(),
          {
            resultUrl: task.resultUrl,
            thumbnailUrl: task.thumbnailUrl,
            providerTaskId: null,
          },
        ]),
      );

      return orderedTaskIds
        .map((taskId) => {
          const stored = taskMap.get(taskId);
          const fallback = fallbackMap.get(taskId);
          return {
            kind: 'image' as const,
            taskId,
            resultUrl: stored?.resultUrl ?? fallback?.resultUrl ?? null,
            thumbnailUrl: stored?.thumbnailUrl ?? fallback?.thumbnailUrl ?? null,
            providerTaskId: null as string | null,
          };
        })
        .filter((item) => item.resultUrl || item.thumbnailUrl);
    }

    const tasks = await this.prisma.videoTask.findMany({
      where: {
        id: { in: numericTaskIds },
        userId: params.userId,
      },
      select: {
        id: true,
        resultUrl: true,
        thumbnailUrl: true,
        providerTaskId: true,
      },
    });

    const taskMap = new Map(
      tasks.map((task) => [
        task.id.toString(),
        {
          resultUrl: task.resultUrl,
          thumbnailUrl: task.thumbnailUrl,
          providerTaskId: task.providerTaskId,
        },
      ]),
    );

    return orderedTaskIds
      .map((taskId) => {
        const stored = taskMap.get(taskId);
        const fallback = fallbackMap.get(taskId);
        return {
          kind: 'video' as const,
          taskId,
          resultUrl: stored?.resultUrl ?? fallback?.resultUrl ?? null,
          thumbnailUrl: stored?.thumbnailUrl ?? fallback?.thumbnailUrl ?? null,
          providerTaskId: stored?.providerTaskId ?? null,
        };
      })
      .filter((item) => item.resultUrl || item.thumbnailUrl || item.providerTaskId);
  }

  private buildChatContextImageParameters(provider: string, images: string[]) {
    if (images.length === 0) return {};

    const providerKey = normalizeProviderKey(provider);
    if (providerKey.includes('qwen')) {
      return { images };
    }
    if (providerKey.includes('doubao')) {
      return { image: images.length === 1 ? images[0] : images };
    }
    if (
      providerKey.includes('nanobanana') ||
      providerKey.includes('gemini') ||
      providerKey.includes('google')
    ) {
      return {
        images,
        imageFirst: true,
      };
    }
    return {};
  }

  private buildChatContextVideoParameters(
    model: AiModel,
    input: {
      currentImages: string[];
      currentVideos: string[];
      currentAudios: string[];
      latestContextAsset?: {
        resultUrl: string | null;
        thumbnailUrl: string | null;
        providerTaskId: string | null;
      } | null;
    },
  ) {
    const providerKey = normalizeProviderKey(model.provider);
    const remoteModel = String((model as any).modelKey ?? '').trim().toLowerCase();
    const parameters: Record<string, unknown> = {};
    const fallbackImage = input.latestContextAsset?.thumbnailUrl ?? null;
    const fallbackVideo = input.latestContextAsset?.resultUrl ?? null;

    if (this.isWanxR2vVideoModel(model)) {
      return this.buildWanxR2vContextVideoParameters({
        currentImages: input.currentImages,
        currentVideos: input.currentVideos,
        currentAudios: input.currentAudios,
        firstFrameImage: fallbackImage,
      });
    }

    if (providerKey.includes('doubao') || providerKey.includes('bytedance') || providerKey.includes('ark')) {
      const isSeedance15Pro = remoteModel.includes('seedance-1-5-pro');
      if (isSeedance15Pro) {
        const mergedReferenceImages = [...input.currentImages];
        if (mergedReferenceImages.length === 0 && fallbackImage) {
          mergedReferenceImages.push(fallbackImage);
        }

        if (mergedReferenceImages.length > 0) {
          parameters.referenceImages = mergedReferenceImages;
        }
        return parameters;
      }

      const mergedReferenceVideos = [...input.currentVideos];
      if (mergedReferenceVideos.length === 0 && fallbackVideo) {
        mergedReferenceVideos.push(fallbackVideo);
      }

      const mergedReferenceImages = [...input.currentImages];
      if (mergedReferenceImages.length === 0 && mergedReferenceVideos.length === 0 && fallbackImage) {
        mergedReferenceImages.push(fallbackImage);
      }

      if (mergedReferenceImages.length > 0) {
        parameters.referenceImages = mergedReferenceImages;
      }
      if (mergedReferenceVideos.length > 0) {
        parameters.referenceVideos = mergedReferenceVideos;
      }
      if (input.currentAudios.length > 0) {
        parameters.referenceAudios = input.currentAudios;
      }
      return parameters;
    }

    if (providerKey.includes('minimax') || providerKey.includes('hailuo')) {
      const mergedImages =
        input.currentImages.length > 0
          ? input.currentImages
          : fallbackImage
            ? [fallbackImage]
            : [];

      if (mergedImages[0]) parameters.firstFrameImage = mergedImages[0];
      if (mergedImages[1]) parameters.lastFrameImage = mergedImages[1];
      return parameters;
    }

    if (providerKey.includes('keling')) {
      const referenceImage = input.currentImages[0] || fallbackImage;
      if (referenceImage) {
        parameters.referenceImage = referenceImage;
      }
      return parameters;
    }

    return parameters;
  }

  private async generateConversationImageTask(params: {
    userId: bigint;
    conversationId: bigint;
    imageModelIdRaw: string;
    projectId?: bigint | null;
    prompt: string;
    negativePrompt?: string;
    currentImages: string[];
    useConversationContextEdit?: boolean;
    preferredAspectRatio?: string | null;
    preferredResolution?: string | null;
    parameters?: Record<string, unknown>;
  }) {
    const imageModelId = this.parseBigInt(params.imageModelIdRaw, 'modelId');
    const imageModel = await this.prisma.aiModel.findFirst({
      where: {
        id: imageModelId,
        type: AiModelType.image,
        isActive: true,
      },
    });
    if (!imageModel) {
      throw new BadRequestException('Image model not found or inactive');
    }

    const imageModelCapabilities = buildModelCapabilities(imageModel as AiModel, null);
    const supportsContextImageEditing = this.supportsMediaAgentImageModel(
      imageModel,
      imageModelCapabilities,
    );

    if ((params.currentImages.length > 0 || params.useConversationContextEdit) && !supportsContextImageEditing) {
      throw new BadRequestException('Current image model does not support context editing in chat');
    }

    const mergedParameters = {
      ...buildChatImageTaskParameters(imageModel, {
        preferredAspectRatio: params.preferredAspectRatio ?? null,
        preferredResolution: params.preferredResolution ?? null,
        hasReferenceImages: params.currentImages.length > 0 || Boolean(params.useConversationContextEdit),
      }),
      ...(params.parameters ? { ...params.parameters } : {}),
    };
    const maxInputImages = Math.max(1, imageModelCapabilities.limits.maxInputImages ?? 1);
    const contextImages = [...params.currentImages]
      .map((item) => item.trim())
      .filter((item) => Boolean(item))
      .slice(0, maxInputImages);

    if (params.useConversationContextEdit) {
      const generatedAssets = await this.collectConversationGeneratedMediaAssets({
        userId: params.userId,
        conversationId: params.conversationId,
        kind: 'image',
        limit: maxInputImages,
      });

      for (const asset of generatedAssets) {
        const url = asset.resultUrl?.trim() || asset.thumbnailUrl?.trim() || '';
        if (!url || contextImages.includes(url)) continue;
        contextImages.push(url);
        if (contextImages.length >= maxInputImages) break;
      }
    }

    if (contextImages.length > 0) {
      Object.assign(
        mergedParameters,
        this.buildChatContextImageParameters(imageModel.provider, contextImages),
      );
    }

    const createdTask = await this.imagesService.generate(params.userId, {
      modelId: params.imageModelIdRaw,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      parameters: Object.keys(mergedParameters).length > 0 ? mergedParameters : undefined,
      projectId: params.projectId ? params.projectId.toString() : undefined,
    });

    return {
      createdTask,
      imageModel,
      imageModelCapabilities,
    };
  }

  private async generateConversationVideoTask(params: {
    userId: bigint;
    conversationId: bigint;
    videoModelIdRaw: string;
    projectId?: bigint | null;
    prompt: string;
    currentImages: string[];
    currentVideos: string[];
    currentAudios: string[];
    useConversationContextEdit?: boolean;
    preferredAspectRatio?: string | null;
    preferredResolution?: string | null;
    preferredDuration?: string | null;
    parameters?: Record<string, unknown>;
  }) {
    const videoModelId = this.parseBigInt(params.videoModelIdRaw, 'modelId');
    const videoModel = await this.prisma.aiModel.findFirst({
      where: {
        id: videoModelId,
        type: AiModelType.video,
        isActive: true,
      },
    });
    if (!videoModel) {
      throw new BadRequestException('Video model not found or inactive');
    }

    const videoModelCapabilities = buildModelCapabilities(videoModel as AiModel, null);
    const supportsContextVideoEditing = this.supportsMediaAgentVideoModel(
      videoModel,
      videoModelCapabilities,
    );

    if (
      (params.currentImages.length > 0 ||
        params.currentVideos.length > 0 ||
        params.currentAudios.length > 0 ||
        params.useConversationContextEdit) &&
      !supportsContextVideoEditing
    ) {
      throw new BadRequestException('Current video model does not support context editing in chat');
    }

    if (params.currentImages.length > 0 && !videoModelCapabilities.supports.imageInput) {
      throw new BadRequestException('Current video model does not support image references');
    }
    if (params.currentVideos.length > 0 && !videoModelCapabilities.supports.videoInput) {
      throw new BadRequestException('Current video model does not support video references');
    }
    if (params.currentAudios.length > 0 && !videoModelCapabilities.supports.audioInput) {
      throw new BadRequestException('Current video model does not support audio references');
    }

    const wanxTextOnlyModelOverride =
      !params.useConversationContextEdit && !this.hasAnyNonEmptyMediaInput(params)
        ? this.resolveWanxT2vVideoModelOverride(videoModel)
        : null;

    const mergedParameters = {
      ...buildChatVideoTaskParameters(videoModel, {
        preferredAspectRatio: params.preferredAspectRatio ?? null,
        preferredResolution: params.preferredResolution ?? null,
        preferredDuration: params.preferredDuration ?? null,
      }),
      ...(params.parameters ? { ...params.parameters } : {}),
      ...(wanxTextOnlyModelOverride ? { model: wanxTextOnlyModelOverride } : {}),
    };
    const maxInputImages = Math.max(1, videoModelCapabilities.limits.maxInputImages ?? 1);
    const maxInputVideos = Math.max(1, videoModelCapabilities.limits.maxInputVideos ?? 1);
    const maxInputAudios = Math.max(1, videoModelCapabilities.limits.maxInputAudios ?? 1);

    const currentImages = params.currentImages
      .map((item) => item.trim())
      .filter((item) => Boolean(item))
      .slice(0, maxInputImages);
    const currentVideos = params.currentVideos
      .map((item) => item.trim())
      .filter((item) => Boolean(item))
      .slice(0, maxInputVideos);
    const currentAudios = params.currentAudios
      .map((item) => item.trim())
      .filter((item) => Boolean(item))
      .slice(0, maxInputAudios);

    const latestContextAsset = params.useConversationContextEdit
      ? (
          await this.collectConversationGeneratedMediaAssets({
            userId: params.userId,
            conversationId: params.conversationId,
            kind: 'video',
            limit: 1,
          })
        )[0] ?? null
      : null;

    Object.assign(
      mergedParameters,
      this.buildChatContextVideoParameters(videoModel, {
        currentImages,
        currentVideos,
        currentAudios,
        latestContextAsset,
      }),
    );

    const createdTask = await this.videosService.generate(params.userId, {
      modelId: params.videoModelIdRaw,
      prompt: params.prompt,
      parameters: Object.keys(mergedParameters).length > 0 ? mergedParameters : undefined,
      projectId: params.projectId ? params.projectId.toString() : undefined,
    });

    return {
      createdTask,
      videoModel,
      videoModelCapabilities,
    };
  }

  private normalizeStringList(value: unknown, max = 4): string[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => Boolean(item))
      .slice(0, max);
  }

  private normalizeImages(images?: string[], max = 4): string[] {
    if (!Array.isArray(images)) return [];

    return images
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => Boolean(value))
      .slice(0, max);
  }

  private extractImages(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => Boolean(item));
  }

  private mapChatFile(file: ChatFile): ChatFileAttachment {
    return {
      id: file.id.toString(),
      fileName: normalizeUploadedFileName(file.fileName),
      extension: file.extension,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
    };
  }

  private extractMessageFiles(value: Prisma.JsonValue | null): ChatFileAttachment[] {
    if (!Array.isArray(value)) return [];

    const out: ChatFileAttachment[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const obj = item as Record<string, unknown>;

      const id = typeof obj.id === 'string' ? obj.id : '';
      const fileName = typeof obj.fileName === 'string' ? normalizeUploadedFileName(obj.fileName) : '';
      const extension = typeof obj.extension === 'string' ? obj.extension : '';
      const mimeType = typeof obj.mimeType === 'string' ? obj.mimeType : '';
      const fileSizeRaw = obj.fileSize;
      const fileSize = typeof fileSizeRaw === 'number' && Number.isFinite(fileSizeRaw) ? Math.max(0, Math.trunc(fileSizeRaw)) : 0;

      if (!id || !fileName) continue;
      out.push({
        id,
        fileName,
        extension,
        mimeType,
        fileSize,
      });
    }

    return out;
  }

  private mapMessage(message: {
    id: bigint;
    conversationId: bigint;
    role: ChatMessageRole;
    content: string;
    images: Prisma.JsonValue | null;
    files: Prisma.JsonValue | null;
    providerData?: Prisma.JsonValue | null;
    createdAt: Date;
  }) {
    const reasoning = this.extractReasoningFromProviderData(message.providerData ?? null);
    const citations = this.extractCitationsFromProviderData(message.providerData ?? null);
    const taskRefs = this.extractTaskRefsFromProviderData(message.providerData ?? null);
    const mediaAgent = this.extractMediaAgentFromProviderData(message.providerData ?? null);
    const autoProjectAgent = extractAutoProjectAgentFromProviderData(message.providerData ?? null);
    return {
      id: message.id.toString(),
      conversationId: message.conversationId.toString(),
      role: message.role,
      content: message.content,
      reasoning,
      images: this.extractImages(message.images),
      files: this.extractMessageFiles(message.files),
      citations,
      taskRefs,
      mediaAgent,
      autoProjectAgent,
      createdAt: message.createdAt,
    };
  }

  private async hydrateTaskRefsForMessages<T extends { taskRefs: ChatTaskRef[] }>(
    userId: bigint,
    messages: T[],
  ): Promise<T[]> {
    const imageTaskIds: bigint[] = [];
    const videoTaskIds: bigint[] = [];
    const imageTaskNos: string[] = [];
    const videoTaskNos: string[] = [];
    const seenImageTaskIds = new Set<string>();
    const seenVideoTaskIds = new Set<string>();
    const seenImageTaskNos = new Set<string>();
    const seenVideoTaskNos = new Set<string>();

    for (const message of messages) {
      for (const taskRef of message.taskRefs) {
        const normalizedTaskNo = typeof taskRef.taskNo === 'string' ? taskRef.taskNo.trim() : '';
        if (normalizedTaskNo) {
          if (taskRef.kind === 'image') {
            if (!seenImageTaskNos.has(normalizedTaskNo)) {
              seenImageTaskNos.add(normalizedTaskNo);
              imageTaskNos.push(normalizedTaskNo);
            }
          } else if (!seenVideoTaskNos.has(normalizedTaskNo)) {
            seenVideoTaskNos.add(normalizedTaskNo);
            videoTaskNos.push(normalizedTaskNo);
          }
        }

        try {
          const taskId = BigInt(taskRef.taskId);
          if (taskRef.kind === 'image') {
            const key = taskId.toString();
            if (seenImageTaskIds.has(key)) continue;
            seenImageTaskIds.add(key);
            imageTaskIds.push(taskId);
            continue;
          }

          const key = taskId.toString();
          if (seenVideoTaskIds.has(key)) continue;
          seenVideoTaskIds.add(key);
          videoTaskIds.push(taskId);
        } catch {
          const fallbackTaskNo = taskRef.taskId.trim();
          if (!fallbackTaskNo) continue;

          if (taskRef.kind === 'image') {
            if (seenImageTaskNos.has(fallbackTaskNo)) continue;
            seenImageTaskNos.add(fallbackTaskNo);
            imageTaskNos.push(fallbackTaskNo);
            continue;
          }

          if (seenVideoTaskNos.has(fallbackTaskNo)) continue;
          seenVideoTaskNos.add(fallbackTaskNo);
          videoTaskNos.push(fallbackTaskNo);
        }
      }
    }

    if (imageTaskIds.length === 0 && videoTaskIds.length === 0 && imageTaskNos.length === 0 && videoTaskNos.length === 0) {
      return messages;
    }

    const [imageTasks, videoTasks] = await Promise.all([
      imageTaskIds.length > 0 || imageTaskNos.length > 0
        ? this.prisma.imageTask.findMany({
            where: {
              userId,
              OR: [
                ...(imageTaskIds.length > 0 ? [{ id: { in: imageTaskIds } }] : []),
                ...(imageTaskNos.length > 0 ? [{ taskNo: { in: imageTaskNos } }] : []),
              ],
            },
            select: {
              id: true,
              taskNo: true,
              status: true,
              modelId: true,
              provider: true,
              prompt: true,
              thumbnailUrl: true,
              resultUrl: true,
              errorMessage: true,
              creditsCost: true,
              createdAt: true,
              completedAt: true,
            },
          })
        : Promise.resolve([]),
      videoTaskIds.length > 0 || videoTaskNos.length > 0
        ? this.prisma.videoTask.findMany({
            where: {
              userId,
              OR: [
                ...(videoTaskIds.length > 0 ? [{ id: { in: videoTaskIds } }] : []),
                ...(videoTaskNos.length > 0 ? [{ taskNo: { in: videoTaskNos } }] : []),
              ],
            },
            select: {
              id: true,
              taskNo: true,
              status: true,
              modelId: true,
              provider: true,
              model: {
                select: {
                  modelKey: true,
                },
              },
              prompt: true,
              thumbnailUrl: true,
              resultUrl: true,
              errorMessage: true,
              creditsCost: true,
              createdAt: true,
              completedAt: true,
              autoProjectShotId: true,
              autoProjectFinalStoryboard: true,
              providerData: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const imageTaskMap = new Map<string, ChatTaskRef>();
    for (const task of imageTasks) {
      const taskRef = this.toChatImageTaskRef({
        id: task.id.toString(),
        taskNo: task.taskNo,
        status:
          task.status === TaskStatus.pending
            ? 'pending'
            : task.status === TaskStatus.processing
              ? 'processing'
              : task.status === TaskStatus.completed
                ? 'completed'
                : 'failed',
        modelId: task.modelId.toString(),
        provider: task.provider,
        prompt: task.prompt,
        thumbnailUrl: task.thumbnailUrl,
        resultUrl: task.resultUrl,
        errorMessage: task.errorMessage,
        creditsCost:
          task.creditsCost === null || task.creditsCost === undefined ? null : Number(task.creditsCost),
        createdAt: task.createdAt,
        completedAt: task.completedAt,
      });

      imageTaskMap.set(task.id.toString(), taskRef);
      imageTaskMap.set(task.taskNo, taskRef);
    }

    const videoTaskMap = new Map<string, ChatTaskRef>();
    for (const task of videoTasks) {
      const autoProjectMetadata = extractAutoProjectAssetMetadata(task.providerData ?? null);
      const shotId =
        typeof task.autoProjectShotId === 'string' && task.autoProjectShotId.trim()
          ? task.autoProjectShotId.trim()
          : autoProjectMetadata?.shotId ?? null;
      const finalStoryboard =
        task.autoProjectFinalStoryboard === true ||
        autoProjectMetadata?.finalStoryboard === true;
      const taskRef = this.toChatVideoTaskRef({
        id: task.id.toString(),
        taskNo: task.taskNo,
        status:
          task.status === TaskStatus.pending
            ? 'pending'
            : task.status === TaskStatus.processing
              ? 'processing'
              : task.status === TaskStatus.completed
                ? 'completed'
                : 'failed',
        modelId: task.modelId.toString(),
        provider: task.provider,
        prompt: task.prompt,
        thumbnailUrl: task.thumbnailUrl,
        resultUrl: task.resultUrl,
        errorMessage: task.errorMessage,
        creditsCost:
          task.creditsCost === null || task.creditsCost === undefined ? null : Number(task.creditsCost),
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        canCancel: canCancelVideoTask(task.status, task.provider, task.model?.modelKey ?? null),
        cancelSupported: supportsVideoTaskCancel(task.provider, task.model?.modelKey ?? null),
      }, {
        shotId,
        finalStoryboard,
      });

      videoTaskMap.set(task.id.toString(), taskRef);
      videoTaskMap.set(task.taskNo, taskRef);
    }

    return messages.map((message) => ({
      ...message,
      taskRefs: message.taskRefs.map((taskRef) => {
        const liveTaskRef = taskRef.kind === 'image'
          ? imageTaskMap.get(taskRef.taskId) ?? (taskRef.taskNo ? imageTaskMap.get(taskRef.taskNo) : undefined)
          : videoTaskMap.get(taskRef.taskId) ?? (taskRef.taskNo ? videoTaskMap.get(taskRef.taskNo) : undefined);

        return liveTaskRef ? { ...taskRef, ...liveTaskRef } : taskRef;
      }),
    }));
  }

  private extractReasoningFromProviderData(providerData: Prisma.JsonValue | null): string | null {
    if (!providerData || typeof providerData !== 'object' || Array.isArray(providerData)) {
      return null;
    }

    const source = providerData as Record<string, unknown>;
    const candidates = [
      source.reasoning,
      source.reasoning_content,
      source.thinking,
      source.thought,
    ];

    for (const value of candidates) {
      const normalized = this.normalizeUpstreamContent(value).trim();
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private extractCitationsFromProviderData(providerData: Prisma.JsonValue | null): ChatCitation[] {
    if (!providerData || typeof providerData !== 'object' || Array.isArray(providerData)) {
      return [];
    }

    const source = providerData as Record<string, unknown>;
    if (!Array.isArray(source.citations)) {
      return [];
    }

    const out: ChatCitation[] = [];
    for (const item of source.citations) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const obj = item as Record<string, unknown>;
      const snippet = typeof obj.snippet === 'string' ? obj.snippet.trim() : '';
      if (!snippet) continue;

      const typeRaw = typeof obj.type === 'string' ? obj.type.trim().toLowerCase() : '';
      const type: ChatCitation['type'] = typeRaw === 'web' ? 'web' : 'file';
      const citation: ChatCitation = {
        type,
        snippet,
      };

      if (type === 'web') {
        if (typeof obj.title === 'string' && obj.title.trim()) {
          citation.title = obj.title.trim();
        }
        if (typeof obj.url === 'string' && obj.url.trim()) {
          citation.url = obj.url.trim();
        }
        if (typeof obj.domain === 'string' && obj.domain.trim()) {
          citation.domain = obj.domain.trim();
        }
        if (typeof obj.publishedAt === 'string' && obj.publishedAt.trim()) {
          citation.publishedAt = obj.publishedAt.trim();
        } else {
          citation.publishedAt = null;
        }
      } else {
        if (typeof obj.fileId === 'string' && obj.fileId.trim()) {
          citation.fileId = obj.fileId.trim();
        }
        if (typeof obj.fileName === 'string' && obj.fileName.trim()) {
          citation.fileName = normalizeUploadedFileName(obj.fileName);
        }
        if (typeof obj.extension === 'string' && obj.extension.trim()) {
          citation.extension = obj.extension.trim();
        }
        if (!citation.fileId || !citation.fileName) {
          continue;
        }
      }

      if (typeof obj.score === 'number' && Number.isFinite(obj.score)) {
        citation.score = obj.score;
      }
      if (typeof obj.chunkIndex === 'number' && Number.isFinite(obj.chunkIndex)) {
        citation.chunkIndex = Math.max(1, Math.trunc(obj.chunkIndex));
      }
      out.push(citation);
    }

    return out;
  }

  private extractTaskRefsFromProviderData(providerData: Prisma.JsonValue | null): ChatTaskRef[] {
    if (!providerData || typeof providerData !== 'object' || Array.isArray(providerData)) {
      return [];
    }

    const source = providerData as Record<string, unknown>;
    if (!Array.isArray(source.taskRefs)) {
      return [];
    }

    const out: ChatTaskRef[] = [];
    for (const item of source.taskRefs) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

      const obj = item as Record<string, unknown>;
      const kind = typeof obj.kind === 'string' ? obj.kind.trim().toLowerCase() : '';
      const taskId = typeof obj.taskId === 'string' ? obj.taskId.trim() : '';
      if ((kind !== 'image' && kind !== 'video') || !taskId) continue;

      const taskRef: ChatTaskRef = {
        kind: kind as ChatTaskRef['kind'],
        taskId,
      };

      if (typeof obj.taskNo === 'string' && obj.taskNo.trim()) {
        taskRef.taskNo = obj.taskNo.trim();
      }
      if (
        typeof obj.status === 'string' &&
        ['pending', 'processing', 'completed', 'failed'].includes(obj.status.trim())
      ) {
        taskRef.status = obj.status.trim() as ChatTaskRef['status'];
      }
      if (typeof obj.shotId === 'string' && obj.shotId.trim()) {
        taskRef.shotId = obj.shotId.trim();
      }
      if (obj.finalStoryboard === true) {
        taskRef.finalStoryboard = true;
      }
      if (typeof obj.modelId === 'string' && obj.modelId.trim()) {
        taskRef.modelId = obj.modelId.trim();
      }
      if (typeof obj.provider === 'string' && obj.provider.trim()) {
        taskRef.provider = obj.provider.trim();
      }
      if (typeof obj.prompt === 'string' && obj.prompt.trim()) {
        taskRef.prompt = obj.prompt.trim();
      }
      if (typeof obj.thumbnailUrl === 'string' && obj.thumbnailUrl.trim()) {
        taskRef.thumbnailUrl = obj.thumbnailUrl.trim();
      } else {
        taskRef.thumbnailUrl = null;
      }
      if (typeof obj.resultUrl === 'string' && obj.resultUrl.trim()) {
        taskRef.resultUrl = obj.resultUrl.trim();
      } else {
        taskRef.resultUrl = null;
      }
      if (typeof obj.canCancel === 'boolean') {
        taskRef.canCancel = obj.canCancel;
      }
      if (typeof obj.cancelSupported === 'boolean') {
        taskRef.cancelSupported = obj.cancelSupported;
      }
      if (typeof obj.errorMessage === 'string' && obj.errorMessage.trim()) {
        taskRef.errorMessage = obj.errorMessage.trim();
      } else {
        taskRef.errorMessage = null;
      }
      if (typeof obj.creditsCost === 'number' && Number.isFinite(obj.creditsCost)) {
        taskRef.creditsCost = obj.creditsCost;
      } else {
        taskRef.creditsCost = null;
      }
      if (typeof obj.createdAt === 'string' && obj.createdAt.trim()) {
        taskRef.createdAt = obj.createdAt.trim();
      }
      if (typeof obj.completedAt === 'string' && obj.completedAt.trim()) {
        taskRef.completedAt = obj.completedAt.trim();
      } else {
        taskRef.completedAt = null;
      }

      out.push(taskRef);
    }

    return out;
  }

  private extractMediaAgentFromProviderData(providerData: Prisma.JsonValue | null): MediaAgentMetadata | null {
    if (!providerData || typeof providerData !== 'object' || Array.isArray(providerData)) {
      return null;
    }

    const source = providerData as Record<string, unknown>;
    const rawValue = source.mediaAgent ?? source.imageAgent;
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      return null;
    }

    const raw = rawValue as Record<string, unknown>;
    const statusRaw = typeof raw.status === 'string' ? raw.status.trim().toLowerCase() : '';
    const status: MediaAgentStatus | null =
      statusRaw === 'ready'
        ? 'ready'
        : statusRaw === 'clarify'
          ? 'clarify'
          : null;
    const intentRaw = typeof raw.intent === 'string' ? raw.intent.trim().toLowerCase() : '';
    const modelId =
      typeof raw.modelId === 'string' && raw.modelId.trim()
        ? raw.modelId.trim()
        : typeof raw.imageModelId === 'string' && raw.imageModelId.trim()
          ? raw.imageModelId.trim()
          : '';
    const modelName =
      typeof raw.modelName === 'string' && raw.modelName.trim()
        ? raw.modelName.trim()
        : typeof raw.imageModelName === 'string' && raw.imageModelName.trim()
          ? raw.imageModelName.trim()
          : '';
    const modelTypeRaw = typeof raw.modelType === 'string' ? raw.modelType.trim().toLowerCase() : '';
    const modelType: MediaAgentMetadata['modelType'] =
      modelTypeRaw === 'video'
        ? 'video'
        : 'image';

    if (!status || !modelId || !modelName) {
      return null;
    }

    return {
      status,
      intent: intentRaw === 'edit' ? 'edit' : 'generate',
      optimizedPrompt:
        typeof raw.optimizedPrompt === 'string' && raw.optimizedPrompt.trim()
          ? raw.optimizedPrompt.trim()
          : null,
      negativePrompt:
        typeof raw.negativePrompt === 'string' && raw.negativePrompt.trim()
          ? raw.negativePrompt.trim()
          : null,
      suggestedReplies: Array.isArray(raw.suggestedReplies)
        ? raw.suggestedReplies
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item.length > 0)
            .slice(0, 4)
        : [],
      sourceUserMessageId:
        typeof raw.sourceUserMessageId === 'string' && raw.sourceUserMessageId.trim()
          ? raw.sourceUserMessageId.trim()
          : '',
      modelId,
      modelName,
      modelType,
      preferredAspectRatio:
        typeof raw.preferredAspectRatio === 'string' && raw.preferredAspectRatio.trim()
          ? raw.preferredAspectRatio.trim()
          : null,
      preferredResolution:
        typeof raw.preferredResolution === 'string' && raw.preferredResolution.trim()
          ? raw.preferredResolution.trim()
          : null,
      preferredDuration:
        typeof raw.preferredDuration === 'string' && raw.preferredDuration.trim()
          ? raw.preferredDuration.trim()
          : null,
      referenceVideos: Array.isArray(raw.referenceVideos)
        ? raw.referenceVideos
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item.length > 0)
            .slice(0, 10)
        : [],
      referenceAudios: Array.isArray(raw.referenceAudios)
        ? raw.referenceAudios
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item.length > 0)
            .slice(0, 10)
        : [],
      referenceImageCount:
        typeof raw.referenceImageCount === 'number' && Number.isFinite(raw.referenceImageCount)
          ? Math.max(0, Math.trunc(raw.referenceImageCount))
          : 0,
      referenceVideoCount:
        typeof raw.referenceVideoCount === 'number' && Number.isFinite(raw.referenceVideoCount)
          ? Math.max(0, Math.trunc(raw.referenceVideoCount))
          : 0,
      referenceAudioCount:
        typeof raw.referenceAudioCount === 'number' && Number.isFinite(raw.referenceAudioCount)
          ? Math.max(0, Math.trunc(raw.referenceAudioCount))
          : 0,
      autoCreated: raw.autoCreated === true,
    };
  }

  private mapConversationSummary(conversation: {
    id: bigint;
    title: string;
    isPinned: boolean;
    lastMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
    projectContext?: {
      id: bigint;
      name: string;
    } | null;
    model: {
      id: bigint;
      name: string;
      icon: string | null;
      type: AiModelType;
      supportsImageInput: boolean | null;
      isActive: boolean;
    };
    messages?: Array<{
      content: string;
      images: Prisma.JsonValue | null;
      files?: Prisma.JsonValue | null;
      createdAt: Date;
    }>;
  }) {
    const latest = conversation.messages?.[0];

    return {
      id: conversation.id.toString(),
      title: conversation.title,
      isPinned: Boolean(conversation.isPinned),
      model: {
        id: conversation.model.id.toString(),
        name: conversation.model.name,
        icon: conversation.model.icon,
        type: conversation.model.type,
        supportsImageInput: Boolean(conversation.model.supportsImageInput),
        isActive: conversation.model.isActive,
      },
      projectContext: conversation.projectContext
        ? {
            id: conversation.projectContext.id.toString(),
            name: conversation.projectContext.name,
          }
        : null,
      lastMessagePreview: this.buildPreviewText(latest?.content ?? '', latest?.images ?? null, latest?.files ?? null),
      lastMessageAt: latest?.createdAt ?? conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private buildPreviewText(content: string, images: Prisma.JsonValue | null, files: Prisma.JsonValue | null) {
    const text = content.trim();
    if (text) return text.length > 80 ? `${text.slice(0, 80)}...` : text;

    const imageCount = this.extractImages(images).length;
    if (imageCount > 0) return imageCount > 1 ? `[${imageCount} images]` : '[image]';

    const fileCount = this.extractMessageFiles(files).length;
    if (fileCount > 0) return fileCount > 1 ? `[${fileCount} files]` : '[file]';

    return '';
  }

  private normalizeTitle(value: string | undefined) {
    if (!value) return null;
    const text = value.trim();
    if (!text) return null;
    return text.length > 200 ? text.slice(0, 200) : text;
  }

  private buildAutoTitle(currentTitle: string, content: string) {
    if (currentTitle !== ChatService.DEFAULT_TITLE) return null;

    const trimmed = content.trim();
    if (!trimmed) return null;

    const compact = trimmed.replace(/\s+/g, ' ');
    return compact.length > 48 ? `${compact.slice(0, 48)}...` : compact;
  }

  private normalizeSearchKeyword(value: string | undefined) {
    if (!value) return undefined;
    const text = value.trim();
    if (!text) return undefined;
    return text.slice(0, 100);
  }

  private normalizeWebSearchQuery(value: string | undefined) {
    if (!value) return undefined;
    const text = value.trim();
    if (!text) return undefined;
    const compact = text.replace(/\s+/g, ' ');
    return compact.slice(0, 320);
  }

  private normalizeExceptionMessage(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string' && response.trim()) return response;
      if (response && typeof response === 'object' && typeof (response as Record<string, unknown>).message === 'string') {
        return (response as Record<string, string>).message;
      }
      if (error.message) return error.message;
      return 'Chat request failed';
    }
    if (error instanceof Error && error.message?.trim()) return error.message;
    return 'Chat request failed';
  }

  private parseBigInt(raw: string, fieldName: string) {
    try {
      return BigInt(raw);
    } catch {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
  }

  private async requireConversation(userId: bigint, conversationId: bigint) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        userId,
        model: { is: { type: AiModelType.chat } },
      },
      include: {
        model: {
          select: {
            id: true,
            name: true,
            icon: true,
            type: true,
            supportsImageInput: true,
            isActive: true,
          },
        },
        projectContext: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  private async requireConversationWithChannel(userId: bigint, conversationId: bigint) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        userId,
        model: { is: { type: AiModelType.chat } },
      },
      include: {
        model: {
          include: {
            channel: true,
          },
        },
        projectContext: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }
}
