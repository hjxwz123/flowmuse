import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

class SendMessageMediaAgentDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  modelId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  preferredAspectRatio?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  referenceImages?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  referenceVideos?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  referenceAudios?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  preferredResolution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  preferredDuration?: string;

  @IsOptional()
  @IsBoolean()
  autoCreate?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  generationCount?: number;
}

class SendMessageAutoProjectAgentDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsString()
  imageModelId!: string;

  @IsString()
  videoModelId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  preferredResolution?: string;

  @IsOptional()
  @IsBoolean()
  createProjectIfMissing?: boolean;
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  fileIds?: string[];

  @IsOptional()
  @IsBoolean()
  webSearch?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SendMessageMediaAgentDto)
  mediaAgent?: SendMessageMediaAgentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SendMessageMediaAgentDto)
  imageAgent?: SendMessageMediaAgentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SendMessageAutoProjectAgentDto)
  autoProjectAgent?: SendMessageAutoProjectAgentDto;
}
