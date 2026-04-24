import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../prisma/prisma.service';
import { AuthUserCacheService, AuthUserSnapshot } from './auth-user-cache.service';
import { buildUnauthorizedBannedException, isBanExpired } from './ban.utils';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authUserCache: AuthUserCacheService,
  ) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new Error('Missing JWT_ACCESS_SECRET');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const userId = BigInt(payload.sub);
    const user = await this.authUserCache.getOrLoad(userId, async () => {
      const loaded = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          banReason: true,
          banExpireAt: true,
        },
      });

      return loaded ? this.toSnapshot(loaded) : null;
    });

    if (!user) throw new UnauthorizedException('User not found');

    if (isBanExpired(user)) {
      const restored = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.active,
          banReason: null,
          banExpireAt: null,
        },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          banReason: true,
          banExpireAt: true,
        },
      });
      const snapshot = this.toSnapshot(restored);
      await this.authUserCache.set(snapshot);
      return this.toAuthenticatedUser(snapshot);
    }

    if (user.status === UserStatus.banned) {
      throw buildUnauthorizedBannedException(user.banReason, user.banExpireAt);
    }

    if (user.status !== UserStatus.active) throw new UnauthorizedException('User disabled');

    return this.toAuthenticatedUser(user);
  }

  private toSnapshot(user: {
    id: bigint;
    email: string;
    role: AuthUserSnapshot['role'];
    status: UserStatus;
    banReason: string | null;
    banExpireAt: Date | null;
  }): AuthUserSnapshot {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      banReason: user.banReason,
      banExpireAt: user.banExpireAt,
    };
  }

  private toAuthenticatedUser(user: Pick<AuthUserSnapshot, 'id' | 'email' | 'role'>) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
