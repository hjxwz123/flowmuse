import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum AiModelType {
  image = 'image',
  video = 'video',
}

export class CreateToolDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;

  @IsString()
  @MinLength(1)
  prompt!: string;

  @IsEnum(AiModelType)
  type!: AiModelType;

  @IsString()
  modelId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  imageCount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageLabels?: string[];

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
