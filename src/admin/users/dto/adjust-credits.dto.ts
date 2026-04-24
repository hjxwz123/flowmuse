import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdjustCreditsDto {
  @IsInt()
  amount!: number;

  // Frontend uses this shape: { amount: 10, type: 'add'|'deduct', reason: '...' }
  @IsOptional()
  @IsIn(['add', 'deduct'])
  type?: 'add' | 'deduct';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
