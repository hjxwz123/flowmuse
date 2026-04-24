import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class MembershipChatModelQuotaItemDto {
  @IsString()
  modelId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dailyLimit?: number | null;
}

export class UpdateMembershipChatModelQuotasDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MembershipChatModelQuotaItemDto)
  items!: MembershipChatModelQuotaItemDto[];
}
