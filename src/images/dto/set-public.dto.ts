import { IsBoolean } from 'class-validator';

export class SetPublicDto {
  @IsBoolean()
  isPublic!: boolean;
}

