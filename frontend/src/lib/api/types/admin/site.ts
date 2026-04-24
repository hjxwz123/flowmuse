/**
 * 管理员 - 站点设置类型定义
 * 基于 docs/api/admin/12-site.md
 */

// 站点设置（与公开 API 相同）
export interface SiteSettings {
  registrationEnabled: boolean
  initialRegisterCredits: number
  inviteRegisterInviterCredits: number
  inviteRegisterInviteeCredits: number
  invitePaymentCreditsPerYuan: number
  siteTitle: string
  siteIcon: string
  siteFooter: string
  homeTopMarqueeText: string
  startupPopupType: 'image' | 'html'
  startupPopupImageUrl: string
  startupPopupHtml: string
  startupPopupTargetUrl: string
  startupPopupWidthPx: number
  startupPopupHeightPx: number
  cardPurchaseUrl: string // 卡密购买链接
  aboutUs: string // 关于我们
  privacyPolicy: string // 隐私政策
  termsOfService: string // 使用条款
  themeColor: string // 主题色
  turnstileEnabled: boolean
  turnstileSiteKey: string
  turnstileSecretKey: string
  wechatPayEnabled: boolean // 微信支付是否启用
  creditBuyEnabled: boolean
  creditBuyRatePerYuan: number
  creditBuyMinCredits: number
  creditBuyMaxCredits: number
  chatFileUploadEnabled: boolean
  chatFileMaxFilesPerMessage: number
  chatFileMaxFileSizeMb: number
  chatFileAllowedExtensions: string
  chatFileMaxExtractChars: number
  chatFileContextMode: 'full' | 'retrieval'
  chatFileRetrievalTopK: number
  chatFileChunkSize: number
  chatFileChunkOverlap: number
  chatFileRetrievalMaxChars: number
  webSearchEnabled: boolean
  webSearchBaseUrl: string
  webSearchMode: 'off' | 'auto' | 'always'
  webSearchLanguage: string
  webSearchCategories: string
  webSearchSafeSearch: number
  webSearchTimeRange: '' | 'day' | 'week' | 'month' | 'year'
  webSearchTopK: number
  webSearchTimeoutMs: number
  webSearchBlockedDomains: string
}

// 更新站点设置请求（所有字段可选）
export interface UpdateSiteSettingsRequest {
  registrationEnabled?: boolean
  initialRegisterCredits?: number
  inviteRegisterInviterCredits?: number
  inviteRegisterInviteeCredits?: number
  invitePaymentCreditsPerYuan?: number
  siteTitle?: string
  siteIcon?: string
  siteFooter?: string
  homeTopMarqueeText?: string
  startupPopupType?: 'image' | 'html'
  startupPopupImageUrl?: string
  startupPopupHtml?: string
  startupPopupTargetUrl?: string
  startupPopupWidthPx?: number
  startupPopupHeightPx?: number
  cardPurchaseUrl?: string // 卡密购买链接
  aboutUs?: string // 关于我们
  privacyPolicy?: string // 隐私政策
  termsOfService?: string // 使用条款
  themeColor?: string // 主题色
  turnstileEnabled?: boolean
  turnstileSiteKey?: string
  turnstileSecretKey?: string
  wechatPayEnabled?: boolean
  creditBuyEnabled?: boolean
  creditBuyRatePerYuan?: number
  creditBuyMinCredits?: number
  creditBuyMaxCredits?: number
  chatFileUploadEnabled?: boolean
  chatFileMaxFilesPerMessage?: number
  chatFileMaxFileSizeMb?: number
  chatFileAllowedExtensions?: string
  chatFileMaxExtractChars?: number
  chatFileContextMode?: 'full' | 'retrieval'
  chatFileRetrievalTopK?: number
  chatFileChunkSize?: number
  chatFileChunkOverlap?: number
  chatFileRetrievalMaxChars?: number
  webSearchEnabled?: boolean
  webSearchBaseUrl?: string
  webSearchMode?: 'off' | 'auto' | 'always'
  webSearchLanguage?: string
  webSearchCategories?: string
  webSearchSafeSearch?: number
  webSearchTimeRange?: '' | 'day' | 'week' | 'month' | 'year'
  webSearchTopK?: number
  webSearchTimeoutMs?: number
  webSearchBlockedDomains?: string
}

// 邮箱域名白名单设置
export interface EmailWhitelistSettings {
  enabled: boolean // 是否启用白名单
  domains: string[] // 白名单域名列表
}

// 更新邮箱域名白名单请求
export interface UpdateEmailWhitelistRequest {
  enabled?: boolean
  domains?: string[]
}
