import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreditLogsQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['redeem', 'consume', 'refund', 'admin_adjust'])
  type?: string;

  @IsOptional()
  @IsString()
  @IsIn(['permanent', 'membership'])
  source?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
