import { IsIn, IsOptional, IsString } from 'class-validator';

export class RetryTaskDto {
  @IsOptional()
  @IsString()
  @IsIn(['image', 'video'])
  type?: 'image' | 'video';
}

