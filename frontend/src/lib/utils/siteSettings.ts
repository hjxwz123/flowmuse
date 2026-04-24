import type { SiteSettings } from '@/lib/api/types/site'

type PrimitiveSetting = string | number | boolean

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeBooleanValue(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value !== 'string') return fallback

  const normalized = value.trim().toLowerCase()
  if (!normalized) return fallback
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false
  return fallback
}

function normalizeNumberValue(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return fallback

  const normalized = value.trim()
  if (!normalized) return fallback
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  registrationEnabled: true,
  initialRegisterCredits: 10,
  inviteRegisterInviterCredits: 0,
  inviteRegisterInviteeCredits: 0,
  invitePaymentCreditsPerYuan: 1,
  siteTitle: '',
  siteIcon: '/logo.svg',
  siteFooter: '',
  homeTopMarqueeText: '',
  startupPopupType: 'image',
  startupPopupImageUrl: '',
  startupPopupHtml: '',
  startupPopupTargetUrl: '',
  startupPopupWidthPx: 720,
  startupPopupHeightPx: 0,
  cardPurchaseUrl: '',
  aboutUs: '',
  privacyPolicy: '',
  termsOfService: '',
  themeColor: '',
  turnstileEnabled: false,
  turnstileSiteKey: '',
  wechatPayEnabled: false,
  creditBuyEnabled: false,
  creditBuyRatePerYuan: 100,
  creditBuyMinCredits: 100,
  creditBuyMaxCredits: 100000,
  chatFileUploadEnabled: true,
  chatFileMaxFilesPerMessage: 5,
  chatFileMaxFileSizeMb: 20,
  chatFileAllowedExtensions: 'txt,md,csv,json,html,pdf,docx,pptx,xlsx',
  chatFileMaxExtractChars: 120000,
  chatFileContextMode: 'retrieval',
  chatFileRetrievalTopK: 6,
  chatFileChunkSize: 1200,
  chatFileChunkOverlap: 180,
  chatFileRetrievalMaxChars: 10000,
  webSearchEnabled: false,
  webSearchBaseUrl: '',
  webSearchMode: 'off',
  webSearchLanguage: 'zh-CN',
  webSearchCategories: 'general',
  webSearchSafeSearch: 1,
  webSearchTimeRange: '',
  webSearchTopK: 5,
  webSearchTimeoutMs: 8000,
  webSearchBlockedDomains: '',
}

export function trimSafeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeSiteSettings(value: unknown): SiteSettings {
  const source = isRecord(value) ? value : {}
  const defaults = DEFAULT_SITE_SETTINGS as unknown as Record<string, PrimitiveSetting>
  const normalized = { ...defaults }

  for (const key of Object.keys(defaults)) {
    const fallbackValue = defaults[key]
    const nextValue = source[key]

    if (typeof fallbackValue === 'string') {
      normalized[key] = typeof nextValue === 'string' ? nextValue : fallbackValue
      continue
    }

    if (typeof fallbackValue === 'number') {
      normalized[key] = normalizeNumberValue(nextValue, fallbackValue)
      continue
    }

    normalized[key] = normalizeBooleanValue(nextValue, fallbackValue)
  }

  const result = normalized as unknown as SiteSettings

  if (result.startupPopupType !== 'image' && result.startupPopupType !== 'html') {
    result.startupPopupType = DEFAULT_SITE_SETTINGS.startupPopupType
  }

  if (result.chatFileContextMode !== 'full' && result.chatFileContextMode !== 'retrieval') {
    result.chatFileContextMode = DEFAULT_SITE_SETTINGS.chatFileContextMode
  }

  if (!['off', 'auto', 'always'].includes(result.webSearchMode)) {
    result.webSearchMode = DEFAULT_SITE_SETTINGS.webSearchMode
  }

  if (!['', 'day', 'week', 'month', 'year'].includes(result.webSearchTimeRange)) {
    result.webSearchTimeRange = DEFAULT_SITE_SETTINGS.webSearchTimeRange
  }

  return result
}
