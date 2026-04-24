import { Module } from '@nestjs/common';

import { AuthUserCacheService } from './auth-user-cache.service';

@Module({
  providers: [AuthUserCacheService],
  exports: [AuthUserCacheService],
})
export class AuthUserCacheModule {}
