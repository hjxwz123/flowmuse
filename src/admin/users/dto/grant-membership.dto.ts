import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GrantMembershipDto {
  @IsString()
  levelId!: string;

  @IsIn(['monthly', 'yearly'])
  period!: 'monthly' | 'yearly';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cycles?: number;

  @IsOptional()
  @IsBoolean()
  grantBonusCredits?: boolean;
}
