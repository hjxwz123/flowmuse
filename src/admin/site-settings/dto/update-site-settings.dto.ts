import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateSiteSettingsDto {
  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  initialRegisterCredits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  inviteRegisterInviterCredits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  inviteRegisterInviteeCredits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1_000_000)
  invitePaymentCreditsPerYuan?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  siteTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  siteIcon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  siteFooter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  homeTopMarqueeText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  homeHeroImageUrls?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  homeHeroVideoUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(['image', 'html'])
  startupPopupType?: 'image' | 'html';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  startupPopupImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  startupPopupTargetUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  startupPopupHtml?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(240)
  @Max(2000)
  startupPopupWidthPx?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2000)
  startupPopupHeightPx?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cardPurchaseUrl?: string; // 卡密购买链接

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  aboutUs?: string; // 关于我们

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  privacyPolicy?: string; // 隐私政策

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  termsOfService?: string; // 使用条款

  @IsOptional()
  @IsString()
  @MaxLength(20)
  themeColor?: string; // 主题色（十六进制，如 #B794F6）

  @IsOptional()
  @IsBoolean()
  turnstileEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  turnstileSiteKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  turnstileSecretKey?: string;

  @IsOptional()
  @IsBoolean()
  wechatPayEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  creditBuyEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  creditBuyRatePerYuan?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  creditBuyMinCredits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  creditBuyMaxCredits?: number;

  @IsOptional()
  @IsBoolean()
  chatFileUploadEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  chatFileMaxFilesPerMessage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  chatFileMaxFileSizeMb?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  chatFileAllowedExtensions?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(2_000_000)
  chatFileMaxExtractChars?: number;

  @IsOptional()
  @IsString()
  @IsIn(['full', 'retrieval'])
  chatFileContextMode?: 'full' | 'retrieval';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  chatFileRetrievalTopK?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(10_000)
  chatFileChunkSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5_000)
  chatFileChunkOverlap?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(200_000)
  chatFileRetrievalMaxChars?: number;

  @IsOptional()
  @IsBoolean()
  webSearchEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  webSearchBaseUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(['off', 'auto', 'always'])
  webSearchMode?: 'off' | 'auto' | 'always';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  webSearchLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  webSearchCategories?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2)
  webSearchSafeSearch?: number;

  @IsOptional()
  @IsString()
  @IsIn(['', 'day', 'week', 'month', 'year'])
  webSearchTimeRange?: '' | 'day' | 'week' | 'month' | 'year';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  webSearchTopK?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(30000)
  webSearchTimeoutMs?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  webSearchBlockedDomains?: string;
}
