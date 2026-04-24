import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ModerateGalleryDto {
  @IsOptional()
  @IsIn(['approved', 'rejected'])
  status?: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}
