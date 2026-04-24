import { IsString, MaxLength, MinLength } from 'class-validator';

export class RedeemDto {
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  code!: string;
}

