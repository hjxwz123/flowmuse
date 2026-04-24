import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import axios from 'axios';

import { AuthUserCacheService } from '../auth/auth-user-cache.service';
import { buildBanErrorPayload, calculateBanExpireAt } from '../auth/ban.utils';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsService } from '../settings/ai-settings.service';
import { ModerationCounterService } from './moderation-counter.service';

export type PromptModerationScene =
  | 'image_generate_prompt'
  | 'image_generate_negative_prompt'
  | 'midjourney_modal_prompt'
  | 'midjourney_edits_prompt'
  | 'prompt_optimize_prompt';

export type PromptModerationLogSource = 'image_generate' | 'prompt_optimize';

export type PromptModerationLogContext = {
  userId: bigint;
  modelId?: bigint | null;
  taskId?: bigint | null;
  taskNo?: string | null;
  source?: PromptModerationLogSource;
};

type PromptModerationCheckResult = {
  passed: boolean;
  reason: string | null;
  providerModel: string | null;
  providerResponse: string | null;
};

type PromptModerationAutoBanResult = {
  matchedRule: { triggerCount: number; banDays: number };
  totalBlockedCount: number;
  banReason: string;
  banExpireAt: Date;
};

@Injectable()
export class PromptModerationService {
  private readonly logger = new Logger(PromptModerationService.name);

  constructor(
    private readonly aiSettings: AiSettingsService,
    private readonly prisma: PrismaService,
    private readonly moderationCounters: ModerationCounterService,
    private readonly authUserCache: AuthUserCacheService,
  ) {}

  async assertInputsAllowed(
    inputs: Array<{ scene: PromptModerationScene; content?: string | null }>,
    fallbackMessage = '当前输入未通过内容审核，请修改后重试',
    context?: PromptModerationLogContext,
  ) {
    const normalizedInputs = inputs
      .map((item) => ({
        scene: item.scene,
        content: (item.content ?? '').trim(),
      }))
      .filter((item) => item.content.length > 0);

    if (normalizedInputs.length === 0) return;

    const settings = await this.aiSettings.getAiSettings();
    if (!settings.chatModerationEnabled) return;

    const apiBaseUrl = settings.chatModerationApiBaseUrl.trim();
    const apiKey = settings.chatModerationApiKey.trim();
    const modelName = settings.chatModerationModelName.trim();
    const systemPrompt = (settings.chatModerationSystemPrompt || '').trim();

    if (!apiBaseUrl || !apiKey || !modelName) {
      throw new BadRequestException('内容审核已开启，但审核模型配置不完整');
    }

    for (const input of normalizedInputs) {
      const result = await this.requestModerationDecision({
        apiBaseUrl,
        apiKey,
        modelName,
        systemPrompt,
        content: this.wrapSceneContent(input.scene, input.content),
      });

      if (result.passed) {
        continue;
      }

      const blockedInputRecorded = await this.recordBlockedInput({
        scene: input.scene,
        content: input.content,
        reason: result.reason,
        providerModel: result.providerModel,
        providerResponse: result.providerResponse,
        context,
      });

      const autoBanResult = await this.applyAutoBanIfNeeded({
        userId: context?.userId ?? null,
        blockedInputRecorded,
        reason: result.reason,
        settings,
      });

      if (autoBanResult) {
        throw new ForbiddenException({
          ...buildBanErrorPayload(autoBanResult.banReason, autoBanResult.banExpireAt),
          message: `当前输入未通过内容审核，账号已自动封禁 ${autoBanResult.matchedRule.banDays} 天`,
        });
      }

      throw new BadRequestException(result.reason || fallbackMessage);
    }
  }

  private async recordBlockedInput(input: {
    scene: PromptModerationScene;
    content: string;
    reason: string | null;
    providerModel: string | null;
    providerResponse: string | null;
    context?: PromptModerationLogContext;
  }) {
    const context = input.context;
    if (!context?.userId) return false;

    try {
      await this.prisma.$executeRaw`
        INSERT INTO input_moderation_logs (
          user_id,
          model_id,
          source,
          scene,
          content,
          reason,
          provider_model,
          provider_response,
          task_id,
          task_no
        ) VALUES (
          ${context.userId},
          ${context.modelId ?? null},
          ${context.source ?? this.resolveSourceFromScene(input.scene)},
          ${input.scene},
          ${input.content},
          ${input.reason},
          ${input.providerModel},
          ${input.providerResponse},
          ${context.taskId ?? null},
          ${context.taskNo?.trim() || null}
        )
      `;
      return true;
    } catch (error) {
      if (this.isMissingInputModerationTable(error)) {
        this.logger.warn('input_moderation_logs table is missing, skipped prompt moderation log persistence');
        return false;
      }

      this.logger.warn(
        `Failed to persist input moderation log: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private resolveSourceFromScene(scene: PromptModerationScene): PromptModerationLogSource {
    if (scene === 'prompt_optimize_prompt') return 'prompt_optimize';
    return 'image_generate';
  }

  private async applyAutoBanIfNeeded(input: {
    userId: bigint | null | undefined;
    blockedInputRecorded: boolean;
    reason: string | null;
    settings: Awaited<ReturnType<AiSettingsService['getAiSettings']>>;
  }): Promise<PromptModerationAutoBanResult | null> {
    if (!input.userId) return null;
    if (!input.blockedInputRecorded) return null;
    if (!input.settings.chatModerationAutoBanEnabled || input.settings.chatModerationAutoBanRules.length === 0) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { role: true, status: true },
    });

    if (!user || user.role === UserRole.admin || user.status !== UserStatus.active) {
      return null;
    }

    const [chatCount, inputCount] = await Promise.all([
      this.moderationCounters.getChatBlockedCount(input.userId),
      this.moderationCounters.incrementInputBlockedCount(input.userId),
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
      ? `内容审核累计拦截达到 ${matchedRule.triggerCount} 次，系统自动封禁 ${matchedRule.banDays} 天。最近一次拦截原因：${latestReason}`
      : `内容审核累计拦截达到 ${matchedRule.triggerCount} 次，系统自动封禁 ${matchedRule.banDays} 天。`;

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

  private wrapSceneContent(scene: PromptModerationScene, content: string) {
    const sceneLabelMap: Record<PromptModerationScene, string> = {
      image_generate_prompt: '图片生成提示词',
      image_generate_negative_prompt: '图片生成反向提示词',
      midjourney_modal_prompt: 'Midjourney 补充提示词',
      midjourney_edits_prompt: 'Midjourney 编辑提示词',
      prompt_optimize_prompt: 'AI 优化提示词输入',
    };

    return `场景：${sceneLabelMap[scene]}\n内容：\n${content}`;
  }

  private async requestModerationDecision(params: {
    apiBaseUrl: string;
    apiKey: string;
    modelName: string;
    systemPrompt: string;
    content: string;
  }): Promise<PromptModerationCheckResult> {
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
        throw new BadRequestException(`内容审核服务调用失败（HTTP ${response.status}）`);
      }

      const payload = response.data;
      const upstreamError = this.extractErrorMessage(payload);
      if (upstreamError) {
        throw new BadRequestException(`内容审核服务返回错误：${upstreamError}`);
      }

      const providerResponse = this.extractAssistantContent(payload).trim();
      const decision = this.parseBooleanModerationDecision(providerResponse);

      if (decision === null) {
        throw new BadRequestException('内容审核模型返回格式无效，必须只返回 true 或 false');
      }

      return {
        passed: decision,
        reason: decision ? null : '当前提示词未通过内容审核，请修改后重试',
        providerModel: this.extractProviderModel(payload) || params.modelName,
        providerResponse: providerResponse || null,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('内容审核服务暂不可用，请稍后重试');
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

  private extractAssistantContent(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';

    const payloadRecord = payload as Record<string, unknown>;
    const choices = Array.isArray(payloadRecord.choices) ? payloadRecord.choices : [];
    const firstChoice = choices[0] && typeof choices[0] === 'object' ? (choices[0] as Record<string, unknown>) : null;

    const candidates = [
      firstChoice?.message,
      firstChoice?.delta,
      firstChoice?.text,
      payloadRecord.output_text,
      payloadRecord.content,
      payloadRecord.text,
    ];

    for (const value of candidates) {
      const normalized = this.normalizeUpstreamContent(value);
      if (normalized) return normalized;
    }

    return '';
  }

  private extractProviderModel(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;

    const model = (payload as Record<string, unknown>).model;
    return typeof model === 'string' && model.trim() ? model.trim() : null;
  }

  private normalizeUpstreamContent(value: unknown): string {
    if (typeof value === 'string') return value;

    if (Array.isArray(value)) {
      return value
        .map((part) => {
          if (typeof part === 'string') return part;
          if (!part || typeof part !== 'object') return '';

          const partRecord = part as Record<string, unknown>;
          if (typeof partRecord.text === 'string') return partRecord.text;
          if (typeof partRecord.content === 'string') return partRecord.content;
          return '';
        })
        .join('');
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (typeof record.text === 'string') return record.text;
      if (typeof record.content === 'string') return record.content;
      if (Array.isArray(record.content)) return this.normalizeUpstreamContent(record.content);
    }

    return '';
  }

  private extractErrorMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;

    const errorValue = (payload as Record<string, unknown>).error;
    if (!errorValue) return null;
    if (typeof errorValue === 'string') return errorValue;

    if (errorValue && typeof errorValue === 'object') {
      const message = (errorValue as Record<string, unknown>).message;
      if (typeof message === 'string') return message;
    }

    return 'Upstream provider returned an error';
  }

  private buildChatCompletionUrl(baseUrl: string) {
    const trimmed = baseUrl.replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
    return `${trimmed}/chat/completions`;
  }

  private tryParseJson(raw: string) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private isMissingInputModerationTable(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const message = JSON.stringify(error.meta ?? {});
      return error.code === 'P2010' && message.includes('input_moderation_logs');
    }

    return error instanceof Error && error.message.includes('input_moderation_logs');
  }
}
