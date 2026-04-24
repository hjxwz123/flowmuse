import { IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ChatModerationLogsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  @IsIn(['all', 'chat', 'image_generate', 'prompt_optimize'])
  source?: 'all' | 'chat' | 'image_generate' | 'prompt_optimize';
}
