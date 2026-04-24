import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthUserCacheModule } from './auth-user-cache.module';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { SettingsModule } from '../settings/settings.module';
import { MembershipsModule } from '../memberships/memberships.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), SettingsModule, MembershipsModule, AuthUserCacheModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
