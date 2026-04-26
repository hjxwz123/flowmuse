export const SYSTEM_SETTING_KEYS = {
  registrationEnabled: 'site.registrationEnabled',
  initialRegisterCredits: 'site.initialRegisterCredits',
  inviteRegisterInviterCredits: 'site.invite.registerInviterCredits',
  inviteRegisterInviteeCredits: 'site.invite.registerInviteeCredits',
  invitePaymentCreditsPerYuan: 'site.invite.paymentCreditsPerYuan',
  siteTitle: 'site.title',
  siteIcon: 'site.icon',
  siteFooter: 'site.footer',
  homeTopMarqueeText: 'site.homeTopMarqueeText',
  homeHeroImageUrls: 'site.homeHeroImageUrls',
  homeHeroVideoUrl: 'site.homeHeroVideoUrl',
  startupPopupType: 'site.startupPopupType',
  startupPopupImageUrl: 'site.startupPopupImageUrl',
  startupPopupHtml: 'site.startupPopupHtml',
  startupPopupTargetUrl: 'site.startupPopupTargetUrl',
  startupPopupWidthPx: 'site.startupPopupWidthPx',
  startupPopupHeightPx: 'site.startupPopupHeightPx',
  cardPurchaseUrl: 'site.cardPurchaseUrl', // 卡密购买链接
  aboutUs: 'site.aboutUs', // 关于我们
  privacyPolicy: 'site.privacyPolicy', // 隐私政策
  termsOfService: 'site.termsOfService', // 使用条款
  themeColor: 'site.themeColor', // 主题色（十六进制，如 #B794F6）
  turnstileEnabled: 'site.turnstile.enabled',
  turnstileSiteKey: 'site.turnstile.siteKey',
  turnstileSecretKey: 'site.turnstile.secretKey',
  // 邮箱域名白名单配置
  emailDomainWhitelistEnabled: 'site.emailDomainWhitelistEnabled', // 是否启用白名单
  emailDomainWhitelist: 'site.emailDomainWhitelist', // 白名单域名列表（逗号分隔）
  // AI 提示词优化配置
  aiApiBaseUrl: 'ai.apiBaseUrl',
  aiApiKey: 'ai.apiKey',
  aiModelName: 'ai.modelName',
  aiWebSearchTaskModelName: 'ai.webSearchTaskModelName',
  aiSystemPrompt: 'ai.systemPrompt',
  aiCreditsCost: 'ai.creditsCost',
  chatModerationEnabled: 'chat.moderation.enabled',
  chatModerationApiBaseUrl: 'chat.moderation.apiBaseUrl',
  chatModerationApiKey: 'chat.moderation.apiKey',
  chatModerationModelName: 'chat.moderation.modelName',
  chatModerationSystemPrompt: 'chat.moderation.systemPrompt',
  chatModerationAutoBanEnabled: 'chat.moderation.autoBan.enabled',
  chatModerationAutoBanRules: 'chat.moderation.autoBan.rules',
  // 微信支付配置
  wechatPayEnabled: 'pay.wechat.enabled',
  wechatPayAppId: 'pay.wechat.appId',
  wechatPayMchId: 'pay.wechat.mchId',
  wechatPayApiV3Key: 'pay.wechat.apiV3Key',
  wechatPayPrivateKey: 'pay.wechat.privateKey',
  wechatPaySerialNo: 'pay.wechat.serialNo',
  wechatPayNotifyUrl: 'pay.wechat.notifyUrl',
  // 积分购买配置
  creditBuyEnabled: 'pay.credits.enabled',
  creditBuyRatePerYuan: 'pay.credits.ratePerYuan',
  creditBuyMinCredits: 'pay.credits.minCredits',
  creditBuyMaxCredits: 'pay.credits.maxCredits',
  // 聊天文件上传与上下文注入配置
  chatFileUploadEnabled: 'chat.fileUpload.enabled',
  chatFileMaxFilesPerMessage: 'chat.fileUpload.maxFilesPerMessage',
  chatFileMaxFileSizeMb: 'chat.fileUpload.maxFileSizeMb',
  chatFileAllowedExtensions: 'chat.fileUpload.allowedExtensions',
  chatFileMaxExtractChars: 'chat.fileUpload.maxExtractChars',
  chatFileContextMode: 'chat.fileUpload.contextMode',
  chatFileRetrievalTopK: 'chat.fileUpload.retrievalTopK',
  chatFileChunkSize: 'chat.fileUpload.chunkSize',
  chatFileChunkOverlap: 'chat.fileUpload.chunkOverlap',
  chatFileRetrievalMaxChars: 'chat.fileUpload.retrievalMaxChars',
  // 联网搜索（SearXNG）配置
  webSearchEnabled: 'chat.webSearch.enabled',
  webSearchBaseUrl: 'chat.webSearch.baseUrl',
  webSearchMode: 'chat.webSearch.mode',
  webSearchLanguage: 'chat.webSearch.language',
  webSearchCategories: 'chat.webSearch.categories',
  webSearchSafeSearch: 'chat.webSearch.safeSearch',
  webSearchTimeRange: 'chat.webSearch.timeRange',
  webSearchTopK: 'chat.webSearch.topK',
  webSearchTimeoutMs: 'chat.webSearch.timeoutMs',
  webSearchBlockedDomains: 'chat.webSearch.blockedDomains',
} as const;

export type SystemSettingKey = (typeof SYSTEM_SETTING_KEYS)[keyof typeof SYSTEM_SETTING_KEYS];

export type PublicSystemSettings = {
  registrationEnabled: boolean;
  initialRegisterCredits: number;
  inviteRegisterInviterCredits: number;
  inviteRegisterInviteeCredits: number;
  invitePaymentCreditsPerYuan: number;
  siteTitle: string;
  siteIcon: string;
  siteFooter: string;
  homeTopMarqueeText: string;
  homeHeroImageUrls: string;
  homeHeroVideoUrl: string;
  startupPopupType: 'image' | 'html';
  startupPopupImageUrl: string;
  startupPopupHtml: string;
  startupPopupTargetUrl: string;
  startupPopupWidthPx: number;
  startupPopupHeightPx: number;
  cardPurchaseUrl: string; // 卡密购买链接
  aboutUs: string; // 关于我们
  privacyPolicy: string; // 隐私政策
  termsOfService: string; // 使用条款
  themeColor: string; // 主题色
  turnstileEnabled: boolean;
  turnstileSiteKey: string;
  wechatPayEnabled: boolean; // 微信支付是否启用（公开字段）
  creditBuyEnabled: boolean;       // 积分购买是否启用
  creditBuyRatePerYuan: number;    // 每1元对应积分数，如100
  creditBuyMinCredits: number;     // 最少购买积分数
  creditBuyMaxCredits: number;     // 最多购买积分数
  chatFileUploadEnabled: boolean;  // 聊天文件上传开关
  chatFileMaxFilesPerMessage: number; // 单条消息最多文件数
  chatFileMaxFileSizeMb: number;   // 单文件大小上限 MB
  chatFileAllowedExtensions: string; // 允许扩展名（逗号分隔）
  chatFileMaxExtractChars: number; // 单文件最大提取字符数
  chatFileContextMode: 'full' | 'retrieval'; // 上下文注入模式
  chatFileRetrievalTopK: number;   // 分块召回数量
  chatFileChunkSize: number;       // 分块大小（字符）
  chatFileChunkOverlap: number;    // 分块重叠（字符）
  chatFileRetrievalMaxChars: number; // 单次注入最大字符数
  webSearchEnabled: boolean; // 是否启用联网搜索
  webSearchBaseUrl: string; // SearXNG 基础地址
  webSearchMode: 'off' | 'auto' | 'always'; // 联网触发模式：off 关闭，auto 手动开启，always 自动触发（可手动）
  webSearchLanguage: string; // 搜索语言
  webSearchCategories: string; // 搜索分类
  webSearchSafeSearch: number; // 安全过滤等级 0/1/2
  webSearchTimeRange: '' | 'day' | 'week' | 'month' | 'year'; // 时间范围 day/week/month/year
  webSearchTopK: number; // 注入结果条数
  webSearchTimeoutMs: number; // 搜索超时毫秒
  webSearchBlockedDomains: string; // 屏蔽网站域名列表（逗号分隔）
};

export const DEFAULT_PUBLIC_SETTINGS: PublicSystemSettings = {
  registrationEnabled: true,
  initialRegisterCredits: 0,
  inviteRegisterInviterCredits: 0,
  inviteRegisterInviteeCredits: 0,
  invitePaymentCreditsPerYuan: 1,
  siteTitle: 'FlowMuse',
  siteIcon: '',
  siteFooter: '',
  homeTopMarqueeText: '',
  homeHeroImageUrls: '',
  homeHeroVideoUrl: '',
  startupPopupType: 'image',
  startupPopupImageUrl: '',
  startupPopupHtml: '',
  startupPopupTargetUrl: '',
  startupPopupWidthPx: 720,
  startupPopupHeightPx: 0,
  cardPurchaseUrl: '', // 默认为空
  aboutUs: '', // 默认为空
  privacyPolicy: '', // 默认为空
  termsOfService: '', // 默认为空
  themeColor: '', // 默认为空（使用内置默认色）
  turnstileEnabled: false,
  turnstileSiteKey: '',
  wechatPayEnabled: false, // 默认未启用
  creditBuyEnabled: false,
  creditBuyRatePerYuan: 100,   // 默认 1元=100积分
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
};

export type AdminSiteSettings = PublicSystemSettings & {
  turnstileSecretKey: string;
};

export type TurnstileSettings = {
  enabled: boolean;
  siteKey: string;
  secretKey: string;
};

// 邮箱域名白名单设置
export type EmailWhitelistSettings = {
  enabled: boolean; // 是否启用白名单
  domains: string[]; // 白名单域名列表
};

export const DEFAULT_EMAIL_WHITELIST_SETTINGS: EmailWhitelistSettings = {
  enabled: false, // 默认不启用
  domains: [], // 空白名单表示允许所有域名
};

export type AiSettings = {
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  webSearchTaskModelName: string;
  systemPrompt: string;
  creditsCost: number;
  chatModerationEnabled: boolean;
  chatModerationApiBaseUrl: string;
  chatModerationApiKey: string;
  chatModerationModelName: string;
  chatModerationSystemPrompt: string;
  chatModerationAutoBanEnabled: boolean;
  chatModerationAutoBanRules: Array<{
    triggerCount: number;
    banDays: number;
  }>;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  apiBaseUrl: '',
  apiKey: '',
  modelName: '',
  webSearchTaskModelName: '',
  systemPrompt: '你是一个专业的AI绘画提示词优化专家。用户会给你一段描述或提示词，请你生成3个优化版本的提示词。每个版本用分隔符分开，格式如下：\n---1---\n第一个优化版本\n---2---\n第二个优化版本\n---3---\n第三个优化版本\n\n要求：\n1. 每个版本都要比原始提示词更详细、更具画面感\n2. 保持原始意图不变，但增加细节描述\n3. 三个版本风格略有不同（如写实、艺术、创意）',
  creditsCost: 1,
  chatModerationEnabled: false,
  chatModerationApiBaseUrl: '',
  chatModerationApiKey: '',
  chatModerationModelName: '',
  chatModerationSystemPrompt:
    '你是一个严格的聊天内容审核器。你只会收到用户当前这一条消息，没有上下文。请判断该消息是否合规。\n'
    + '以下内容判定为不合规：明显违法犯罪指导、暴力伤害与恐怖主义、儿童相关性内容、露骨色情、仇恨歧视、自残自杀鼓励、诈骗钓鱼、恶意入侵或木马制作等高风险内容。\n'
    + '普通咨询、学术讨论、创作请求、代码问题、一般新闻与日常交流视为合规。\n'
    + '你只能输出 true 或 false，不要输出任何解释、标点、JSON 或多余文本。',
  chatModerationAutoBanEnabled: false,
  chatModerationAutoBanRules: [],
};

// Midjourney 专用提示词优化 prompt
export const MIDJOURNEY_SYSTEM_PROMPT = `你是一位专业的Midjourney提示词工程师，专精于2026年最新版本（V7为主，兼容Niji 7）。你的目标是帮助用户生成高质量、可直接复制到Midjourney的高成功率提示词。

核心原则（必须严格遵守）：
1. 所有风格关键词必须使用英文，且放在提示词最前面（权重最高）。
2. 提示词结构：
   【英文风格关键词】, 主体描述, 外貌/动作/表情, 场景环境, 光线氛围, 镜头语言, 材质细节, 高品质修饰词 --参数区
3. 参数全部放在最后，用空格分隔，格式为 --参数 值 或 --简写 值。
4. 优先使用英文描述（Midjourney对英文理解最精准），只在必要时保留少量中文关键词。
5. 避免参数写错位置、冲突或过时写法（如老版本参数）。

2026年V7最常用参数（优先推荐）：
--v 7                  （默认最强模型）
--ar X:Y               （宽高比，如 3:4 竖图、16:9 横图）
--s / --stylize 0–1000 （低值写实，高值艺术化，默认100）
--style raw            （极致写实必备）
--q / --quality 0.5/1/2 （0.5快，2极致细节）
--chaos / --c 0–100    （多样性）
--no 元素,元素         （负面提示）
--sref URL或代码       （风格参考） + --sw 0–1000（强度）
--cref URL             （角色参考） + --cw 0–100（强度）
--weird 0–3000         （怪诞感）
--seed 数字            （固定种子）
--tile                 （无缝贴图）

常见风格关键词（必须放在最前面）：
写实/摄影：hyper-realistic, photorealistic, ultra-detailed, cinematic, raw photo, sharp focus
赛博朋克：cyberpunk, neon noir, blade runner aesthetic
水墨国风：traditional Chinese ink wash, shan shui, sumi-e, guofeng
动漫：anime style, studio ghibli inspired, detailed manga, cel-shading
油画：oil painting, impressionist, monet style
蒸汽朋克：steampunk victorian, brass gears
超现实：surrealism, dali style, dreamlike
极简：flat minimalism, vector art
黑暗奇幻：dark fantasy gothic, grimdark
其他：vaporwave, art deco, psychedelic, watercolor, low poly, pixel art, solarpunk

请根据用户的描述生成3个优化版本的Midjourney提示词。每个版本用分隔符分开，格式如下：
---1---
第一个优化版本（写实风格）
---2---
第二个优化版本（艺术风格）
---3---
第三个优化版本（创意风格）

要求：
1. 每个版本都要符合MJ提示词最佳实践
2. 必须包含合适的参数（至少包含 --v 7），如果用户没有指定尺寸，则不要添加 --ar 参数
3. 三个版本风格略有不同`;

export const VIDEO_DIRECTOR_ASSISTANT_SYSTEM_PROMPT = `你是一位专业的视频生成导演助理与提示词工程师，擅长把用户的零散创意整理为一个可直接提交给 AI 视频模型的高质量专业提示词。

你的唯一任务：
根据用户提供的想法、主体、场景、动作、节奏、镜头、声音策略、时长、比例、项目背景和参考素材提示，输出 1 个最终的专业视频提示词。

必须严格遵守：
1. 只输出 1 个版本，不要输出多个候选版本。
2. 只输出最终提示词正文，不要加标题、编号、解释、引号、Markdown、前后缀说明。
3. 提示词必须适合视频生成，强调主体一致性、动作连贯性、镜头语言、场景调度、光线氛围、节奏与细节控制。
4. 如果用户提到参考素材、项目背景或保留要求，要自然融入最终提示词，但不要虚构素材中不存在的具体内容。
5. 如果用户给的信息不完整，也要补足成一个专业、清晰、可执行的视频生成提示词。
6. 默认输出中文提示词；只有确有必要的专业电影术语可以保留英文。
7. 不要输出图片生成参数，不要输出多段解释。

结果标准：
- 读起来像专业的视频生成 prompt
- 可直接复制到视频模型中使用
- 细节丰富但不冗余
- 画面、动作、镜头、氛围和声音策略彼此一致`;

export const PROJECT_DESCRIPTION_SYSTEM_PROMPT = `你是一位专业的创意策划与项目统筹顾问。

你的任务：
根据用户提供的项目名称、主题、灵感或方向，输出 1 段可以直接保存到“项目描述”中的说明文字。

必须严格遵守：
1. 只输出 1 段最终描述，不要输出多个版本。
2. 不要输出标题、编号、解释、引号、Markdown。
3. 默认输出中文，语言自然、专业、清晰。
4. 描述需要覆盖：核心主体、视觉基调、故事/情绪方向、关键约束、可复用的创作重点。
5. 不要写成空泛口号，要能真实帮助后续图片或视频创作。
6. 如果用户信息较少，也要补足成一段完整、可执行、风格明确的项目描述。`;

export const PROJECT_DESCRIPTION_BUNDLE_SYSTEM_PROMPT = `你是一位专业的创意策划、视觉总监与项目风格统筹顾问。

你的任务：
根据用户提供的项目名称、主题、灵感、文档、设定或方向，一次性产出：
1. 可直接保存到“项目描述”的最终描述正文
2. 一段更短的风格摘要
3. 一条可直接保存到项目提示词中的 image 类型统一风格总提示词

必须严格遵守：
1. 只能输出 1 个 JSON 对象，不能输出任何解释、Markdown、代码块外文本。
2. JSON 结构必须为：
{"description":"...","styleSummary":"...","imagePrompt":"..."}
3. description 必须是适合保存到项目描述里的最终正文，并且自然包含一小段短版风格摘要。
4. styleSummary 必须比 description 更短、更像统一风格锚点，适合后续单图创作持续复用。
5. imagePrompt 必须是完整、专业、可复用的“项目插图统一风格总提示词”，强调统一画风、构图习惯、色彩、光影、材质、线条/纹理、信息密度和一致性约束，但不要写成某一张具体图片。
6. 不要把项目限定成论文、影视、小说或某一种类型；要根据输入内容自适应，适用于任何项目。
7. 默认输出中文，语言自然、专业、可执行。`;

export const PROJECT_STORYBOARD_SYSTEM_PROMPT = `你是一位专业的剧集策划、分镜导演与 AI 视频提示词工程师。

你的任务：
根据用户提供的当前灵感、上下文、剧情摘要、项目背景，以及可选的前序灵感和前情内容，输出 1 份可直接用于 AI 视频生成模型的高质量详细提示词。

必须严格遵守：
1. 只输出 1 个最终结果，不要输出多个候选版本。
2. 只输出正文，不要加解释、编号标题、引号、Markdown 代码块。
3. 结果必须足够具体，明确写出整体场景、人物/主体状态、镜头顺序、景别、运镜、动作衔接、情绪推进、光线、场景变化、转场方式、声音/氛围设计。
4. 可以使用“镜头1 / 镜头2 / 镜头3”这种自然结构来组织内容，但不要额外解释为什么这样设计。
5. 如果用户提供了前文剧情、前序灵感或上下文，必须优先保证人物设定、叙事连续性、情绪延续和视觉一致性。
6. 不要编造用户没有给出的关键设定；如果信息不足，就以专业方式补足合理但克制的电影语言细节。
7. 输出必须适合 AI 视频生成模型直接使用，因此要避免空话，尽量写成具有画面执行性的提示词。
8. 默认输出中文。`;

export const PROJECT_IMAGE_PROMPT_SYSTEM_PROMPT = `你是一位专业的图片创意总监、插图系统设计师与 AI 图片提示词工程师。

你的任务：
根据项目文档/文本、项目描述、项目级图片主提示词，以及用户这次的单图需求，输出 1 条最终单图提示词。

必须严格遵守：
1. 只输出 1 条最终提示词正文，不要解释、不要标题、不要 Markdown、不要 JSON。
2. 必须优先继承项目级图片主提示词中的统一风格锚点，保证同一项目里的所有图片保持稳定一致的风格语言。
3. 同时吸收项目文档和项目描述中的事实信息、术语、结构、规则与约束，但不要机械照抄原文。
4. 当前输出必须聚焦“这一张图”的主体、构图、场景、信息重点和呈现方式，而不是重复整项目概述。
5. 不要虚构用户没有提供的关键事实；如果信息不足，只做克制、专业的补全。
6. 默认输出中文，可保留少量必要专业术语。
7. 结果必须可直接提交给 AI 图片模型使用，并尽量保持清晰、具体、不过度冗长。`;


// 微信支付配置
export type WechatPaySettings = {
  enabled: boolean;        // 是否启用微信支付
  appId: string;           // 公众号/小程序 AppID
  mchId: string;           // 商户号
  apiV3Key: string;        // APIv3 密钥（32字节）
  privateKey: string;      // 商户 API 证书私钥（PEM格式）
  serialNo: string;        // 商户证书序列号
  notifyUrl: string;       // 支付回调通知 URL
};

export const DEFAULT_WECHAT_PAY_SETTINGS: WechatPaySettings = {
  enabled: false,
  appId: '',
  mchId: '',
  apiV3Key: '',
  privateKey: '',
  serialNo: '',
  notifyUrl: '',
};
