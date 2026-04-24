import { Module } from '@nestjs/common';

import { MembershipsModule } from '../memberships/memberships.module';
import { SettingsModule } from '../settings/settings.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [MembershipsModule, SettingsModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
