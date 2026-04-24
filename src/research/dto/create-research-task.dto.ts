import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateResearchTaskDto {
  @IsString()
  modelId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  topic?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  fileIds?: string[];
}
