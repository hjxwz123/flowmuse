import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateUserMembershipDto {
  @IsIn(['update', 'remove'])
  action!: 'update' | 'remove';

  @IsOptional()
  @IsString()
  levelId?: string;

  @IsOptional()
  @IsDateString()
  expireAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dailyCredits?: number;

  @IsOptional()
  @IsBoolean()
  clearScheduledMemberships?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyUser?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}
