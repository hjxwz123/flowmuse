import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProviderDto {
  @IsString()
  @MaxLength(50)
  provider!: string;

  @IsString()
  @MaxLength(100)
  displayName!: string;

  @IsString()
  @MaxLength(200)
  adapterClass!: string;

  // 兼容旧前端缓存请求：允许携带 icon 字段，但后端不再使用该字段存储图标
  @IsOptional()
  @IsString()
  icon?: string;

  @IsArray()
  supportTypes!: Array<'image' | 'video'>;

  @IsOptional()
  defaultParams?: Record<string, unknown>;

  @IsOptional()
  paramSchema?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  webhookRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  sortOrder?: number;
}
