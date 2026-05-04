import { IsString, MinLength } from 'class-validator';

export class RegenerateImageTaskDto {
  @IsString()
  @MinLength(1)
  modelId!: string;
}
