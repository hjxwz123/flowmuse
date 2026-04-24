import { Injectable, Logger } from '@nestjs/common';
import { ApiChannelStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { RedisService } from '../redis/redis.service';
import { AiSettings, DEFAULT_AI_SETTINGS, SYSTEM_SETTING_KEYS } from './system-settings.constants';
import { SHARED_CHAT_CHANNEL_NAME, SHARED_CHAT_PROVIDER } from './ai-chat.constants';

const AI_SETTINGS_CACHE_TTL_SECONDS = 60 * 60 * 6;
const AI_SETTINGS_VERSION_KEY = 'settings:ai:version';
const AI_SETTINGS_DATA_KEY_PREFIX = 'settings:ai:data';
const AI_SETTINGS_KEYS = [
  SYSTEM_SETTING_KEYS.aiApiBaseUrl,
  SYSTEM_SETTING_KEYS.aiApiKey,
  SYSTEM_SETTING_KEYS.aiModelName,
  SYSTEM_SETTING_KEYS.aiWebSearchTaskModelName,
  SYSTEM_SETTING_KEYS.aiSystemPrompt,
  SYSTEM_SETTING_KEYS.aiCreditsCost,
  SYSTEM_SETTING_KEYS.chatModerationEnabled,
  SYSTEM_SETTING_KEYS.chatModerationApiBaseUrl,
  SYSTEM_SETTING_KEYS.chatModerationApiKey,
  SYSTEM_SETTING_KEYS.chatModerationModelName,
  SYSTEM_SETTING_KEYS.chatModerationSystemPrompt,
  SYSTEM_SETTING_KEYS.chatModerationAutoBanEnabled,
  SYSTEM_SETTING_KEYS.chatModerationAutoBanRules,
] as const;

@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly redis: RedisService,
  ) {}

  private normalizeAutoBanRules(raw: unknown) {
    let parsed: unknown = raw;

    if (typeof raw === 'string') {
      const text = raw.trim();
      if (!text) return DEFAULT_AI_SETTINGS.chatModerationAutoBanRules;

      try {
        parsed = JSON.parse(text);
      } catch {
        return DEFAULT_AI_SETTINGS.chatModerationAutoBanRules;
      }
    }

    if (!Array.isArray(parsed)) {
      return DEFAULT_AI_SETTINGS.chatModerationAutoBanRules;
    }

    const deduped = new Map<number, number>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const triggerCount = Number((item as Record<string, unknown>).triggerCount);
      const banDays = Number((item as Record<string, unknown>).banDays);
      if (!Number.isFinite(triggerCount) || !Number.isFinite(banDays)) continue;

      const normalizedTriggerCount = Math.max(1, Math.trunc(triggerCount));
      const normalizedBanDays = Math.max(1, Math.trunc(banDays));
      const existingBanDays = deduped.get(normalizedTriggerCount) ?? 0;
      deduped.set(normalizedTriggerCount, Math.max(existingBanDays, normalizedBanDays));
    }

    return [...deduped.entries()]
      .map(([triggerCount, banDays]) => ({ triggerCount, banDays }))
      .sort((a, b) => a.triggerCount - b.triggerCount);
  }

  async getAiSettings(): Promise<AiSettings> {
    try {
      const version = (await this.redis.get(AI_SETTINGS_VERSION_KEY)) ?? '0';
      const dataKey = `${AI_SETTINGS_DATA_KEY_PREFIX}:${version}`;
      const cached = await this.redis.getJson<Record<string, string | null>>(dataKey);
      if (cached !== null) {
        return this.mapAiSettingsFromRowMap(cached);
      }

      const fresh = await this.loadAiSettingsRowMapFromDb();
      await this.redis.setJson(dataKey, fresh, AI_SETTINGS_CACHE_TTL_SECONDS);
      return this.mapAiSettingsFromRowMap(fresh);
    } catch (error) {
      this.logger.warn(
        `[getAiSettings] Redis cache unavailable, falling back to DB: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.mapAiSettingsFromRowMap(await this.loadAiSettingsRowMapFromDb());
    }
  }

  async getAiSettingsForAdmin(): Promise<AiSettings> {
    const settings = await this.getAiSettings();
    // mask apiKey for admin display
    if (settings.apiKey && settings.apiKey.length > 8) {
      settings.apiKey = settings.apiKey.slice(0, 4) + '****' + settings.apiKey.slice(-4);
    } else if (settings.apiKey) {
      settings.apiKey = '****';
    }

    if (settings.chatModerationApiKey && settings.chatModerationApiKey.length > 8) {
      settings.chatModerationApiKey =
        settings.chatModerationApiKey.slice(0, 4) + '****' + settings.chatModerationApiKey.slice(-4);
    } else if (settings.chatModerationApiKey) {
      settings.chatModerationApiKey = '****';
    }
    return settings;
  }

  async setAiSettings(input: Partial<AiSettings>) {
    const ops: Array<Promise<any>> = [];

    if (typeof input.apiBaseUrl === 'string') {
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.aiApiBaseUrl },
          create: { key: SYSTEM_SETTING_KEYS.aiApiBaseUrl, value: input.apiBaseUrl, description: 'AI API base URL' },
          update: { value: input.apiBaseUrl },
        }),
      );
    }

    if (typeof input.apiKey === 'string' && input.apiKey && !input.apiKey.includes('****')) {
      const encrypted = this.encryption.encryptString(input.apiKey);
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.aiApiKey },
          create: { key: SYSTEM_SETTING_KEYS.aiApiKey, value: encrypted, description: 'AI API key (encrypted)' },
          update: { value: encrypted },
        }),
      );
    }

    if (typeof input.modelName === 'string') {
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.aiModelName },
          create: { key: SYSTEM_SETTING_KEYS.aiModelName, value: input.modelName, description: 'AI model name' },
          update: { value: input.modelName },
        }),
      );
    }

    if (typeof input.webSearchTaskModelName === 'string') {
      const value = input.webSearchTaskModelName.trim();
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.aiWebSearchTaskModelName },
          create: {
            key: SYSTEM_SETTING_KEYS.aiWebSearchTaskModelName,
            value,
            description: 'Task model name for web search query planning',
          },
          update: { value },
        }),
      );
    }

    if (typeof input.systemPrompt === 'string') {
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.aiSystemPrompt },
          create: { key: SYSTEM_SETTING_KEYS.aiSystemPrompt, value: input.systemPrompt, description: 'AI system prompt' },
          update: { value: input.systemPrompt },
        }),
      );
    }

    if (typeof input.creditsCost === 'number' && Number.isFinite(input.creditsCost)) {
      const v = String(Math.max(0, Math.trunc(input.creditsCost)));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.aiCreditsCost },
          create: { key: SYSTEM_SETTING_KEYS.aiCreditsCost, value: v, description: 'AI optimization credits cost' },
          update: { value: v },
        }),
      );
    }

    if (typeof input.chatModerationEnabled === 'boolean') {
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatModerationEnabled },
          create: {
            key: SYSTEM_SETTING_KEYS.chatModerationEnabled,
            value: input.chatModerationEnabled ? 'true' : 'false',
            description: 'Enable chat input moderation',
          },
          update: { value: input.chatModerationEnabled ? 'true' : 'false' },
        }),
      );
    }

    if (typeof input.chatModerationApiBaseUrl === 'string') {
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatModerationApiBaseUrl },
          create: {
            key: SYSTEM_SETTING_KEYS.chatModerationApiBaseUrl,
            value: input.chatModerationApiBaseUrl,
            description: 'Chat moderation API base URL',
          },
          update: { value: input.chatModerationApiBaseUrl },
        }),
      );
    }

    if (
      typeof input.chatModerationApiKey === 'string' &&
      input.chatModerationApiKey &&
      !input.chatModerationApiKey.includes('****')
    ) {
      const encrypted = this.encryption.encryptString(input.chatModerationApiKey);
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatModerationApiKey },
          create: {
            key: SYSTEM_SETTING_KEYS.chatModerationApiKey,
            value: encrypted,
            description: 'Chat moderation API key (encrypted)',
          },
          update: { value: encrypted },
        }),
      );
    }

    if (typeof input.chatModerationModelName === 'string') {
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatModerationModelName },
          create: {
            key: SYSTEM_SETTING_KEYS.chatModerationModelName,
            value: input.chatModerationModelName,
            description: 'Chat moderation model name',
          },
          update: { value: input.chatModerationModelName },
        }),
      );
    }

    if (typeof input.chatModerationSystemPrompt === 'string') {
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatModerationSystemPrompt },
          create: {
            key: SYSTEM_SETTING_KEYS.chatModerationSystemPrompt,
            value: input.chatModerationSystemPrompt,
            description: 'Chat moderation system prompt',
          },
          update: { value: input.chatModerationSystemPrompt },
        }),
      );
    }

    if (typeof input.chatModerationAutoBanEnabled === 'boolean') {
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatModerationAutoBanEnabled },
          create: {
            key: SYSTEM_SETTING_KEYS.chatModerationAutoBanEnabled,
            value: input.chatModerationAutoBanEnabled ? 'true' : 'false',
            description: 'Enable chat moderation auto-ban rules',
          },
          update: { value: input.chatModerationAutoBanEnabled ? 'true' : 'false' },
        }),
      );
    }

    if (input.chatModerationAutoBanRules !== undefined) {
      const value = JSON.stringify(this.normalizeAutoBanRules(input.chatModerationAutoBanRules));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatModerationAutoBanRules },
          create: {
            key: SYSTEM_SETTING_KEYS.chatModerationAutoBanRules,
            value,
            description: 'Chat moderation auto-ban rules JSON',
          },
          update: { value },
        }),
      );
    }

    await Promise.all(ops);
    if (ops.length > 0) {
      await this.bumpCacheVersion('setAiSettings');
    }
    await this.syncSharedChatChannel();
    return this.getAiSettingsForAdmin();
  }

  private async syncSharedChatChannel() {
    const settings = await this.getAiSettings();
    const baseUrl = settings.apiBaseUrl.trim();
    const apiKey = settings.apiKey.trim();

    // 对话模型依赖共享 channel；若 AI 配置尚未完成则跳过同步。
    if (!baseUrl || !apiKey) return;

    const encryptedApiKey = this.encryption.encryptString(apiKey);

    const existing = await this.prisma.apiChannel.findFirst({
      where: {
        provider: SHARED_CHAT_PROVIDER,
        name: SHARED_CHAT_CHANNEL_NAME,
      },
      orderBy: { id: 'asc' },
    });

    if (existing) {
      await this.prisma.apiChannel.update({
        where: { id: existing.id },
        data: {
          baseUrl,
          apiKey: encryptedApiKey,
          status: ApiChannelStatus.active,
          timeout: Math.max(existing.timeout, 60_000),
        },
      });
      return;
    }

    await this.prisma.apiChannel.create({
      data: {
        name: SHARED_CHAT_CHANNEL_NAME,
        provider: SHARED_CHAT_PROVIDER,
        baseUrl,
        apiKey: encryptedApiKey,
        timeout: 120_000,
        maxRetry: 2,
        status: ApiChannelStatus.active,
        priority: 0,
        description: 'Shared chat channel driven by /admin/config/ai settings',
      },
    });
  }

  private async loadAiSettingsRowMapFromDb(): Promise<Record<string, string | null>> {
    const rows = await this.prisma.systemConfig.findMany({
      where: {
        key: {
          in: [...AI_SETTINGS_KEYS],
        },
      },
    });

    const map: Record<string, string | null> = {};
    for (const row of rows) {
      map[row.key] = row.value ?? null;
    }

    return map;
  }

  private mapAiSettingsFromRowMap(map: Record<string, string | null>): AiSettings {
    const rawKey = map[SYSTEM_SETTING_KEYS.aiApiKey] ?? '';
    const rawModerationKey = map[SYSTEM_SETTING_KEYS.chatModerationApiKey] ?? '';
    const costStr = map[SYSTEM_SETTING_KEYS.aiCreditsCost] ?? '';
    const cost = costStr ? Number(costStr) : DEFAULT_AI_SETTINGS.creditsCost;

    return {
      apiBaseUrl: map[SYSTEM_SETTING_KEYS.aiApiBaseUrl] || DEFAULT_AI_SETTINGS.apiBaseUrl,
      apiKey: rawKey ? (this.encryption.decryptString(rawKey) ?? '') : '',
      modelName: map[SYSTEM_SETTING_KEYS.aiModelName] || DEFAULT_AI_SETTINGS.modelName,
      webSearchTaskModelName:
        map[SYSTEM_SETTING_KEYS.aiWebSearchTaskModelName] || DEFAULT_AI_SETTINGS.webSearchTaskModelName,
      systemPrompt: map[SYSTEM_SETTING_KEYS.aiSystemPrompt] ?? DEFAULT_AI_SETTINGS.systemPrompt,
      creditsCost: Number.isFinite(cost) ? Math.max(0, Math.trunc(cost)) : DEFAULT_AI_SETTINGS.creditsCost,
      chatModerationEnabled:
        (map[SYSTEM_SETTING_KEYS.chatModerationEnabled] ?? '').trim().toLowerCase() === 'true'
          ? true
          : DEFAULT_AI_SETTINGS.chatModerationEnabled,
      chatModerationApiBaseUrl:
        map[SYSTEM_SETTING_KEYS.chatModerationApiBaseUrl] || DEFAULT_AI_SETTINGS.chatModerationApiBaseUrl,
      chatModerationApiKey: rawModerationKey ? (this.encryption.decryptString(rawModerationKey) ?? '') : '',
      chatModerationModelName:
        map[SYSTEM_SETTING_KEYS.chatModerationModelName] || DEFAULT_AI_SETTINGS.chatModerationModelName,
      chatModerationSystemPrompt:
        map[SYSTEM_SETTING_KEYS.chatModerationSystemPrompt] ?? DEFAULT_AI_SETTINGS.chatModerationSystemPrompt,
      chatModerationAutoBanEnabled:
        (map[SYSTEM_SETTING_KEYS.chatModerationAutoBanEnabled] ?? '').trim().toLowerCase() === 'true'
          ? true
          : DEFAULT_AI_SETTINGS.chatModerationAutoBanEnabled,
      chatModerationAutoBanRules: this.normalizeAutoBanRules(
        map[SYSTEM_SETTING_KEYS.chatModerationAutoBanRules] ?? '',
      ),
    };
  }

  private async bumpCacheVersion(label: string) {
    try {
      await this.redis.incr(AI_SETTINGS_VERSION_KEY);
    } catch (error) {
      this.logger.warn(
        `[${label}] Failed to bump Redis cache version: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
