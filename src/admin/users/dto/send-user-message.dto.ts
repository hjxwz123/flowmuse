import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendUserMessageDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(10000)
  content!: string;

  @IsOptional()
  @IsIn(['info', 'success', 'error'])
  level?: 'info' | 'success' | 'error';

  @IsOptional()
  @IsBoolean()
  allowHtml?: boolean;
}
