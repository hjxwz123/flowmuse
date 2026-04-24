import { IsIn, IsOptional } from 'class-validator';

import { PaginationDto } from '../../common/dto/pagination.dto';

export class InboxMessagesQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  isRead?: 'true' | 'false';
}

