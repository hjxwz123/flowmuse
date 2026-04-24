import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class BatchDeleteDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids!: string[];

  @IsOptional()
  @IsIn(['image', 'video', 'auto'])
  type?: 'image' | 'video' | 'auto';
}

