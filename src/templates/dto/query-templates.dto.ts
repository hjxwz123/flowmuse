import { AiModelType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryTemplatesDto {
  @IsOptional()
  @IsEnum(AiModelType)
  type?: AiModelType;

  @IsOptional()
  @IsString()
  category?: string;
}
