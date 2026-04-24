import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class ChatModerationAutoBanRuleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  triggerCount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  banDays!: number;
}

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsString()
  apiBaseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  webSearchTaskModelName?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditsCost?: number;

  @IsOptional()
  @IsBoolean()
  chatModerationEnabled?: boolean;

  @IsOptional()
  @IsString()
  chatModerationApiBaseUrl?: string;

  @IsOptional()
  @IsString()
  chatModerationApiKey?: string;

  @IsOptional()
  @IsString()
  chatModerationModelName?: string;

  @IsOptional()
  @IsString()
  chatModerationSystemPrompt?: string;

  @IsOptional()
  @IsBoolean()
  chatModerationAutoBanEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatModerationAutoBanRuleDto)
  chatModerationAutoBanRules?: ChatModerationAutoBanRuleDto[];
}
