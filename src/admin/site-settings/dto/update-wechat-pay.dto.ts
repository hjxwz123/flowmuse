import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWechatPayDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  appId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  mchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  apiV3Key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  privateKey?: string; // PEM 格式私钥

  @IsOptional()
  @IsString()
  @MaxLength(64)
  serialNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notifyUrl?: string;
}
