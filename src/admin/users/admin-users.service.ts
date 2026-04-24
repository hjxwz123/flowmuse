import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreditLogType, CreditSource, GalleryTargetType, MembershipPeriod, Prisma, UserStatus } from '@prisma/client';

import { calculateBanExpireAt } from '../../auth/ban.utils';
import { AuthUserCacheService } from '../../auth/auth-user-cache.service';
import { InboxService } from '../../inbox/inbox.service';
import { MembershipsService } from '../../memberships/memberships.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjustCreditsDto } from './dto/adjust-credits.dto';
import { GrantMembershipDto } from './dto/grant-membership.dto';
import { SendUserMessageDto } from './dto/send-user-message.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

type AdminCreditTransaction = {
  id: string;
  userId: string;
  amount: number;
  type: 'add' | 'deduct' | 'purchase' | 'consume';
  reason: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
  createdBy?: string;
};

type AdminUserCreationItem = {
  id: string;
  type: 'image' | 'video';
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  url: string | null;
  thumbnailUrl: string | null;
  creditsUsed: number;
  createdAt: string;
};

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
    private readonly memberships: MembershipsService,
    private readonly authUserCache: AuthUserCacheService,
  ) {}

  async list(options: { page: number; pageSize: number }) {
    const page = Number.isFinite(options.page) && options.page > 0 ? options.page : 1;
    const pageSize = Number.isFinite(options.pageSize) ? Math.min(Math.max(options.pageSize, 1), 100) : 20;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          role: true,
          status: true,
          banReason: true,
          banExpireAt: true,
          permanentCredits: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
    ]);

    return { page, pageSize, total, items };
  }

  async detail(userId: bigint) {
    const [user, invitees, inviteesCount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          inviteCode: true,
          invitedAt: true,
          permanentCredits: true,
          role: true,
          status: true,
          banReason: true,
          banExpireAt: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          invitedBy: {
            select: {
              id: true,
              email: true,
              username: true,
              avatar: true,
            },
          },
          authEvents: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              type: true,
              ip: true,
              userAgent: true,
              createdAt: true,
            },
          },
        },
      }),
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
      this.prisma.user.count({
        where: { invitedById: userId },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    const membership = await this.memberships.getUserMembership(userId);
    return {
      ...user,
      membership,
      invitedBy: user.invitedBy
        ? {
            id: user.invitedBy.id.toString(),
            email: user.invitedBy.email,
            username: user.invitedBy.username,
            avatar: user.invitedBy.avatar,
            invitedAt: user.invitedAt,
          }
        : null,
      inviteesCount,
      invitees: invitees.map((invitee) => ({
        id: invitee.id.toString(),
        email: invitee.email,
        username: invitee.username,
        avatar: invitee.avatar,
        invitedAt: invitee.invitedAt,
        createdAt: invitee.createdAt,
      })),
      authEvents: user.authEvents.map((event) => ({
        id: event.id.toString(),
        type: event.type,
        ip: event.ip,
        userAgent: event.userAgent,
        createdAt: event.createdAt,
      })),
    };
  }

  async grantMembership(userId: bigint, dto: GrantMembershipDto) {
    let membershipLevelId: bigint;
    try {
      membershipLevelId = BigInt(dto.levelId);
    } catch {
      throw new BadRequestException('Invalid membership level id');
    }

    const period = dto.period === 'yearly' ? MembershipPeriod.yearly : MembershipPeriod.monthly;
    const cycles = dto.cycles && Number.isFinite(dto.cycles) ? Math.max(1, Math.floor(dto.cycles)) : 1;
    const grantBonusCredits = dto.grantBonusCredits === true;

    const result = await this.prisma.$transaction(async (tx) => {
      const activateResult = await this.memberships.activateMembership(
        tx,
        userId,
        membershipLevelId,
        period,
        cycles,
      );

      let grantedPermanentCredits = 0;
      if (grantBonusCredits && activateResult.level.bonusPermanentCredits > 0) {
        grantedPermanentCredits = this.memberships.calculateMembershipBonusCredits(
          activateResult.level.bonusPermanentCredits,
          period,
          cycles,
        );
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { permanentCredits: { increment: grantedPermanentCredits } },
          select: { permanentCredits: true },
        });

        await tx.creditLog.create({
          data: {
            userId,
            amount: grantedPermanentCredits,
            balanceAfter: updatedUser.permanentCredits,
            type: CreditLogType.redeem,
            source: CreditSource.permanent,
            description: `管理员手动开通会员赠送永久积分 ${grantedPermanentCredits}`,
          },
        });
      }

      return {
        mode: activateResult.mode,
        levelName: activateResult.level.name,
        startsAt: activateResult.startsAt,
        expireAt: activateResult.expireAt,
        durationDays: activateResult.durationDays,
        grantedPermanentCredits,
      };
    });

    const membership = await this.memberships.getUserMembership(userId, false);
    const periodLabel = period === MembershipPeriod.yearly ? '年付' : '月付';
    const bonusText =
      result.grantedPermanentCredits > 0
        ? `，并赠送永久积分 ${result.grantedPermanentCredits}`
        : '';
    const membershipContent = result.mode === 'scheduled'
      ? `管理员已为你购买${result.levelName ? `「${result.levelName}」` : ''}${periodLabel}会员（${cycles}期），将在当前会员及已排队会员结束后生效。预计生效时间：${new Date(result.startsAt).toLocaleString('zh-CN')}，预计到期时间：${new Date(result.expireAt).toLocaleString('zh-CN')}${bonusText}。`
      : result.mode === 'renewed'
        ? `管理员已为你续费${membership?.levelName ? `「${membership.levelName}」` : ''}${periodLabel}会员（${cycles}期），新的到期时间：${new Date(result.expireAt).toLocaleString('zh-CN')}${bonusText}。`
        : result.mode === 'upgraded'
          ? `管理员已为你升级为${membership?.levelName ? `「${membership.levelName}」` : ''}${periodLabel}会员（${cycles}期），新的到期时间：${new Date(result.expireAt).toLocaleString('zh-CN')}${bonusText}。`
          : `管理员已为你开通${membership?.levelName ? `「${membership.levelName}」` : ''}${periodLabel}会员（${cycles}期），到期时间：${new Date(result.expireAt).toLocaleString('zh-CN')}${bonusText}。`;
    await this.inbox.sendSystemMessage({
      userId,
      type: 'membership_activated',
      level: 'success',
      title: result.mode === 'scheduled' ? '会员已购买' : '会员已开通',
      content: membershipContent,
      meta: {
        action: 'admin_grant_membership',
        mode: result.mode,
        period,
        cycles,
        startsAt: result.startsAt.toISOString(),
        expireAt: result.expireAt.toISOString(),
        grantedPermanentCredits: result.grantedPermanentCredits,
      } satisfies Prisma.JsonObject,
    });

    return {
      ok: true,
      ...result,
      membership,
    };
  }

  async updateStatus(userId: bigint, dto: UpdateUserStatusDto) {
    const status = dto.status === 'banned' ? UserStatus.banned : UserStatus.active;
    const banReason = dto.reason?.trim() || null;
    const banExpireAt = status === UserStatus.banned ? calculateBanExpireAt(dto.banDays) : null;

    if (status === UserStatus.banned && !banReason) {
      throw new BadRequestException('Ban reason is required');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status,
        banReason: status === UserStatus.banned ? banReason : null,
        banExpireAt,
      },
      select: { id: true, status: true, banReason: true, banExpireAt: true },
    });
    await this.authUserCache.invalidate(userId);

    return updated;
  }

  async adjustCredits(userId: bigint, dto: AdjustCreditsDto) {
    // Support both:
    // 1) { amount: 10, type: 'add'|'deduct', reason: '...' } (frontend)
    // 2) { amount: 10/-10, description: '...' } (legacy)
    if (!Number.isInteger(dto.amount)) throw new BadRequestException('amount must be integer');

    const normalizedAmount =
      dto.type === 'deduct'
        ? -Math.abs(dto.amount)
        : dto.type === 'add'
          ? Math.abs(dto.amount)
          : dto.amount;

    if (normalizedAmount === 0) throw new BadRequestException('amount must not be 0');

    const description = dto.reason?.trim() || dto.description?.trim() || 'Admin adjust credits';

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { permanentCredits: true } });
      if (!user) throw new NotFoundException('User not found');

      const next = user.permanentCredits + normalizedAmount;
      if (next < 0) throw new BadRequestException('Insufficient permanent credits');

      const updated = await tx.user.update({
        where: { id: userId },
        data: { permanentCredits: next },
        select: { id: true, permanentCredits: true },
      });

      await tx.creditLog.create({
        data: {
          userId,
          amount: normalizedAmount,
          balanceAfter: updated.permanentCredits,
          type: CreditLogType.admin_adjust,
          source: CreditSource.permanent,
          description,
        },
      });

      return updated;
    });

    const verb = normalizedAmount >= 0 ? '增加' : '扣除';
    await this.inbox.sendSystemMessage({
      userId,
      type: 'admin_credits_adjust',
      level: normalizedAmount >= 0 ? 'success' : 'info',
      title: `积分已被管理员${verb}`,
      content: `管理员已${verb}你的积分 ${Math.abs(normalizedAmount)}。原因：${description}。当前永久积分：${result.permanentCredits}`,
      meta: {
        action: 'admin_adjust_credits',
        amount: normalizedAmount,
        reason: description,
        balanceAfter: result.permanentCredits,
      } satisfies Prisma.JsonObject,
    });

    return result;
  }

  async sendCustomMessage(userId: bigint, adminId: bigint, dto: SendUserMessageDto) {
    const title = dto.title.trim();
    const content = dto.content.trim();
    if (!title) throw new BadRequestException('title is required');
    if (!content) throw new BadRequestException('content is required');

    const [targetUser, adminUser] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { id: adminId }, select: { username: true, email: true } }),
    ]);
    if (!targetUser) throw new NotFoundException('User not found');

    const senderName = adminUser?.username?.trim() || adminUser?.email?.split('@')[0] || '管理员';

    await this.inbox.sendSystemMessage({
      userId,
      type: 'admin_custom',
      level: dto.level ?? 'info',
      title,
      content,
      meta: {
        action: 'admin_custom_message',
        senderRole: 'admin',
        senderId: adminId.toString(),
        senderName,
        contentFormat: dto.allowHtml ? 'html' : 'text',
      } satisfies Prisma.JsonObject,
    });

    return { ok: true };
  }

  private buildGalleryTargetConditions(imageTaskIds: bigint[], videoTaskIds: bigint[]) {
    const conditions: Array<{
      targetType: GalleryTargetType;
      targetId: { in: bigint[] };
    }> = [];

    if (imageTaskIds.length > 0) {
      conditions.push({
        targetType: GalleryTargetType.image,
        targetId: { in: imageTaskIds },
      });
    }

    if (videoTaskIds.length > 0) {
      conditions.push({
        targetType: GalleryTargetType.video,
        targetId: { in: videoTaskIds },
      });
    }

    return conditions;
  }

  private isMissingInputModerationTable(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const message = JSON.stringify(error.meta ?? {});
      return error.code === 'P2010' && message.includes('input_moderation_logs');
    }

    return error instanceof Error && error.message.includes('input_moderation_logs');
  }

  private async deleteInputModerationLogs(tx: Prisma.TransactionClient, userId: bigint) {
    try {
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM input_moderation_logs
        WHERE user_id = ${userId}
      `);
    } catch (error) {
      if (this.isMissingInputModerationTable(error)) {
        return;
      }
      throw error;
    }
  }

  async removeUser(userId: bigint, adminUserId: bigint) {
    if (userId === adminUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      const [imageTasks, videoTasks, chatConversations, redeemCodes] = await Promise.all([
        tx.imageTask.findMany({
          where: { userId },
          select: { id: true },
        }),
        tx.videoTask.findMany({
          where: { userId },
          select: { id: true },
        }),
        tx.chatConversation.findMany({
          where: { userId },
          select: { id: true },
        }),
        tx.redeemCode.findMany({
          where: { createdBy: userId },
          select: { id: true },
        }),
      ]);

      const imageTaskIds = imageTasks.map((task) => task.id);
      const videoTaskIds = videoTasks.map((task) => task.id);
      const chatConversationIds = chatConversations.map((conversation) => conversation.id);
      const redeemCodeIds = redeemCodes.map((code) => code.id);
      const galleryTargetConditions = this.buildGalleryTargetConditions(imageTaskIds, videoTaskIds);

      await tx.user.updateMany({
        where: { invitedById: userId },
        data: {
          invitedById: null,
          invitedAt: null,
        },
      });

      await tx.galleryLike.deleteMany({ where: { userId } });
      await tx.galleryFavorite.deleteMany({ where: { userId } });
      await tx.galleryComment.deleteMany({ where: { userId } });

      if (galleryTargetConditions.length > 0) {
        await tx.galleryLike.deleteMany({
          where: { OR: galleryTargetConditions },
        });
        await tx.galleryFavorite.deleteMany({
          where: { OR: galleryTargetConditions },
        });
        await tx.galleryComment.deleteMany({
          where: { OR: galleryTargetConditions },
        });
      }

      if (chatConversationIds.length > 0) {
        await tx.chatMessage.deleteMany({
          where: { conversationId: { in: chatConversationIds } },
        });
        await tx.chatFile.deleteMany({
          where: { conversationId: { in: chatConversationIds } },
        });
        await tx.chatModerationLog.deleteMany({
          where: { conversationId: { in: chatConversationIds } },
        });
      }

      await tx.chatMessage.deleteMany({ where: { userId } });
      await tx.chatFile.deleteMany({ where: { userId } });
      await tx.chatModerationLog.deleteMany({ where: { userId } });
      await tx.chatConversation.deleteMany({ where: { userId } });
      await this.deleteInputModerationLogs(tx, userId);

      if (redeemCodeIds.length > 0) {
        await tx.redeemLog.deleteMany({
          where: { codeId: { in: redeemCodeIds } },
        });
      }
      await tx.redeemLog.deleteMany({ where: { userId } });
      await tx.redeemCode.deleteMany({ where: { createdBy: userId } });

      await tx.inviteRewardLog.deleteMany({
        where: {
          OR: [
            { inviterId: userId },
            { inviteeId: userId },
          ],
        },
      });

      await tx.inboxMessage.deleteMany({ where: { userId } });
      await tx.paymentOrder.deleteMany({ where: { userId } });
      await tx.creditLog.deleteMany({ where: { userId } });
      await tx.userAuthEvent.deleteMany({ where: { userId } });
      await tx.researchTask.deleteMany({ where: { userId } });
      await tx.imageTask.deleteMany({ where: { userId } });
      await tx.videoTask.deleteMany({ where: { userId } });
      await tx.template.deleteMany({ where: { createdBy: userId } });

      await tx.user.delete({ where: { id: userId } });
    });

    await Promise.all([
      this.authUserCache.invalidate(userId),
      this.inbox.clearUnreadCountCache(userId),
    ]);

    return {
      ok: true,
      id: user.id.toString(),
    };
  }

  private mapCreditLogToTransaction(log: {
    id: bigint;
    userId: bigint;
    amount: number;
    balanceAfter: number;
    type: CreditLogType;
    source: CreditSource;
    description: string | null;
    createdAt: Date;
  }): AdminCreditTransaction {
    const type: AdminCreditTransaction['type'] =
      log.type === CreditLogType.consume
        ? 'consume'
        : log.type === CreditLogType.redeem
          ? 'purchase'
          : log.type === CreditLogType.admin_adjust
            ? log.amount >= 0
              ? 'add'
              : 'deduct'
            : log.type === CreditLogType.refund
              ? 'add'
              : log.amount >= 0
                ? 'add'
                : 'deduct';

    const sourceLabel = log.source === CreditSource.membership ? '【会员】' : '【永久】';
    const reason = `${sourceLabel}${log.description ?? ''}`.trim() || sourceLabel;

    return {
      id: log.id.toString(),
      userId: log.userId.toString(),
      amount: log.amount,
      type,
      reason,
      balanceBefore: log.balanceAfter - log.amount,
      balanceAfter: log.balanceAfter,
      createdAt: log.createdAt.toISOString(),
    };
  }

  async creditTransactions(userId: bigint, options: { page: number; pageSize: number }) {
    const page = Number.isFinite(options.page) && options.page > 0 ? options.page : 1;
    const pageSize = Number.isFinite(options.pageSize) ? Math.min(Math.max(options.pageSize, 1), 100) : 20;

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');

    const where: Prisma.CreditLogWhereInput = { userId };

    const [total, logs] = await this.prisma.$transaction([
      this.prisma.creditLog.count({ where }),
      this.prisma.creditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          userId: true,
          amount: true,
          balanceAfter: true,
          type: true,
          source: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    return {
      items: logs.map((log) => this.mapCreditLogToTransaction(log)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async creations(userId: bigint, options: { page: number; pageSize: number }) {
    const page = Number.isFinite(options.page) && options.page > 0 ? options.page : 1;
    const pageSize = Number.isFinite(options.pageSize) ? Math.min(Math.max(options.pageSize, 1), 100) : 20;

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');

    const take = page * pageSize;
    const [imageTotal, videoTotal, imageItems, videoItems] = await this.prisma.$transaction([
      this.prisma.imageTask.count({ where: { userId } }),
      this.prisma.videoTask.count({ where: { userId } }),
      this.prisma.imageTask.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          prompt: true,
          status: true,
          resultUrl: true,
          thumbnailUrl: true,
          creditsCost: true,
          createdAt: true,
        },
      }),
      this.prisma.videoTask.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          prompt: true,
          status: true,
          resultUrl: true,
          thumbnailUrl: true,
          creditsCost: true,
          createdAt: true,
        },
      }),
    ]);

    const merged: Array<AdminUserCreationItem & { _createdAt: Date }> = [
      ...imageItems.map((t) => ({
        id: t.id.toString(),
        type: 'image' as const,
        prompt: t.prompt,
        status: t.status,
        url: t.resultUrl ?? null,
        thumbnailUrl: t.thumbnailUrl ?? null,
        creditsUsed: t.creditsCost ?? 0,
        createdAt: t.createdAt.toISOString(),
        _createdAt: t.createdAt,
      })),
      ...videoItems.map((t) => ({
        id: t.id.toString(),
        type: 'video' as const,
        prompt: t.prompt,
        status: t.status,
        url: t.resultUrl ?? null,
        thumbnailUrl: t.thumbnailUrl ?? null,
        creditsUsed: t.creditsCost ?? 0,
        createdAt: t.createdAt.toISOString(),
        _createdAt: t.createdAt,
      })),
    ].sort((a, b) => b._createdAt.getTime() - a._createdAt.getTime());

    const start = (page - 1) * pageSize;
    const items = merged.slice(start, start + pageSize).map(({ _createdAt: _omit, ...rest }) => rest);

    const total = imageTotal + videoTotal;
    const totalPages = Math.ceil(total / pageSize);
    return { items, total, page, pageSize, totalPages };
  }
}
