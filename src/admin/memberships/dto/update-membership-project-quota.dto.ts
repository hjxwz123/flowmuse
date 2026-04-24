import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateMembershipProjectQuotaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxCount?: number | null;
}
