import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MembershipsService } from '../memberships/memberships.service';
import { SystemSettingsService } from '../settings/system-settings.service';
import { buildInviteCode } from '../common/utils/invite-code.util';
import { normalizeUploadedFileName } from '../common/utils/upload-filename.util';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly memberships: MembershipsService,
    private readonly settings: SystemSettingsService,
  ) {}

  private async ensureInviteCode(userId: bigint, inviteCode?: string | null) {
    if (inviteCode) return inviteCode;

    const nextInviteCode = buildInviteCode(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { inviteCode: nextInviteCode },
      select: { inviteCode: true },
    });

    return updated.inviteCode ?? nextInviteCode;
  }

  async getProfile(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        permanentCredits: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    const membership = await this.memberships.getUserMembership(userId);
    return {
      ...user,
      membership,
    };
  }

  async updateProfile(userId: bigint, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        username: dto.username,
        avatar: dto.avatar,
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        permanentCredits: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    const membership = await this.memberships.getUserMembership(userId);
    return {
      ...user,
      membership,
    };
  }

  async updateAvatar(userId: bigint, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Missing file');

    if (!file.buffer) throw new BadRequestException('Missing file buffer');

    const stored = await this.storage.uploadAvatar(file.buffer, normalizeUploadedFileName(file.originalname), userId);
    const avatarPath = stored.url;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarPath },
      select: { id: true, avatar: true },
    });

    return user;
  }

  async changePassword(userId: bigint, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== UserStatus.active) throw new ForbiddenException('User is banned');

    const ok = await bcrypt.compare(dto.oldPassword, user.password);
    if (!ok) throw new BadRequestException('Old password incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    });

    return { ok: true };
  }

  async getInviteInfo(userId: bigint) {
    const [user, siteSettings, invitees, rewardSummary] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          inviteCode: true,
        },
      }),
      this.settings.getPublicSettings(),
      this.prisma.user.findMany({
        where: { invitedById: userId },
        orderBy: [
          { invitedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          invitedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.inviteRewardLog.aggregate({
        where: { inviterId: userId },
        _sum: {
          inviterRewardCredits: true,
        },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');

    const inviteCode = await this.ensureInviteCode(userId, user.inviteCode);

    return {
      inviteCode,
      invitedCount: invitees.length,
      totalInviterRewardCredits: rewardSummary._sum.inviterRewardCredits ?? 0,
      registerInviterCredits: siteSettings.inviteRegisterInviterCredits,
      registerInviteeCredits: siteSettings.inviteRegisterInviteeCredits,
      invitePaymentCreditsPerYuan: siteSettings.invitePaymentCreditsPerYuan,
      invitees: invitees.map((invitee) => ({
        id: invitee.id.toString(),
        email: invitee.email,
        username: invitee.username,
        avatar: invitee.avatar,
        invitedAt: invitee.invitedAt,
        createdAt: invitee.createdAt,
      })),
    };
  }
}
