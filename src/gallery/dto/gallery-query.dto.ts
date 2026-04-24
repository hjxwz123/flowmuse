import { IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * 画廊查询 DTO（包含搜索功能）
 */
export class GalleryQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  q?: string;
}
