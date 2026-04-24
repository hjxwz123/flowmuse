/**
 * 站点设置类型定义
 * 基于 docs/api/13-site.md
 */

// 站点设置
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
  homeHeroImageUrls: string
  homeHeroVideoUrl: string
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
  themeColor: string // 主题色（十六进制，空字符串表示使用默认）
  turnstileEnabled: boolean // 是否启用 Cloudflare Turnstile
  turnstileSiteKey: string // Cloudflare Turnstile Site Key
  wechatPayEnabled: boolean // 微信支付是否启用
  creditBuyEnabled: boolean // 积分购买是否启用
  creditBuyRatePerYuan: number // 每1元对应积分数
  creditBuyMinCredits: number // 最少购买积分数
  creditBuyMaxCredits: number // 最多购买积分数
  chatFileUploadEnabled: boolean // 聊天文件上传开关
  chatFileMaxFilesPerMessage: number // 单条消息最多文件数
  chatFileMaxFileSizeMb: number // 单文件大小上限 MB
  chatFileAllowedExtensions: string // 允许扩展名（逗号分隔）
  chatFileMaxExtractChars: number // 单文件提取字符上限
  chatFileContextMode: 'full' | 'retrieval' // 上下文注入模式
  chatFileRetrievalTopK: number // 分块召回数量
  chatFileChunkSize: number // 分块大小
  chatFileChunkOverlap: number // 分块重叠
  chatFileRetrievalMaxChars: number // 单次注入字符上限
  webSearchEnabled: boolean // 是否启用联网搜索
  webSearchBaseUrl: string // SearXNG 地址
  webSearchMode: 'off' | 'auto' | 'always' // 联网模式
  webSearchLanguage: string // 搜索语言
  webSearchCategories: string // 搜索分类
  webSearchSafeSearch: number // 安全过滤等级 0/1/2
  webSearchTimeRange: '' | 'day' | 'week' | 'month' | 'year' // 时间范围
  webSearchTopK: number // 注入条数
  webSearchTimeoutMs: number // 搜索超时
  webSearchBlockedDomains: string // 屏蔽网站域名（逗号分隔）
}
