import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export const PROJECT_STORYBOARD_TRANSITION_TYPES = [
  'cut',
  'crossfade',
  'glitch',
  'zoom',
  'lightleak',
  'blur',
] as const;

export type ProjectStoryboardTransitionType = typeof PROJECT_STORYBOARD_TRANSITION_TYPES[number];

export class MergeProjectStoryboardTransitionDto {
  @IsString()
  fromShotId!: string;

  @IsString()
  toShotId!: string;

  @IsIn(PROJECT_STORYBOARD_TRANSITION_TYPES)
  type!: ProjectStoryboardTransitionType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1.5)
  duration?: number;
}

export class MergeProjectStoryboardDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  shotIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MergeProjectStoryboardTransitionDto)
  transitions?: MergeProjectStoryboardTransitionDto[];

  @IsOptional()
  @IsBoolean()
  mute?: boolean;
}
