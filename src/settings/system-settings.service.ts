import { Injectable, Logger } from '@nestjs/common';
import { SystemConfig } from '@prisma/client';

import { EncryptionService } from '../encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  AdminSiteSettings,
  DEFAULT_PUBLIC_SETTINGS,
  DEFAULT_EMAIL_WHITELIST_SETTINGS,
  DEFAULT_WECHAT_PAY_SETTINGS,
  PublicSystemSettings,
  EmailWhitelistSettings,
  TurnstileSettings,
  WechatPaySettings,
  SYSTEM_SETTING_KEYS,
} from './system-settings.constants';

function parseBool(value: string | null | undefined, fallback: boolean) {
  if (value === null || value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (!v) return fallback;
  if (['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'disabled'].includes(v)) return false;
  return fallback;
}

function parseIntSafe(value: string | null | undefined, fallback: number) {
  if (value === null || value === undefined) return fallback;
  const v = value.trim();
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function parseFloatSafe(value: string | null | undefined, fallback: number) {
  if (value === null || value === undefined) return fallback;
  const v = value.trim();
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function toMap(items: SystemConfig[]) {
  const map = new Map<string, string | null>();
  for (const item of items) map.set(item.key, item.value ?? null);
  return map;
}

const SETTINGS_CACHE_TTL_SECONDS = 60 * 60 * 6;
const PUBLIC_SETTINGS_VERSION_KEY = 'settings:public:version';
const PUBLIC_SETTINGS_DATA_KEY_PREFIX = 'settings:public:data';
const EMAIL_WHITELIST_SETTINGS_VERSION_KEY = 'settings:email-whitelist:version';
const EMAIL_WHITELIST_SETTINGS_DATA_KEY_PREFIX = 'settings:email-whitelist:data';
const WECHAT_PAY_SETTINGS_VERSION_KEY = 'settings:wechat-pay:version';
const WECHAT_PAY_SETTINGS_DATA_KEY_PREFIX = 'settings:wechat-pay:data';

const PUBLIC_SETTINGS_KEYS = [
  SYSTEM_SETTING_KEYS.registrationEnabled,
  SYSTEM_SETTING_KEYS.initialRegisterCredits,
  SYSTEM_SETTING_KEYS.inviteRegisterInviterCredits,
  SYSTEM_SETTING_KEYS.inviteRegisterInviteeCredits,
  SYSTEM_SETTING_KEYS.invitePaymentCreditsPerYuan,
  SYSTEM_SETTING_KEYS.siteTitle,
  SYSTEM_SETTING_KEYS.siteIcon,
  SYSTEM_SETTING_KEYS.siteFooter,
  SYSTEM_SETTING_KEYS.homeTopMarqueeText,
  SYSTEM_SETTING_KEYS.startupPopupType,
  SYSTEM_SETTING_KEYS.startupPopupImageUrl,
  SYSTEM_SETTING_KEYS.startupPopupHtml,
  SYSTEM_SETTING_KEYS.startupPopupTargetUrl,
  SYSTEM_SETTING_KEYS.startupPopupWidthPx,
  SYSTEM_SETTING_KEYS.startupPopupHeightPx,
  SYSTEM_SETTING_KEYS.cardPurchaseUrl,
  SYSTEM_SETTING_KEYS.aboutUs,
  SYSTEM_SETTING_KEYS.privacyPolicy,
  SYSTEM_SETTING_KEYS.termsOfService,
  SYSTEM_SETTING_KEYS.themeColor,
  SYSTEM_SETTING_KEYS.turnstileEnabled,
  SYSTEM_SETTING_KEYS.turnstileSiteKey,
  SYSTEM_SETTING_KEYS.wechatPayEnabled,
  SYSTEM_SETTING_KEYS.creditBuyEnabled,
  SYSTEM_SETTING_KEYS.creditBuyRatePerYuan,
  SYSTEM_SETTING_KEYS.creditBuyMinCredits,
  SYSTEM_SETTING_KEYS.creditBuyMaxCredits,
  SYSTEM_SETTING_KEYS.chatFileUploadEnabled,
  SYSTEM_SETTING_KEYS.chatFileMaxFilesPerMessage,
  SYSTEM_SETTING_KEYS.chatFileMaxFileSizeMb,
  SYSTEM_SETTING_KEYS.chatFileAllowedExtensions,
  SYSTEM_SETTING_KEYS.chatFileMaxExtractChars,
  SYSTEM_SETTING_KEYS.chatFileContextMode,
  SYSTEM_SETTING_KEYS.chatFileRetrievalTopK,
  SYSTEM_SETTING_KEYS.chatFileChunkSize,
  SYSTEM_SETTING_KEYS.chatFileChunkOverlap,
  SYSTEM_SETTING_KEYS.chatFileRetrievalMaxChars,
  SYSTEM_SETTING_KEYS.webSearchEnabled,
  SYSTEM_SETTING_KEYS.webSearchBaseUrl,
  SYSTEM_SETTING_KEYS.webSearchMode,
  SYSTEM_SETTING_KEYS.webSearchLanguage,
  SYSTEM_SETTING_KEYS.webSearchCategories,
  SYSTEM_SETTING_KEYS.webSearchSafeSearch,
  SYSTEM_SETTING_KEYS.webSearchTimeRange,
  SYSTEM_SETTING_KEYS.webSearchTopK,
  SYSTEM_SETTING_KEYS.webSearchTimeoutMs,
  SYSTEM_SETTING_KEYS.webSearchBlockedDomains,
] as const;

const EMAIL_WHITELIST_SETTINGS_KEYS = [
  SYSTEM_SETTING_KEYS.emailDomainWhitelistEnabled,
  SYSTEM_SETTING_KEYS.emailDomainWhitelist,
] as const;

const WECHAT_PAY_SETTINGS_KEYS = [
  SYSTEM_SETTING_KEYS.wechatPayEnabled,
  SYSTEM_SETTING_KEYS.wechatPayAppId,
  SYSTEM_SETTING_KEYS.wechatPayMchId,
  SYSTEM_SETTING_KEYS.wechatPayApiV3Key,
  SYSTEM_SETTING_KEYS.wechatPayPrivateKey,
  SYSTEM_SETTING_KEYS.wechatPaySerialNo,
  SYSTEM_SETTING_KEYS.wechatPayNotifyUrl,
] as const;

@Injectable()
export class SystemSettingsService {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly encryption: EncryptionService,
  ) {}

  private maskSensitiveValue(value: string) {
    if (!value) return '';
    if (value.length > 8) {
      return value.slice(0, 4) + '****' + value.slice(-4);
    }
    return '****';
  }

  async getPublicSettings(): Promise<PublicSystemSettings> {
    return this.getVersionedCache(
      PUBLIC_SETTINGS_VERSION_KEY,
      PUBLIC_SETTINGS_DATA_KEY_PREFIX,
      async () => {
        const rows = await this.prisma.systemConfig.findMany({
          where: {
            key: {
              in: [...PUBLIC_SETTINGS_KEYS],
            },
          },
        });
        const map = toMap(rows);

        return {
          registrationEnabled: parseBool(map.get(SYSTEM_SETTING_KEYS.registrationEnabled) ?? null, DEFAULT_PUBLIC_SETTINGS.registrationEnabled),
          initialRegisterCredits: Math.max(
            0,
            parseIntSafe(map.get(SYSTEM_SETTING_KEYS.initialRegisterCredits) ?? null, DEFAULT_PUBLIC_SETTINGS.initialRegisterCredits),
          ),
          inviteRegisterInviterCredits: Math.max(
            0,
            parseIntSafe(
              map.get(SYSTEM_SETTING_KEYS.inviteRegisterInviterCredits) ?? null,
              DEFAULT_PUBLIC_SETTINGS.inviteRegisterInviterCredits,
            ),
          ),
          inviteRegisterInviteeCredits: Math.max(
            0,
            parseIntSafe(
              map.get(SYSTEM_SETTING_KEYS.inviteRegisterInviteeCredits) ?? null,
              DEFAULT_PUBLIC_SETTINGS.inviteRegisterInviteeCredits,
            ),
          ),
          invitePaymentCreditsPerYuan: Math.max(
            0,
            parseFloatSafe(
              map.get(SYSTEM_SETTING_KEYS.invitePaymentCreditsPerYuan) ?? null,
              DEFAULT_PUBLIC_SETTINGS.invitePaymentCreditsPerYuan,
            ),
          ),
          siteTitle: (map.get(SYSTEM_SETTING_KEYS.siteTitle) ?? DEFAULT_PUBLIC_SETTINGS.siteTitle) || DEFAULT_PUBLIC_SETTINGS.siteTitle,
          siteIcon: (map.get(SYSTEM_SETTING_KEYS.siteIcon) ?? DEFAULT_PUBLIC_SETTINGS.siteIcon) || DEFAULT_PUBLIC_SETTINGS.siteIcon,
          siteFooter: (map.get(SYSTEM_SETTING_KEYS.siteFooter) ?? DEFAULT_PUBLIC_SETTINGS.siteFooter) || DEFAULT_PUBLIC_SETTINGS.siteFooter,
          homeTopMarqueeText: map.get(SYSTEM_SETTING_KEYS.homeTopMarqueeText) ?? DEFAULT_PUBLIC_SETTINGS.homeTopMarqueeText,
          startupPopupType: (() => {
            const raw = (map.get(SYSTEM_SETTING_KEYS.startupPopupType) ?? DEFAULT_PUBLIC_SETTINGS.startupPopupType).trim().toLowerCase();
            return raw === 'html' ? 'html' : 'image';
          })(),
          startupPopupImageUrl:
            (map.get(SYSTEM_SETTING_KEYS.startupPopupImageUrl) ?? DEFAULT_PUBLIC_SETTINGS.startupPopupImageUrl)
            || DEFAULT_PUBLIC_SETTINGS.startupPopupImageUrl,
          startupPopupHtml: map.get(SYSTEM_SETTING_KEYS.startupPopupHtml) ?? DEFAULT_PUBLIC_SETTINGS.startupPopupHtml,
          startupPopupTargetUrl:
            (map.get(SYSTEM_SETTING_KEYS.startupPopupTargetUrl) ?? DEFAULT_PUBLIC_SETTINGS.startupPopupTargetUrl)
            || DEFAULT_PUBLIC_SETTINGS.startupPopupTargetUrl,
          startupPopupWidthPx: Math.max(
            240,
            parseIntSafe(map.get(SYSTEM_SETTING_KEYS.startupPopupWidthPx) ?? null, DEFAULT_PUBLIC_SETTINGS.startupPopupWidthPx),
          ),
          startupPopupHeightPx: Math.max(
            0,
            parseIntSafe(map.get(SYSTEM_SETTING_KEYS.startupPopupHeightPx) ?? null, DEFAULT_PUBLIC_SETTINGS.startupPopupHeightPx),
          ),
          cardPurchaseUrl:
            (map.get(SYSTEM_SETTING_KEYS.cardPurchaseUrl) ?? DEFAULT_PUBLIC_SETTINGS.cardPurchaseUrl) || DEFAULT_PUBLIC_SETTINGS.cardPurchaseUrl,
          aboutUs: map.get(SYSTEM_SETTING_KEYS.aboutUs) ?? DEFAULT_PUBLIC_SETTINGS.aboutUs,
          privacyPolicy: map.get(SYSTEM_SETTING_KEYS.privacyPolicy) ?? DEFAULT_PUBLIC_SETTINGS.privacyPolicy,
          termsOfService: map.get(SYSTEM_SETTING_KEYS.termsOfService) ?? DEFAULT_PUBLIC_SETTINGS.termsOfService,
          themeColor: map.get(SYSTEM_SETTING_KEYS.themeColor) ?? DEFAULT_PUBLIC_SETTINGS.themeColor,
          turnstileEnabled: parseBool(map.get(SYSTEM_SETTING_KEYS.turnstileEnabled) ?? null, DEFAULT_PUBLIC_SETTINGS.turnstileEnabled),
          turnstileSiteKey: map.get(SYSTEM_SETTING_KEYS.turnstileSiteKey) ?? DEFAULT_PUBLIC_SETTINGS.turnstileSiteKey,
          wechatPayEnabled: parseBool(map.get(SYSTEM_SETTING_KEYS.wechatPayEnabled) ?? null, DEFAULT_PUBLIC_SETTINGS.wechatPayEnabled),
          creditBuyEnabled: parseBool(map.get(SYSTEM_SETTING_KEYS.creditBuyEnabled) ?? null, DEFAULT_PUBLIC_SETTINGS.creditBuyEnabled),
          creditBuyRatePerYuan: Math.max(
            1,
            parseIntSafe(map.get(SYSTEM_SETTING_KEYS.creditBuyRatePerYuan) ?? null, DEFAULT_PUBLIC_SETTINGS.creditBuyRatePerYuan),
          ),
          creditBuyMinCredits: Math.max(
            1,
            parseIntSafe(map.get(SYSTEM_SETTING_KEYS.creditBuyMinCredits) ?? null, DEFAULT_PUBLIC_SETTINGS.creditBuyMinCredits),
          ),
          creditBuyMaxCredits: Math.max(
            1,
            parseIntSafe(map.get(SYSTEM_SETTING_KEYS.creditBuyMaxCredits) ?? null, DEFAULT_PUBLIC_SETTINGS.creditBuyMaxCredits),
          ),
          chatFileUploadEnabled: parseBool(map.get(SYSTEM_SETTING_KEYS.chatFileUploadEnabled) ?? null, DEFAULT_PUBLIC_SETTINGS.chatFileUploadEnabled),
          chatFileMaxFilesPerMessage: Math.max(
            1,
            parseIntSafe(map.get(SYSTEM_SETTING_KEYS.chatFileMaxFilesPerMessage) ?? null, DEFAULT_PUBLIC_SETTINGS.chatFileMaxFilesPerMessage),
          ),
          chatFileMaxFileSizeMb: Math.max(
            1,
            parseIntSafe(map.get(SYSTEM_SETTING_KEYS.chatFileMaxFileSizeMb) ?? null, DEFAULT_PUBLIC_SETTINGS.chatFileMaxFileSizeMb),
          ),
          chatFileAllowedExtensions:
            (map.get(SYSTEM_SETTING_KEYS.chatFileAllowedExtensions) ?? DEFAULT_PUBLIC_SETTINGS.chatFileAllowedExtensions) ||
            DEFAULT_PUBLIC_SETTINGS.chatFileAllowedExtensions,
          chatFileMaxExtractChars: Math.max(
            1000,
            parseIntSafe(map.get(SYSTEM_SETTING_KEYS.chatFileMaxExtractChars) ?? null, DEFAULT_PUBLIC_SETTINGS.chatFileMaxExtractChars),
          ),
          chatFileContextMode: (() => {
            const raw = (map.get(SYSTEM_SETTING_KEYS.chatFileContextMode) ?? DEFAULT_PUBLIC_SETTINGS.chatFileContextMode).trim().toLowerCase();
            return raw === 'full' ? 'full' : 'retrieval';
          })(),
          chatFileRetrievalTopK: Math.max(
            1,
            parseIntSafe(map.get(SYSTEM_SETTING_KEYS.chatFileRetrievalTopK) ?? null, DEFAULT_PUBLIC_SETTINGS.chatFileRetrievalTopK),
          ),
          chatFileChunkSize: Math.max(
            200,
            parseIntSafe(map.get(SYSTEM_SETTING_KEYS.chatFileChunkSize) ?? null, DEFAULT_PUBLIC_SETTINGS.chatFileChunkSize),
          ),
          chatFileChunkOverlap: Math.max(
            0,
            parseIntSafe(map.get(SYSTEM_SETTING_KEYS.chatFileChunkOverlap) ?? null, DEFAULT_PUBLIC_SETTINGS.chatFileChunkOverlap),
          ),
          chatFileRetrievalMaxChars: Math.max(
            1000,
            parseIntSafe(map.get(SYSTEM_SETTING_KEYS.chatFileRetrievalMaxChars) ?? null, DEFAULT_PUBLIC_SETTINGS.chatFileRetrievalMaxChars),
          ),
          webSearchEnabled: parseBool(map.get(SYSTEM_SETTING_KEYS.webSearchEnabled) ?? null, DEFAULT_PUBLIC_SETTINGS.webSearchEnabled),
          webSearchBaseUrl: map.get(SYSTEM_SETTING_KEYS.webSearchBaseUrl) ?? DEFAULT_PUBLIC_SETTINGS.webSearchBaseUrl,
          webSearchMode: (() => {
            const raw = (map.get(SYSTEM_SETTING_KEYS.webSearchMode) ?? DEFAULT_PUBLIC_SETTINGS.webSearchMode).trim().toLowerCase();
            if (raw === 'always') return 'always';
            if (raw === 'auto') return 'auto';
            return 'off';
          })(),
          webSearchLanguage:
            (map.get(SYSTEM_SETTING_KEYS.webSearchLanguage) ?? DEFAULT_PUBLIC_SETTINGS.webSearchLanguage) ||
            DEFAULT_PUBLIC_SETTINGS.webSearchLanguage,
          webSearchCategories:
            (map.get(SYSTEM_SETTING_KEYS.webSearchCategories) ?? DEFAULT_PUBLIC_SETTINGS.webSearchCategories) ||
            DEFAULT_PUBLIC_SETTINGS.webSearchCategories,
          webSearchSafeSearch: Math.max(
            0,
            Math.min(2, parseIntSafe(map.get(SYSTEM_SETTING_KEYS.webSearchSafeSearch) ?? null, DEFAULT_PUBLIC_SETTINGS.webSearchSafeSearch)),
          ),
          webSearchTimeRange: (() => {
            const raw = (map.get(SYSTEM_SETTING_KEYS.webSearchTimeRange) ?? DEFAULT_PUBLIC_SETTINGS.webSearchTimeRange).trim().toLowerCase();
            if (raw === 'day' || raw === 'week' || raw === 'month' || raw === 'year') {
              return raw;
            }
            return '';
          })(),
          webSearchTopK: Math.max(
            1,
            Math.min(20, parseIntSafe(map.get(SYSTEM_SETTING_KEYS.webSearchTopK) ?? null, DEFAULT_PUBLIC_SETTINGS.webSearchTopK)),
          ),
          webSearchTimeoutMs: Math.max(
            1000,
            Math.min(30_000, parseIntSafe(map.get(SYSTEM_SETTING_KEYS.webSearchTimeoutMs) ?? null, DEFAULT_PUBLIC_SETTINGS.webSearchTimeoutMs)),
          ),
          webSearchBlockedDomains: (() => {
            const raw = map.get(SYSTEM_SETTING_KEYS.webSearchBlockedDomains) ?? DEFAULT_PUBLIC_SETTINGS.webSearchBlockedDomains;
            return raw
              .split(/[\n,;]+/)
              .map((item) => item.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, ''))
              .filter((item) => item.length > 0)
              .join(',');
          })(),
        };
      },
      'getPublicSettings',
    );
  }

  async getSiteSettingsForAdmin(): Promise<AdminSiteSettings> {
    const [publicSettings, secretRow] = await Promise.all([
      this.getPublicSettings(),
      this.prisma.systemConfig.findUnique({
        where: { key: SYSTEM_SETTING_KEYS.turnstileSecretKey },
        select: { value: true },
      }),
    ]);

    const secretKey = this.encryption.decryptString(secretRow?.value ?? '') ?? '';

    return {
      ...publicSettings,
      turnstileSecretKey: this.maskSensitiveValue(secretKey),
    };
  }

  async getTurnstileSettings(): Promise<TurnstileSettings> {
    const [publicSettings, secretRow] = await Promise.all([
      this.getPublicSettings(),
      this.prisma.systemConfig.findUnique({
        where: { key: SYSTEM_SETTING_KEYS.turnstileSecretKey },
        select: { value: true },
      }),
    ]);

    const decryptedSecretKey = this.encryption.decryptString(secretRow?.value ?? '');

    return {
      enabled: publicSettings.turnstileEnabled === true,
      siteKey: typeof publicSettings.turnstileSiteKey === 'string' ? publicSettings.turnstileSiteKey.trim() : '',
      secretKey: typeof decryptedSecretKey === 'string' ? decryptedSecretKey.trim() : '',
    };
  }

  async isRegistrationEnabled(): Promise<boolean> {
    const settings = await this.getPublicSettings();
    return settings.registrationEnabled;
  }

  async getInitialRegisterCredits(): Promise<number> {
    const settings = await this.getPublicSettings();
    return settings.initialRegisterCredits;
  }

  async setPublicSettings(input: Partial<PublicSystemSettings>) {
    const ops: Array<Promise<any>> = [];
    let shouldBumpPublicCache = false;

    if (typeof input.registrationEnabled === 'boolean') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.registrationEnabled },
          create: { key: SYSTEM_SETTING_KEYS.registrationEnabled, value: input.registrationEnabled ? 'true' : 'false', description: 'Enable registration' },
          update: { value: input.registrationEnabled ? 'true' : 'false', description: 'Enable registration' },
        }),
      );
    }

    if (typeof input.initialRegisterCredits === 'number' && Number.isFinite(input.initialRegisterCredits)) {
      shouldBumpPublicCache = true;
      const v = String(Math.max(0, Math.trunc(input.initialRegisterCredits)));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.initialRegisterCredits },
          create: { key: SYSTEM_SETTING_KEYS.initialRegisterCredits, value: v, description: 'Initial permanent credits for new users' },
          update: { value: v, description: 'Initial permanent credits for new users' },
        }),
      );
    }

    if (
      typeof input.inviteRegisterInviterCredits === 'number'
      && Number.isFinite(input.inviteRegisterInviterCredits)
    ) {
      shouldBumpPublicCache = true;
      const v = String(Math.max(0, Math.trunc(input.inviteRegisterInviterCredits)));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.inviteRegisterInviterCredits },
          create: {
            key: SYSTEM_SETTING_KEYS.inviteRegisterInviterCredits,
            value: v,
            description: 'Credits granted to inviter when invitee registers',
          },
          update: {
            value: v,
            description: 'Credits granted to inviter when invitee registers',
          },
        }),
      );
    }

    if (
      typeof input.inviteRegisterInviteeCredits === 'number'
      && Number.isFinite(input.inviteRegisterInviteeCredits)
    ) {
      shouldBumpPublicCache = true;
      const v = String(Math.max(0, Math.trunc(input.inviteRegisterInviteeCredits)));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.inviteRegisterInviteeCredits },
          create: {
            key: SYSTEM_SETTING_KEYS.inviteRegisterInviteeCredits,
            value: v,
            description: 'Credits granted to invitee when registering with invite code',
          },
          update: {
            value: v,
            description: 'Credits granted to invitee when registering with invite code',
          },
        }),
      );
    }

    if (
      typeof input.invitePaymentCreditsPerYuan === 'number'
      && Number.isFinite(input.invitePaymentCreditsPerYuan)
    ) {
      shouldBumpPublicCache = true;
      const v = String(Math.max(0, input.invitePaymentCreditsPerYuan));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.invitePaymentCreditsPerYuan },
          create: {
            key: SYSTEM_SETTING_KEYS.invitePaymentCreditsPerYuan,
            value: v,
            description: 'Referral payment reward credits per paid yuan',
          },
          update: {
            value: v,
            description: 'Referral payment reward credits per paid yuan',
          },
        }),
      );
    }

    if (typeof input.siteTitle === 'string') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.siteTitle },
          create: { key: SYSTEM_SETTING_KEYS.siteTitle, value: input.siteTitle, description: 'Site title' },
          update: { value: input.siteTitle, description: 'Site title' },
        }),
      );
    }

    if (typeof input.siteIcon === 'string') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.siteIcon },
          create: { key: SYSTEM_SETTING_KEYS.siteIcon, value: input.siteIcon, description: 'Site icon URL' },
          update: { value: input.siteIcon, description: 'Site icon URL' },
        }),
      );
    }

    if (typeof input.siteFooter === 'string') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.siteFooter },
          create: { key: SYSTEM_SETTING_KEYS.siteFooter, value: input.siteFooter, description: 'Site footer text' },
          update: { value: input.siteFooter, description: 'Site footer text' },
        }),
      );
    }

    if (typeof input.homeTopMarqueeText === 'string') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.homeTopMarqueeText },
          create: {
            key: SYSTEM_SETTING_KEYS.homeTopMarqueeText,
            value: input.homeTopMarqueeText,
            description: 'Homepage top marquee text',
          },
          update: {
            value: input.homeTopMarqueeText,
            description: 'Homepage top marquee text',
          },
        }),
      );
    }

    if (typeof input.startupPopupType === 'string') {
      shouldBumpPublicCache = true;
      const normalizedType = input.startupPopupType === 'html' ? 'html' : 'image';
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.startupPopupType },
          create: {
            key: SYSTEM_SETTING_KEYS.startupPopupType,
            value: normalizedType,
            description: 'Global startup popup content type',
          },
          update: {
            value: normalizedType,
            description: 'Global startup popup content type',
          },
        }),
      );
    }

    if (typeof input.startupPopupImageUrl === 'string') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.startupPopupImageUrl },
          create: {
            key: SYSTEM_SETTING_KEYS.startupPopupImageUrl,
            value: input.startupPopupImageUrl,
            description: 'Global startup popup image URL',
          },
          update: {
            value: input.startupPopupImageUrl,
            description: 'Global startup popup image URL',
          },
        }),
      );
    }

    if (typeof input.startupPopupHtml === 'string') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.startupPopupHtml },
          create: {
            key: SYSTEM_SETTING_KEYS.startupPopupHtml,
            value: input.startupPopupHtml,
            description: 'Global startup popup HTML content',
          },
          update: {
            value: input.startupPopupHtml,
            description: 'Global startup popup HTML content',
          },
        }),
      );
    }

    if (typeof input.startupPopupTargetUrl === 'string') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.startupPopupTargetUrl },
          create: {
            key: SYSTEM_SETTING_KEYS.startupPopupTargetUrl,
            value: input.startupPopupTargetUrl,
            description: 'Global startup popup target URL',
          },
          update: {
            value: input.startupPopupTargetUrl,
            description: 'Global startup popup target URL',
          },
        }),
      );
    }

    if (typeof input.startupPopupWidthPx === 'number' && Number.isFinite(input.startupPopupWidthPx)) {
      shouldBumpPublicCache = true;
      const v = String(Math.max(240, Math.trunc(input.startupPopupWidthPx)));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.startupPopupWidthPx },
          create: {
            key: SYSTEM_SETTING_KEYS.startupPopupWidthPx,
            value: v,
            description: 'Global startup popup width in px',
          },
          update: {
            value: v,
            description: 'Global startup popup width in px',
          },
        }),
      );
    }

    if (typeof input.startupPopupHeightPx === 'number' && Number.isFinite(input.startupPopupHeightPx)) {
      shouldBumpPublicCache = true;
      const v = String(Math.max(0, Math.trunc(input.startupPopupHeightPx)));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.startupPopupHeightPx },
          create: {
            key: SYSTEM_SETTING_KEYS.startupPopupHeightPx,
            value: v,
            description: 'Global startup popup height in px, 0 means auto',
          },
          update: {
            value: v,
            description: 'Global startup popup height in px, 0 means auto',
          },
        }),
      );
    }

    if (typeof input.cardPurchaseUrl === 'string') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.cardPurchaseUrl },
          create: { key: SYSTEM_SETTING_KEYS.cardPurchaseUrl, value: input.cardPurchaseUrl, description: 'Card purchase URL' },
          update: { value: input.cardPurchaseUrl, description: 'Card purchase URL' },
        }),
      );
    }

    if (typeof input.aboutUs === 'string') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.aboutUs },
          create: { key: SYSTEM_SETTING_KEYS.aboutUs, value: input.aboutUs, description: 'About us page content' },
          update: { value: input.aboutUs, description: 'About us page content' },
        }),
      );
    }

    if (typeof input.privacyPolicy === 'string') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.privacyPolicy },
          create: { key: SYSTEM_SETTING_KEYS.privacyPolicy, value: input.privacyPolicy, description: 'Privacy policy page content' },
          update: { value: input.privacyPolicy, description: 'Privacy policy page content' },
        }),
      );
    }

    if (typeof input.termsOfService === 'string') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.termsOfService },
          create: { key: SYSTEM_SETTING_KEYS.termsOfService, value: input.termsOfService, description: 'Terms of service page content' },
          update: { value: input.termsOfService, description: 'Terms of service page content' },
        }),
      );
    }

    if (typeof input.themeColor === 'string') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.themeColor },
          create: { key: SYSTEM_SETTING_KEYS.themeColor, value: input.themeColor, description: 'Site theme color (hex)' },
          update: { value: input.themeColor, description: 'Site theme color (hex)' },
        }),
      );
    }

    if (typeof input.turnstileEnabled === 'boolean') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.turnstileEnabled },
          create: {
            key: SYSTEM_SETTING_KEYS.turnstileEnabled,
            value: input.turnstileEnabled ? 'true' : 'false',
            description: 'Enable Cloudflare Turnstile for login and registration',
          },
          update: {
            value: input.turnstileEnabled ? 'true' : 'false',
            description: 'Enable Cloudflare Turnstile for login and registration',
          },
        }),
      );
    }

    if (typeof input.turnstileSiteKey === 'string') {
      shouldBumpPublicCache = true;
      const value = input.turnstileSiteKey.trim();
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.turnstileSiteKey },
          create: {
            key: SYSTEM_SETTING_KEYS.turnstileSiteKey,
            value,
            description: 'Cloudflare Turnstile site key',
          },
          update: {
            value,
            description: 'Cloudflare Turnstile site key',
          },
        }),
      );
    }

    const turnstileSecretKey = (input as Partial<AdminSiteSettings>).turnstileSecretKey;
    if (
      typeof turnstileSecretKey === 'string' &&
      turnstileSecretKey.trim() &&
      !turnstileSecretKey.includes('****')
    ) {
      const encrypted = this.encryption.encryptString(turnstileSecretKey.trim());
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.turnstileSecretKey },
          create: {
            key: SYSTEM_SETTING_KEYS.turnstileSecretKey,
            value: encrypted,
            description: 'Cloudflare Turnstile secret key (encrypted)',
          },
          update: {
            value: encrypted,
            description: 'Cloudflare Turnstile secret key (encrypted)',
          },
        }),
      );
    }

    if (typeof input.creditBuyEnabled === 'boolean') {
      shouldBumpPublicCache = true;
      ops.push(this.prisma.systemConfig.upsert({ where: { key: SYSTEM_SETTING_KEYS.creditBuyEnabled }, create: { key: SYSTEM_SETTING_KEYS.creditBuyEnabled, value: input.creditBuyEnabled ? 'true' : 'false', description: 'Credit buy enabled' }, update: { value: input.creditBuyEnabled ? 'true' : 'false' } }));
    }
    if (typeof input.creditBuyRatePerYuan === 'number') {
      shouldBumpPublicCache = true;
      const v = String(Math.max(1, Math.trunc(input.creditBuyRatePerYuan)));
      ops.push(this.prisma.systemConfig.upsert({ where: { key: SYSTEM_SETTING_KEYS.creditBuyRatePerYuan }, create: { key: SYSTEM_SETTING_KEYS.creditBuyRatePerYuan, value: v, description: 'Credits per yuan' }, update: { value: v } }));
    }
    if (typeof input.creditBuyMinCredits === 'number') {
      shouldBumpPublicCache = true;
      const v = String(Math.max(1, Math.trunc(input.creditBuyMinCredits)));
      ops.push(this.prisma.systemConfig.upsert({ where: { key: SYSTEM_SETTING_KEYS.creditBuyMinCredits }, create: { key: SYSTEM_SETTING_KEYS.creditBuyMinCredits, value: v, description: 'Min credits to buy' }, update: { value: v } }));
    }
    if (typeof input.creditBuyMaxCredits === 'number') {
      shouldBumpPublicCache = true;
      const v = String(Math.max(1, Math.trunc(input.creditBuyMaxCredits)));
      ops.push(this.prisma.systemConfig.upsert({ where: { key: SYSTEM_SETTING_KEYS.creditBuyMaxCredits }, create: { key: SYSTEM_SETTING_KEYS.creditBuyMaxCredits, value: v, description: 'Max credits to buy' }, update: { value: v } }));
    }

    if (typeof input.chatFileUploadEnabled === 'boolean') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatFileUploadEnabled },
          create: { key: SYSTEM_SETTING_KEYS.chatFileUploadEnabled, value: input.chatFileUploadEnabled ? 'true' : 'false', description: 'Enable chat file upload' },
          update: { value: input.chatFileUploadEnabled ? 'true' : 'false' },
        }),
      );
    }
    if (typeof input.chatFileMaxFilesPerMessage === 'number') {
      shouldBumpPublicCache = true;
      const v = String(Math.max(1, Math.trunc(input.chatFileMaxFilesPerMessage)));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatFileMaxFilesPerMessage },
          create: { key: SYSTEM_SETTING_KEYS.chatFileMaxFilesPerMessage, value: v, description: 'Max uploaded files per chat message' },
          update: { value: v },
        }),
      );
    }
    if (typeof input.chatFileMaxFileSizeMb === 'number') {
      shouldBumpPublicCache = true;
      const v = String(Math.max(1, Math.trunc(input.chatFileMaxFileSizeMb)));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatFileMaxFileSizeMb },
          create: { key: SYSTEM_SETTING_KEYS.chatFileMaxFileSizeMb, value: v, description: 'Max chat upload file size MB' },
          update: { value: v },
        }),
      );
    }
    if (typeof input.chatFileAllowedExtensions === 'string') {
      shouldBumpPublicCache = true;
      const normalized = input.chatFileAllowedExtensions
        .split(',')
        .map((item) => item.trim().toLowerCase().replace(/^\./, ''))
        .filter((item) => item.length > 0)
        .join(',');
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatFileAllowedExtensions },
          create: { key: SYSTEM_SETTING_KEYS.chatFileAllowedExtensions, value: normalized, description: 'Allowed chat file extensions' },
          update: { value: normalized },
        }),
      );
    }
    if (typeof input.chatFileMaxExtractChars === 'number') {
      shouldBumpPublicCache = true;
      const v = String(Math.max(1000, Math.trunc(input.chatFileMaxExtractChars)));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatFileMaxExtractChars },
          create: { key: SYSTEM_SETTING_KEYS.chatFileMaxExtractChars, value: v, description: 'Max extracted chars per chat file' },
          update: { value: v },
        }),
      );
    }
    if (typeof input.chatFileContextMode === 'string') {
      shouldBumpPublicCache = true;
      const mode = input.chatFileContextMode.trim().toLowerCase() === 'full' ? 'full' : 'retrieval';
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatFileContextMode },
          create: { key: SYSTEM_SETTING_KEYS.chatFileContextMode, value: mode, description: 'Chat file context mode: full or retrieval' },
          update: { value: mode },
        }),
      );
    }
    if (typeof input.chatFileRetrievalTopK === 'number') {
      shouldBumpPublicCache = true;
      const v = String(Math.max(1, Math.trunc(input.chatFileRetrievalTopK)));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatFileRetrievalTopK },
          create: { key: SYSTEM_SETTING_KEYS.chatFileRetrievalTopK, value: v, description: 'Chat file retrieval top k chunks' },
          update: { value: v },
        }),
      );
    }
    if (typeof input.chatFileChunkSize === 'number') {
      shouldBumpPublicCache = true;
      const v = String(Math.max(200, Math.trunc(input.chatFileChunkSize)));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatFileChunkSize },
          create: { key: SYSTEM_SETTING_KEYS.chatFileChunkSize, value: v, description: 'Chat file chunk size' },
          update: { value: v },
        }),
      );
    }
    if (typeof input.chatFileChunkOverlap === 'number') {
      shouldBumpPublicCache = true;
      const v = String(Math.max(0, Math.trunc(input.chatFileChunkOverlap)));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatFileChunkOverlap },
          create: { key: SYSTEM_SETTING_KEYS.chatFileChunkOverlap, value: v, description: 'Chat file chunk overlap' },
          update: { value: v },
        }),
      );
    }
    if (typeof input.chatFileRetrievalMaxChars === 'number') {
      shouldBumpPublicCache = true;
      const v = String(Math.max(1000, Math.trunc(input.chatFileRetrievalMaxChars)));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.chatFileRetrievalMaxChars },
          create: { key: SYSTEM_SETTING_KEYS.chatFileRetrievalMaxChars, value: v, description: 'Max chars injected from chat file retrieval' },
          update: { value: v },
        }),
      );
    }
    if (typeof input.webSearchEnabled === 'boolean') {
      shouldBumpPublicCache = true;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.webSearchEnabled },
          create: {
            key: SYSTEM_SETTING_KEYS.webSearchEnabled,
            value: input.webSearchEnabled ? 'true' : 'false',
            description: 'Enable chat web search',
          },
          update: { value: input.webSearchEnabled ? 'true' : 'false' },
        }),
      );
    }
    if (typeof input.webSearchBaseUrl === 'string') {
      shouldBumpPublicCache = true;
      const value = input.webSearchBaseUrl.trim();
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.webSearchBaseUrl },
          create: { key: SYSTEM_SETTING_KEYS.webSearchBaseUrl, value, description: 'SearXNG base URL' },
          update: { value },
        }),
      );
    }
    if (typeof input.webSearchMode === 'string') {
      shouldBumpPublicCache = true;
      const raw = input.webSearchMode.trim().toLowerCase();
      const value = raw === 'always' ? 'always' : raw === 'auto' ? 'auto' : 'off';
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.webSearchMode },
          create: { key: SYSTEM_SETTING_KEYS.webSearchMode, value, description: 'Web search mode: off/manual/auto-trigger' },
          update: { value },
        }),
      );
    }
    if (typeof input.webSearchLanguage === 'string') {
      shouldBumpPublicCache = true;
      const value = input.webSearchLanguage.trim() || DEFAULT_PUBLIC_SETTINGS.webSearchLanguage;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.webSearchLanguage },
          create: { key: SYSTEM_SETTING_KEYS.webSearchLanguage, value, description: 'Web search language' },
          update: { value },
        }),
      );
    }
    if (typeof input.webSearchCategories === 'string') {
      shouldBumpPublicCache = true;
      const value = input.webSearchCategories.trim() || DEFAULT_PUBLIC_SETTINGS.webSearchCategories;
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.webSearchCategories },
          create: { key: SYSTEM_SETTING_KEYS.webSearchCategories, value, description: 'Web search categories' },
          update: { value },
        }),
      );
    }
    if (typeof input.webSearchSafeSearch === 'number') {
      shouldBumpPublicCache = true;
      const value = String(Math.max(0, Math.min(2, Math.trunc(input.webSearchSafeSearch))));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.webSearchSafeSearch },
          create: { key: SYSTEM_SETTING_KEYS.webSearchSafeSearch, value, description: 'Web search safe search level (0/1/2)' },
          update: { value },
        }),
      );
    }
    if (typeof input.webSearchTimeRange === 'string') {
      shouldBumpPublicCache = true;
      const raw = input.webSearchTimeRange.trim().toLowerCase();
      const allowed = new Set(['', 'day', 'week', 'month', 'year']);
      const value = allowed.has(raw) ? raw : '';
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.webSearchTimeRange },
          create: { key: SYSTEM_SETTING_KEYS.webSearchTimeRange, value, description: 'Web search time range' },
          update: { value },
        }),
      );
    }
    if (typeof input.webSearchTopK === 'number') {
      shouldBumpPublicCache = true;
      const value = String(Math.max(1, Math.min(20, Math.trunc(input.webSearchTopK))));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.webSearchTopK },
          create: { key: SYSTEM_SETTING_KEYS.webSearchTopK, value, description: 'Web search topK results to inject' },
          update: { value },
        }),
      );
    }
    if (typeof input.webSearchTimeoutMs === 'number') {
      shouldBumpPublicCache = true;
      const value = String(Math.max(1000, Math.min(30_000, Math.trunc(input.webSearchTimeoutMs))));
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.webSearchTimeoutMs },
          create: { key: SYSTEM_SETTING_KEYS.webSearchTimeoutMs, value, description: 'Web search timeout in milliseconds' },
          update: { value },
        }),
      );
    }
    if (typeof input.webSearchBlockedDomains === 'string') {
      shouldBumpPublicCache = true;
      const value = input.webSearchBlockedDomains
        .split(/[\n,;]+/)
        .map((item) => item.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, ''))
        .filter((item) => item.length > 0)
        .join(',');
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.webSearchBlockedDomains },
          create: { key: SYSTEM_SETTING_KEYS.webSearchBlockedDomains, value, description: 'Blocked web search domains (comma separated)' },
          update: { value },
        }),
      );
    }

    await Promise.all(ops);
    if (shouldBumpPublicCache) {
      await this.bumpCacheVersion(PUBLIC_SETTINGS_VERSION_KEY, 'setPublicSettings');
    }
    return this.getPublicSettings();
  }

  // ==================== 邮箱域名白名单相关方法 ====================

  async getEmailWhitelistSettings(): Promise<EmailWhitelistSettings> {
    return this.getVersionedCache(
      EMAIL_WHITELIST_SETTINGS_VERSION_KEY,
      EMAIL_WHITELIST_SETTINGS_DATA_KEY_PREFIX,
      async () => {
        const rows = await this.prisma.systemConfig.findMany({
          where: {
            key: {
              in: [...EMAIL_WHITELIST_SETTINGS_KEYS],
            },
          },
        });
        const map = toMap(rows);

        const enabled = parseBool(
          map.get(SYSTEM_SETTING_KEYS.emailDomainWhitelistEnabled) ?? null,
          DEFAULT_EMAIL_WHITELIST_SETTINGS.enabled,
        );

        const domainsStr = map.get(SYSTEM_SETTING_KEYS.emailDomainWhitelist) ?? '';
        const domains = domainsStr
          .split(',')
          .map((d) => d.trim().toLowerCase())
          .filter((d) => d.length > 0);

        return { enabled, domains };
      },
      'getEmailWhitelistSettings',
    );
  }

  async setEmailWhitelistSettings(input: Partial<EmailWhitelistSettings>): Promise<EmailWhitelistSettings> {
    const ops: Array<Promise<unknown>> = [];

    if (typeof input.enabled === 'boolean') {
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.emailDomainWhitelistEnabled },
          create: {
            key: SYSTEM_SETTING_KEYS.emailDomainWhitelistEnabled,
            value: input.enabled ? 'true' : 'false',
            description: 'Enable email domain whitelist',
          },
          update: { value: input.enabled ? 'true' : 'false' },
        }),
      );
    }

    if (Array.isArray(input.domains)) {
      const domainsStr = input.domains
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d.length > 0)
        .join(',');
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: SYSTEM_SETTING_KEYS.emailDomainWhitelist },
          create: {
            key: SYSTEM_SETTING_KEYS.emailDomainWhitelist,
            value: domainsStr,
            description: 'Allowed email domains (comma separated)',
          },
          update: { value: domainsStr },
        }),
      );
    }

    await Promise.all(ops);
    if (ops.length > 0) {
      await this.bumpCacheVersion(EMAIL_WHITELIST_SETTINGS_VERSION_KEY, 'setEmailWhitelistSettings');
    }
    return this.getEmailWhitelistSettings();
  }

  /**
   * 验证邮箱域名是否在白名单中
   * @param email 用户邮箱
   * @returns true 表示允许注册，false 表示不允许
   */
  async isEmailDomainAllowed(email: string): Promise<boolean> {
    const settings = await this.getEmailWhitelistSettings();

    // 如果未启用白名单，允许所有邮箱
    if (!settings.enabled) {
      return true;
    }

    // 如果白名单为空，允许所有邮箱
    if (settings.domains.length === 0) {
      return true;
    }

    // 提取邮箱域名
    const atIndex = email.lastIndexOf('@');
    if (atIndex === -1) {
      return false; // 无效邮箱格式
    }

    const domain = email.substring(atIndex + 1).toLowerCase();

    // 检查域名是否在白名单中
    return settings.domains.includes(domain);
  }

  // ==================== 微信支付配置 ====================

  async getWechatPaySettings(): Promise<WechatPaySettings> {
    return this.getVersionedCache(
      WECHAT_PAY_SETTINGS_VERSION_KEY,
      WECHAT_PAY_SETTINGS_DATA_KEY_PREFIX,
      async () => {
        const rows = await this.prisma.systemConfig.findMany({
          where: { key: { in: [...WECHAT_PAY_SETTINGS_KEYS] } },
        });
        const map = toMap(rows);
        return {
          enabled: parseBool(map.get(SYSTEM_SETTING_KEYS.wechatPayEnabled) ?? null, DEFAULT_WECHAT_PAY_SETTINGS.enabled),
          appId: map.get(SYSTEM_SETTING_KEYS.wechatPayAppId) ?? DEFAULT_WECHAT_PAY_SETTINGS.appId,
          mchId: map.get(SYSTEM_SETTING_KEYS.wechatPayMchId) ?? DEFAULT_WECHAT_PAY_SETTINGS.mchId,
          apiV3Key: map.get(SYSTEM_SETTING_KEYS.wechatPayApiV3Key) ?? DEFAULT_WECHAT_PAY_SETTINGS.apiV3Key,
          privateKey: map.get(SYSTEM_SETTING_KEYS.wechatPayPrivateKey) ?? DEFAULT_WECHAT_PAY_SETTINGS.privateKey,
          serialNo: map.get(SYSTEM_SETTING_KEYS.wechatPaySerialNo) ?? DEFAULT_WECHAT_PAY_SETTINGS.serialNo,
          notifyUrl: map.get(SYSTEM_SETTING_KEYS.wechatPayNotifyUrl) ?? DEFAULT_WECHAT_PAY_SETTINGS.notifyUrl,
        };
      },
      'getWechatPaySettings',
    );
  }

  async setWechatPaySettings(input: Partial<WechatPaySettings>): Promise<WechatPaySettings> {
    const ops: Array<Promise<any>> = [];
    const upsert = (key: string, value: string, desc: string) =>
      ops.push(this.prisma.systemConfig.upsert({ where: { key }, create: { key, value, description: desc }, update: { value, description: desc } }));

    if (typeof input.enabled === 'boolean') upsert(SYSTEM_SETTING_KEYS.wechatPayEnabled, input.enabled ? 'true' : 'false', 'WechatPay enabled');
    if (typeof input.appId === 'string') upsert(SYSTEM_SETTING_KEYS.wechatPayAppId, input.appId, 'WechatPay AppID');
    if (typeof input.mchId === 'string') upsert(SYSTEM_SETTING_KEYS.wechatPayMchId, input.mchId, 'WechatPay MchID');
    if (typeof input.apiV3Key === 'string') upsert(SYSTEM_SETTING_KEYS.wechatPayApiV3Key, input.apiV3Key, 'WechatPay APIv3 Key');
    if (typeof input.privateKey === 'string') upsert(SYSTEM_SETTING_KEYS.wechatPayPrivateKey, input.privateKey, 'WechatPay Private Key');
    if (typeof input.serialNo === 'string') upsert(SYSTEM_SETTING_KEYS.wechatPaySerialNo, input.serialNo, 'WechatPay Serial No');
    if (typeof input.notifyUrl === 'string') upsert(SYSTEM_SETTING_KEYS.wechatPayNotifyUrl, input.notifyUrl, 'WechatPay Notify URL');

    await Promise.all(ops);
    if (ops.length > 0) {
      await Promise.all([
        this.bumpCacheVersion(WECHAT_PAY_SETTINGS_VERSION_KEY, 'setWechatPaySettings'),
        this.bumpCacheVersion(PUBLIC_SETTINGS_VERSION_KEY, 'setWechatPaySettings'),
      ]);
    }
    return this.getWechatPaySettings();
  }

  private async getVersionedCache<T>(
    versionKey: string,
    dataKeyPrefix: string,
    loader: () => Promise<T>,
    label: string,
  ): Promise<T> {
    try {
      const version = (await this.redis.get(versionKey)) ?? '0';
      const dataKey = `${dataKeyPrefix}:${version}`;
      const cached = await this.redis.getJson<T>(dataKey);
      if (cached !== null) {
        return cached;
      }

      const fresh = await loader();
      await this.redis.setJson(dataKey, fresh, SETTINGS_CACHE_TTL_SECONDS);
      return fresh;
    } catch (error) {
      this.logger.warn(
        `[${label}] Redis cache unavailable, falling back to DB: ${error instanceof Error ? error.message : String(error)}`,
      );
      return loader();
    }
  }

  private async bumpCacheVersion(versionKey: string, label: string) {
    try {
      await this.redis.incr(versionKey);
    } catch (error) {
      this.logger.warn(
        `[${label}] Failed to bump Redis cache version: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
