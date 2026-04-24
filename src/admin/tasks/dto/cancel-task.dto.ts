import { IsIn, IsOptional, IsString } from 'class-validator';

export class CancelTaskDto {
  @IsOptional()
  @IsString()
  @IsIn(['image', 'video'])
  type?: 'image' | 'video';
}

