import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { ExtraCreditsConfig } from './extra-credits-config.type';

/**
 * 额外积分配置类型
 * 支持基于分辨率、时长、尺寸等参数的额外积分配置。
 *
 * 兼容两种结构：
 * 1. 旧版单参数映射：
 * 例如:
 * {
 *   "resolution": { "4K": 5, "2K": 0, "1080p": 1, "720p": 0 },
 *   "duration": { "10": 1, "5": 0, "6": 0 },
 *   "size": { "1024x1024": 0, "1536x1024": 1 },
 *   "imageSize": { "4K": 5, "2K": 0 }
 * }
 *
 * 2. 新版多条件规则：
 * {
 *   "version": 2,
 *   "rules": [
 *     {
 *       "conditions": [
 *         { "parameter": "resolution", "value": "1080p" },
 *         { "parameter": "duration", "value": "5" }
 *       ],
 *       "credits": 5
 *     }
 *   ]
 * }
 */

export class CreateModelDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(100)
  modelKey!: string;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsString()
  @IsIn(['image', 'video', 'chat'])
  type!: 'image' | 'video' | 'chat';

  @IsString()
  @MaxLength(50)
  provider!: string;

  @IsString()
  channelId!: string;

  @IsInt()
  @Min(1)
  creditsPerUse!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  specialCreditsPerUse?: number | null;

  @IsOptional()
  @IsObject()
  extraCreditsConfig?: ExtraCreditsConfig;

  @IsOptional()
  @IsObject()
  defaultParams?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  paramConstraints?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  supportsImageInput?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsResolutionSelect?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsSizeSelect?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsQuickMode?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsAgentMode?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsAutoMode?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  freeUserDailyQuestionLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  memberDailyQuestionLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxContextRounds?: number | null;
}
