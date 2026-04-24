import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { AiSettingsService } from '../settings/ai-settings.service';
import {
  MIDJOURNEY_SYSTEM_PROMPT,
  PROJECT_DESCRIPTION_BUNDLE_SYSTEM_PROMPT,
  PROJECT_DESCRIPTION_SYSTEM_PROMPT,
  PROJECT_IMAGE_PROMPT_SYSTEM_PROMPT,
  PROJECT_STORYBOARD_SYSTEM_PROMPT,
  VIDEO_DIRECTOR_ASSISTANT_SYSTEM_PROMPT,
} from '../settings/system-settings.constants';
import { PromptModerationService } from '../moderation/prompt-moderation.service';

type PromptOptimizeTask =
  | 'default'
  | 'video_director'
  | 'project_description'
  | 'project_description_bundle'
  | 'project_storyboard'
  | 'project_image_prompt';

type PromptRequestInput = {
  userId: bigint;
  prompt: string;
  images?: string[];
  modelType?: string;
  projectDescription?: string;
  task?: PromptOptimizeTask;
  chargeCredits: boolean;
  moderateInput: boolean;
};

@Injectable()
export class PromptOptimizeService {
  private readonly logger = new Logger(PromptOptimizeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly aiSettings: AiSettingsService,
    private readonly promptModeration: PromptModerationService,
  ) {}

  private buildOptimizeRelatedId() {
    const entropy = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return BigInt(`${Date.now()}${entropy}`);
  }

  private normalizeContent(value: any): string {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            if (typeof item.text === 'string') return item.text;
            if (typeof item.content === 'string') return item.content;
            if (typeof item.delta === 'string') return item.delta;
            if (item.delta && typeof item.delta === 'object' && typeof item.delta.text === 'string') return item.delta.text;
          }
          return '';
        })
        .join('');
    }
    if (value && typeof value === 'object') {
      if (typeof value.text === 'string') return value.text;
      if (typeof value.content === 'string') return value.content;
      if (Array.isArray(value.content)) return this.normalizeContent(value.content);
      if (typeof value.delta === 'string') return value.delta;
      if (value.delta && typeof value.delta === 'object' && typeof value.delta.text === 'string') return value.delta.text;
    }
    return '';
  }

  private extractError(payload: any): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const err = payload.error;
    if (!err) return null;
    if (typeof err === 'string') return err;
    if (typeof err === 'object' && typeof err.message === 'string') return err.message;
    return 'AI 服务返回错误';
  }

  private extractContent(payload: any): string {
    if (typeof payload === 'string') return payload;
    if (!payload || typeof payload !== 'object') return '';

    const firstChoice = payload.choices?.[0];
    const candidates = [
      firstChoice?.delta?.content,
      firstChoice?.message?.content,
      firstChoice?.text,
      payload.delta?.text,
      payload.content_block?.text,
      payload.output_text,
      payload.content,
      payload.text,
    ];

    for (const candidate of candidates) {
      const text = this.normalizeContent(candidate);
      if (text) return text;
    }

    return '';
  }

  private resolveSystemPrompt(
    task: PromptOptimizeTask | undefined,
    modelType: string | undefined,
    defaultSystemPrompt: string,
  ) {
    const isMidjourney = modelType?.toLowerCase().includes('midjourney') || modelType?.toLowerCase().includes('mj');

    if (task === 'video_director') {
      return VIDEO_DIRECTOR_ASSISTANT_SYSTEM_PROMPT;
    }
    if (task === 'project_description') {
      return PROJECT_DESCRIPTION_SYSTEM_PROMPT;
    }
    if (task === 'project_description_bundle') {
      return PROJECT_DESCRIPTION_BUNDLE_SYSTEM_PROMPT;
    }
    if (task === 'project_storyboard') {
      return PROJECT_STORYBOARD_SYSTEM_PROMPT;
    }
    if (task === 'project_image_prompt') {
      return PROJECT_IMAGE_PROMPT_SYSTEM_PROMPT;
    }
    if (isMidjourney) {
      return MIDJOURNEY_SYSTEM_PROMPT;
    }

    return defaultSystemPrompt;
  }

  async generateInternalPrompt(input: {
    userId: bigint;
    prompt: string;
    images?: string[];
    modelType?: string;
    projectDescription?: string;
    task?: Exclude<PromptOptimizeTask, 'project_description'>;
    moderateInput?: boolean;
  }) {
    return this.requestPrompt({
      ...input,
      chargeCredits: false,
      moderateInput: input.moderateInput ?? false,
    });
  }

  async optimizePrompt(
    userId: bigint,
    prompt: string,
    images: string[] | undefined,
    modelType: string | undefined,
    projectDescription: string | undefined,
    task: PromptOptimizeTask | undefined,
  ) {
    return this.requestPrompt({
      userId,
      prompt,
      images,
      modelType,
      projectDescription,
      task,
      chargeCredits: true,
      moderateInput: true,
    });
  }

  private async requestPrompt(input: PromptRequestInput) {
    const {
      userId,
      prompt,
      images,
      modelType,
      projectDescription,
      task,
      chargeCredits,
      moderateInput,
    } = input;

    if (moderateInput) {
      await this.promptModeration.assertInputsAllowed(
        [{ scene: 'prompt_optimize_prompt', content: prompt }],
        '当前提示词未通过内容审核，请修改后重试',
        {
          userId,
          source: 'prompt_optimize',
        },
      );
    }

    const settings = await this.aiSettings.getAiSettings();
    if (!settings.apiBaseUrl || !settings.apiKey || !settings.modelName) {
      throw new BadRequestException('AI 优化功能未配置，请联系管理员');
    }

    let relatedId: bigint | null = null;
    let creditsCharged = false;
    let creditsRefunded = false;

    if (chargeCredits && settings.creditsCost > 0) {
      try {
        relatedId = this.buildOptimizeRelatedId();
        await this.prisma.$transaction(async (tx) => {
          const available = await this.credits.getTotalAvailableCredits(tx, userId);
          if (available.total < settings.creditsCost) {
            throw new Error('INSUFFICIENT_CREDITS');
          }
          await this.credits.consumeCredits(tx, userId, settings.creditsCost, relatedId!, 'AI prompt optimization');
        });
        creditsCharged = true;
      } catch (error: any) {
        if (error.message === 'INSUFFICIENT_CREDITS') {
          throw new BadRequestException('积分不足，请先购买套餐');
        }
        this.logger.error('Credit deduction failed', error);
        throw new BadRequestException('扣除积分失败，请重试');
      }
    }

    const refundIfNeeded = async (reason: string) => {
      if (!creditsCharged || creditsRefunded || !relatedId) return;
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.credits.refundCredits(tx, userId, relatedId!, `Refund AI prompt optimization (${reason})`);
        });
        creditsRefunded = true;
      } catch (refundError) {
        this.logger.error(`Prompt optimization refund failed: ${reason}`, refundError as any);
      }
    };

    try {
      const userContent: any[] = [{ type: 'text', text: prompt }];
      const normalizedProjectDescription = typeof projectDescription === 'string' ? projectDescription.trim() : '';
      if (normalizedProjectDescription) {
        userContent.push({
          type: 'text',
          text: `项目背景描述：${normalizedProjectDescription}`,
        });
      }
      if (images?.length) {
        for (const img of images) {
          const base64Data = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
          userContent.push({ type: 'image_url', image_url: { url: base64Data } });
        }
      }

      const messages = [
        {
          role: 'system',
          content: this.resolveSystemPrompt(task, modelType, settings.systemPrompt),
        },
        { role: 'user', content: userContent },
      ];

      const apiUrl = `${settings.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;
      const apiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.modelName,
          messages,
          stream: false,
        }),
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text().catch(() => 'Unknown error');
        this.logger.error(`AI API error: ${apiRes.status} ${errText}`);
        await refundIfNeeded(`http_${apiRes.status}`);
        throw new BadRequestException(`AI 服务请求失败 (${apiRes.status})`);
      }

      const contentType = (apiRes.headers.get('content-type') ?? '').toLowerCase();
      const raw = await apiRes.text();
      const trimmed = raw.trim();
      let fullText = '';

      if (trimmed) {
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed);
            const payloadError = this.extractError(parsed);
            if (payloadError) {
              await refundIfNeeded('upstream_json_error');
              throw new BadRequestException(payloadError);
            }
            fullText = this.extractContent(parsed).trim();
          } catch (error) {
            if (error instanceof BadRequestException) {
              throw error;
            }
            fullText = trimmed;
          }
        } else {
          fullText = trimmed;
        }
      }

      if (!fullText.trim()) {
        this.logger.error(`Prompt optimization empty result. contentType=${contentType || 'unknown'}`);
        await refundIfNeeded('empty_result');
        throw new BadRequestException(creditsCharged ? 'AI 服务未返回可用内容，已自动退款' : 'AI 服务未返回可用内容');
      }

      return { content: fullText };
    } catch (error: any) {
      this.logger.error('Prompt optimization failed', error);
      await refundIfNeeded('exception');
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(creditsCharged ? '优化失败，积分已自动退回' : '优化失败，请重试');
    }
  }
}
