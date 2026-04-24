import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum AiModelType {
  image = 'image',
  video = 'video',
}

export class QueryToolsDto {
  @IsOptional()
  @IsEnum(AiModelType)
  type?: AiModelType;

  @IsOptional()
  @IsString()
  category?: string;
}
