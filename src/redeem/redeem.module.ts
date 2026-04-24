import { Module } from '@nestjs/common';

import { InboxModule } from '../inbox/inbox.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { RedeemController } from './redeem.controller';
import { RedeemService } from './redeem.service';

@Module({
  imports: [InboxModule, MembershipsModule],
  controllers: [RedeemController],
  providers: [RedeemService],
})
export class RedeemModule {}
