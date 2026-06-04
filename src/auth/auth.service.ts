import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserAuthEventType, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Queue } from 'bullmq';
import { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_QUEUE } from '../queues/queue-names';
import { SystemSettingsService } from '../settings/system-settings.service';
import { MembershipsService } from '../memberships/memberships.service';
import { buildInviteCode, normalizeInviteCode } from '../common/utils/invite-code.util';
import { AuthUserCacheService } from './auth-user-cache.service';
import { buildForbiddenBannedException, isBanExpired } from './ban.utils';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

type JwtAccessPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

type JwtAction = 'verify_email' | 'reset_password';

type JwtActionPayload = {
  sub: string;
  action: JwtAction;
};

type AuthEmailTemplateParams = {
  title: string;
  subtitle: string;
  body: string;
  buttonLabel: string;
  link: string;
  footerName: string;
  note: string;
  warning?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderAuthEmailTemplate(params: AuthEmailTemplateParams) {
  const currentYear = new Date().getFullYear();
  const title = escapeHtml(params.title);
  const subtitle = escapeHtml(params.subtitle);
  const body = escapeHtml(params.body);
  const buttonLabel = escapeHtml(params.buttonLabel);
  const link = escapeHtml(params.link);
  const footerName = escapeHtml(params.footerName || 'FlowMuse');
  const note = escapeHtml(params.note);
  const warning = params.warning ? escapeHtml(params.warning) : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#F3F4F6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F5F6FF; padding:40px 0;">
    <tr>
      <td align="center" style="padding:0 16px;">
        <table width="90%" border="0" cellspacing="0" cellpadding="0" style="width:90%; max-width:580px; background-color:#ffffff; border-radius:16px; box-shadow:0 10px 25px rgba(165,180,252,0.15); overflow:hidden;">
          <tr>
            <td height="6" style="height:6px; background:linear-gradient(90deg,#3B82F6 0%,#4F46E5 100%); background-color:#4F46E5; font-size:0; line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:40px 40px 30px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size:24px; font-weight:700; color:#1F2937; letter-spacing:-0.5px;">
                    ${title}
                  </td>
                </tr>
                <tr>
                  <td style="font-size:14px; color:#9CA3AF; padding-top:4px; padding-bottom:30px;">
                    ${subtitle}
                  </td>
                </tr>
              </table>
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size:16px; color:#4B5563; line-height:1.6; padding-bottom:30px;">
                    ${body}
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding-bottom:30px;">
                    <a href="${link}" target="_blank" style="background:linear-gradient(135deg,#3B82F6 0%,#4F46E5 100%); background-color:#4F46E5; color:#ffffff; display:inline-block; padding:12px 32px; font-size:16px; font-weight:600; text-decoration:none; border-radius:8px; box-shadow:0 4px 12px rgba(79,70,229,0.3);">
                      ${buttonLabel} &rarr;
                    </a>
                  </td>
                </tr>
                ${warning ? `<tr>
                  <td style="font-size:14px; color:#EF4444; font-weight:500; padding-bottom:20px;">
                    * ${warning}
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="font-size:13px; color:#9CA3AF; line-height:1.5; border-top:1px solid #F3F4F6; padding-top:20px;">
                    如果按钮无法点击，请复制以下链接粘贴至浏览器地址栏：<br>
                    <a href="${link}" target="_blank" style="color:#4F46E5; text-decoration:none; word-break:break-all; overflow-wrap:anywhere;">${link}</a>
                  </td>
                </tr>
                <tr>
                  <td style="font-size:13px; color:#9CA3AF; padding-top:10px;">
                    * ${note}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#FAF5FF; padding:20px 40px; text-align:center; font-size:12px; color:#9CA3AF;">
              © ${currentYear} ${footerName}. 保留所有权利。
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly settings: SystemSettingsService,
    private readonly memberships: MembershipsService,
    private readonly authUserCache: AuthUserCacheService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
  ) {}

  private accessSecret() {
    const secret = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new Error('Missing JWT_ACCESS_SECRET');
    return secret;
  }

  private refreshSecret() {
    const secret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('Missing JWT_REFRESH_SECRET');
    return secret;
  }

  private accessExpiresIn() {
    return this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
  }

  private refreshExpiresIn() {
    return this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';
  }

  private async issueTokens(user: { id: bigint; email: string; role: UserRole }) {
    const payload: JwtAccessPayload = {
      sub: user.id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.accessSecret(),
      expiresIn: this.accessExpiresIn(),
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.refreshSecret(),
      expiresIn: this.refreshExpiresIn(),
    });

    return { accessToken, refreshToken };
  }

  private async issueActionToken(userId: bigint, action: JwtAction, expiresIn: string) {
    const payload: JwtActionPayload = { sub: userId.toString(), action };
    return this.jwt.signAsync(payload, { secret: this.accessSecret(), expiresIn });
  }

  private frontendUrl() {
    return this.config.get<string>('FRONTEND_URL') ?? '';
  }

  private async enqueueEmail(to: string, subject: string, text: string, html?: string) {
    await this.emailQueue.add('send', { to, subject, text, html });
  }

  private async verifyTurnstileIfEnabled(token: string | undefined, req?: Request) {
    const settings = await this.settings.getTurnstileSettings();
    if (!settings.enabled) return;

    if (!settings.siteKey || !settings.secretKey) {
      this.logger.warn('Turnstile is enabled but site key / secret key is missing');
      throw new BadRequestException('Human verification is temporarily unavailable');
    }

    const responseToken = token?.trim();
    if (!responseToken) {
      throw new BadRequestException('Human verification required');
    }

    const body = new URLSearchParams({
      secret: settings.secretKey,
      response: responseToken,
    });

    const clientIp = this.extractClientIp(req);
    if (clientIp) {
      body.set('remoteip', clientIp);
    }

    let verificationResponse;

    try {
      verificationResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
    } catch (error) {
      this.logger.warn(`Turnstile verification request failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadRequestException('Human verification failed');
    }

    if (!verificationResponse.ok) {
      this.logger.warn(`Turnstile verification returned HTTP ${verificationResponse.status}`);
      throw new BadRequestException('Human verification failed');
    }

    let payload: { success?: boolean; ['error-codes']?: string[] } | null = null;

    try {
      payload = (await verificationResponse.json()) as { success?: boolean; ['error-codes']?: string[] };
    } catch (error) {
      this.logger.warn(`Turnstile verification returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadRequestException('Human verification failed');
    }

    if (payload?.success === true) {
      return;
    }

    const errorCodes = Array.isArray(payload?.['error-codes']) ? payload['error-codes'].join(',') : 'unknown';
    this.logger.warn(`Turnstile verification failed: ${errorCodes}`);
    throw new BadRequestException('Human verification failed');
  }

  private async primeAuthUserCache(user: {
    id: bigint;
    email: string;
    role: UserRole;
    status: UserStatus;
    banReason?: string | null;
    banExpireAt?: Date | null;
  }) {
    await this.authUserCache.set({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      banReason: user.banReason ?? null,
      banExpireAt: user.banExpireAt ?? null,
    });
  }

  private extractClientIp(req?: Request | null): string | null {
    if (!req) return null;

    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    const candidates = [
      Array.isArray(forwarded) ? forwarded[0] : forwarded,
      Array.isArray(realIp) ? realIp[0] : realIp,
      req.ip,
      req.socket?.remoteAddress,
    ];

    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue;
      const normalized = candidate
        .split(',')[0]
        .trim()
        .replace(/^::ffff:/, '')
        .slice(0, 128);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private extractUserAgent(req?: Request | null): string | null {
    const header = req?.headers['user-agent'];
    if (typeof header !== 'string') return null;
    const value = header.trim();
    return value ? value.slice(0, 500) : null;
  }

  private async releaseExpiredBanIfNeeded<T extends { id: bigint; status: UserStatus; banReason?: string | null; banExpireAt?: Date | null }>(
    user: T,
  ): Promise<T> {
    if (!isBanExpired(user)) return user;

    const restored = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.active,
        banReason: null,
        banExpireAt: null,
      },
    });
    await this.authUserCache.invalidate(user.id);

    return {
      ...user,
      ...restored,
    };
  }

  private async awardInviteRegisterCreditsOnEmailVerified(
    tx: Prisma.TransactionClient,
    input: {
      userId: bigint;
      email: string;
      inviterId?: bigint | null;
      inviterRegisterCredits: number;
      inviteeRegisterCredits: number;
    },
  ) {
    if (!input.inviterId) return 0;

    const inviterRegisterCredits = Math.max(0, input.inviterRegisterCredits);
    const eventKey = `register:${input.userId.toString()}`;

    try {
      await tx.inviteRewardLog.create({
        data: {
          eventKey,
          inviterId: input.inviterId,
          inviteeId: input.userId,
          rewardType: 'register',
          inviterRewardCredits: inviterRegisterCredits,
          inviteeRewardCredits: Math.max(0, input.inviteeRegisterCredits),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return 0;
      }
      throw error;
    }

    if (inviterRegisterCredits <= 0) return 0;

    const inviterCredits = await tx.user.update({
      where: { id: input.inviterId },
      data: { permanentCredits: { increment: inviterRegisterCredits } },
      select: { permanentCredits: true },
    });

    await tx.creditLog.create({
      data: {
        userId: input.inviterId,
        amount: inviterRegisterCredits,
        balanceAfter: inviterCredits.permanentCredits,
        type: 'redeem',
        source: 'permanent',
        description: `邀请注册奖励 ${inviterRegisterCredits} 积分（用户 ${input.email} 完成邮箱验证）`,
      },
    });

    return inviterRegisterCredits;
  }

  async register(dto: RegisterDto, req?: Request) {
    await this.verifyTurnstileIfEnabled(dto.turnstileToken, req);

    const registrationEnabled = await this.settings.isRegistrationEnabled();
    const normalizedInviteCode = normalizeInviteCode(dto.inviteCode);

    if (!registrationEnabled && !normalizedInviteCode) {
      throw new ForbiddenException('Registration is currently invite-only');
    }

    // 验证邮箱域名是否在白名单中
    const emailAllowed = await this.settings.isEmailDomainAllowed(dto.email);
    if (!emailAllowed) throw new ForbiddenException('Email domain not allowed');

    const publicSettings = await this.settings.getPublicSettings();
    const initialCredits = publicSettings.initialRegisterCredits;
    const inviteeRegisterCredits = Math.max(0, publicSettings.inviteRegisterInviteeCredits);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const ip = this.extractClientIp(req);
    const userAgent = this.extractUserAgent(req);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        let inviter: { id: bigint; status: UserStatus } | null = null;

        if (normalizedInviteCode) {
          inviter = await tx.user.findUnique({
            where: { inviteCode: normalizedInviteCode },
            select: { id: true, status: true },
          });

          if (!inviter || inviter.status !== UserStatus.active) {
            throw new BadRequestException('Invalid invite code');
          }
        }

        const createdUser = await tx.user.create({
          data: {
            email: dto.email,
            password: passwordHash,
            username: dto.username,
            role: UserRole.user,
            status: UserStatus.unverified, // 注册时设为未验证，验证邮箱后改为 active
            emailVerified: false,
            permanentCredits: initialCredits + (inviter ? inviteeRegisterCredits : 0),
            invitedById: inviter?.id ?? null,
            invitedAt: inviter ? new Date() : null,
          },
          select: {
            id: true,
            email: true,
            username: true,
            avatar: true,
            role: true,
            status: true,
            emailVerified: true,
            permanentCredits: true,
            createdAt: true,
          },
        });

        const userWithInviteCode = await tx.user.update({
          where: { id: createdUser.id },
          data: { inviteCode: buildInviteCode(createdUser.id) },
          select: {
            id: true,
            email: true,
            username: true,
            avatar: true,
            role: true,
            status: true,
            emailVerified: true,
            permanentCredits: true,
            createdAt: true,
          },
        });

        await tx.userAuthEvent.create({
          data: {
            userId: createdUser.id,
            type: UserAuthEventType.register,
            ip,
            userAgent,
          },
        });

        if (inviter) {
          if (inviteeRegisterCredits > 0) {
            await tx.creditLog.create({
              data: {
                userId: createdUser.id,
                amount: inviteeRegisterCredits,
                balanceAfter: userWithInviteCode.permanentCredits,
                type: 'redeem',
                source: 'permanent',
                description: `使用邀请码注册奖励 ${inviteeRegisterCredits} 积分`,
              },
            });
          }
        }

        return userWithInviteCode;
      });

      // 注册后不返回 tokens，用户需要先验证邮箱
      const verifyEmailToken = await this.issueActionToken(user.id, 'verify_email', '1d');
      const verifyLink = this.frontendUrl() ? `${this.frontendUrl()}/auth/verify-email?token=${encodeURIComponent(verifyEmailToken)}` : verifyEmailToken;
      const emailBrandName = publicSettings.siteTitle || 'FlowMuse';
      await this.enqueueEmail(
        user.email,
        `激活您的 ${emailBrandName} 账号`,
        `您好！感谢您注册 ${emailBrandName}。请点击以下链接确认您的邮箱地址：\n${verifyLink}\n\n此链接将在 24 小时内有效。如果您并未注册此账号，请忽略此邮件。\n`,
        renderAuthEmailTemplate({
          title: '欢迎加入',
          subtitle: '加入我们，释放无限创意',
          body: `您好！感谢您注册 ${emailBrandName}。为了保障您的账号安全并完成激活，请点击下方按钮确认您的邮箱地址：`,
          buttonLabel: '激活账号',
          link: verifyLink,
          footerName: emailBrandName,
          note: '此链接将在 24 小时内有效。如果您并未注册此账号，请忽略此邮件。',
        }),
      );

      return {
        user: {
          ...user,
          membership: null,
        },
        requireEmailVerification: true, // 标记需要邮箱验证
        verifyEmailToken: process.env.NODE_ENV === 'production' ? undefined : verifyEmailToken
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto, req?: Request) {
    await this.verifyTurnstileIfEnabled(dto.turnstileToken, req);

    const rawUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const user = rawUser ? await this.releaseExpiredBanIfNeeded(rawUser) : null;
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    // 检查邮箱验证状态
    if (user.status === UserStatus.unverified) {
      // 未验证邮箱，返回特殊错误
      throw new ForbiddenException('Please verify your email first');
    }

    if (user.status === UserStatus.banned) {
      throw buildForbiddenBannedException(user.banReason, user.banExpireAt);
    }

    const loginAt = new Date();
    const ip = this.extractClientIp(req);
    const userAgent = this.extractUserAgent(req);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: loginAt },
      });

      await tx.userAuthEvent.create({
        data: {
          userId: user.id,
          type: UserAuthEventType.login,
          ip,
          userAgent,
          createdAt: loginAt,
        },
      });

      return nextUser;
    });

    await this.primeAuthUserCache(updatedUser);
    const tokens = await this.issueTokens(updatedUser);
    const membership = await this.memberships.getUserMembership(updatedUser.id);
    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        avatar: updatedUser.avatar,
        role: updatedUser.role,
        status: updatedUser.status,
        emailVerified: updatedUser.emailVerified,
        permanentCredits: updatedUser.permanentCredits,
        createdAt: updatedUser.createdAt,
        membership,
      },
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = await this.jwt.verifyAsync<JwtAccessPayload>(dto.refreshToken, { secret: this.refreshSecret() });

      const userId = BigInt(payload.sub);
      const rawUser = await this.prisma.user.findUnique({ where: { id: userId } });
      const user = rawUser ? await this.releaseExpiredBanIfNeeded(rawUser) : null;
      if (!user) throw new UnauthorizedException('Invalid refresh token');
      if (user.status !== UserStatus.active) {
        if (user.status === UserStatus.banned) {
          throw buildForbiddenBannedException(user.banReason, user.banExpireAt);
        }
        throw new ForbiddenException('User is disabled');
      }

      await this.primeAuthUserCache(user);
      const tokens = await this.issueTokens(user);
      return { ...tokens };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async verifyEmail(dto: VerifyEmailDto) {
    try {
      const payload = await this.jwt.verifyAsync<JwtActionPayload>(dto.token, { secret: this.accessSecret() });
      if (payload.action !== 'verify_email') throw new BadRequestException('Invalid token action');

      const userId = BigInt(payload.sub);
      const publicSettings = await this.settings.getPublicSettings();

      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            emailVerified: true,
            invitedById: true,
            status: true,
          },
        });

        if (!user) {
          throw new BadRequestException('Invalid or expired token');
        }

        if (!user.emailVerified || user.status !== UserStatus.active) {
          await tx.user.update({
            where: { id: userId },
            data: {
              emailVerified: true,
              status: UserStatus.active, // 验证邮箱后激活账号
            },
          });
        }

        await this.awardInviteRegisterCreditsOnEmailVerified(tx, {
          userId: user.id,
          email: user.email,
          inviterId: user.invitedById,
          inviterRegisterCredits: publicSettings.inviteRegisterInviterCredits,
          inviteeRegisterCredits: publicSettings.inviteRegisterInviteeCredits,
        });
      });

      await this.authUserCache.invalidate(userId);

      return { ok: true };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Invalid or expired token');
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Always return ok to avoid user enumeration
    if (!user) return { ok: true };

    const resetToken = await this.issueActionToken(user.id, 'reset_password', '30m');
    const resetLink = this.frontendUrl() ? `${this.frontendUrl()}/auth/reset-password?token=${encodeURIComponent(resetToken)}` : resetToken;
    const publicSettings = await this.settings.getPublicSettings();
    const emailBrandName = publicSettings.siteTitle || 'FlowMuse';
    await this.enqueueEmail(
      user.email,
      `${emailBrandName} 密码重置请求`,
      `您好！我们收到了重置您账号密码的请求。请点击以下链接设置新密码：\n${resetLink}\n\n如果您并未申请重置密码，请忽略此邮件，您的密码将保持不变。\n此链接将在 30 分钟内有效。\n`,
      renderAuthEmailTemplate({
        title: '重置密码请求',
        subtitle: '安全与账号保护',
        body: '您好！我们收到了重置您账号密码的请求。请点击下方按钮设置新密码：',
        buttonLabel: '重置密码',
        link: resetLink,
        footerName: emailBrandName,
        warning: '如果您并未申请重置密码，请忽略此邮件，您的密码将保持不变。',
        note: '此链接将在 30 分钟内有效。',
      }),
    );

    return { ok: true, resetToken: process.env.NODE_ENV === 'production' ? undefined : resetToken };
  }

  async resetPassword(dto: ResetPasswordDto) {
    try {
      const payload = await this.jwt.verifyAsync<JwtActionPayload>(dto.token, { secret: this.accessSecret() });
      if (payload.action !== 'reset_password') throw new BadRequestException('Invalid token action');

      const userId = BigInt(payload.sub);
      const passwordHash = await bcrypt.hash(dto.newPassword, 10);

      await this.prisma.user.update({
        where: { id: userId },
        data: { password: passwordHash },
      });

      return { ok: true };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Invalid or expired token');
    }
  }
}
