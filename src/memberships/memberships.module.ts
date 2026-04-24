import { Module } from '@nestjs/common';

import { MembershipsController } from './memberships.controller';
import { MembershipChatModelQuotasService } from './membership-chat-model-quotas.service';
import { MembershipsService } from './memberships.service';

@Module({
  controllers: [MembershipsController],
  providers: [MembershipsService, MembershipChatModelQuotasService],
  exports: [MembershipsService, MembershipChatModelQuotasService],
})
export class MembershipsModule {}
