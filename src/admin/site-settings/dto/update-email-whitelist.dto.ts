import { IsBoolean, IsOptional, IsArray, IsString } from 'class-validator';

export class UpdateEmailWhitelistDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  domains?: string[];
}
