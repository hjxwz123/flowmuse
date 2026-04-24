import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class BatchStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids!: string[];

  @IsIn(['pending', 'processing', 'completed', 'failed'])
  status!: 'pending' | 'processing' | 'completed' | 'failed';

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsIn(['image', 'video', 'auto'])
  type?: 'image' | 'video' | 'auto';
}

