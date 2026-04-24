import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  turnstileToken?: string;
}
