import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateRedeemCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsString()
  @IsIn(['membership', 'credits'])
  type!: 'membership' | 'credits';

  @IsOptional()
  @IsString()
  membershipLevelId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['monthly', 'yearly'])
  membershipPeriod?: 'monthly' | 'yearly';

  @IsOptional()
  @IsInt()
  @Min(1)
  membershipCycles?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  credits?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUseCount?: number;

  @IsOptional()
  @IsDateString()
  expireDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'expired', 'disabled'])
  status?: 'active' | 'expired' | 'disabled';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
