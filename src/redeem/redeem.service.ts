import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipPeriod, Prisma, RedeemCodeStatus, RedeemCodeType } from '@prisma/client';

import { InboxService } from '../inbox/inbox.service';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedeemDto } from './dto/redeem.dto';

type RedeemErrorCode =
  | 'REDEEM_CODE_NOT_FOUND'
  | 'REDEEM_CODE_DISABLED'
  | 'REDEEM_CODE_EXPIRED'
  | 'REDEEM_CODE_EXHAUSTED'
  | 'REDEEM_CODE_ALREADY_USED_BY_USER'
  | 'REDEEM_CODE_INVALID_CREDITS'
  | 'REDEEM_CODE_INVALID_MEMBERSHIP'
  | 'REDEEM_MEMBERSHIP_LEVEL_INACTIVE';

function redeemErrorPayload(errorCode: RedeemErrorCode, message: string) {
  return {
    message,
    data: { errorCode },
  };
}

@Injectable()
export class RedeemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
    private readonly memberships: MembershipsService,
  ) {}

  private normalizeMembershipCycles(value: number | null | undefined) {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.floor(Number(value)));
  }

  async redeem(userId: bigint, dto: RedeemDto) {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<Array<{ id: bigint }>>(
        Prisma.sql`
          SELECT id
          FROM redeem_codes
          WHERE code = ${dto.code}
          LIMIT 1
          FOR UPDATE
        `,
      );

      const lockedCodeId = lockedRows[0]?.id;
      if (!lockedCodeId) {
        throw new NotFoundException(
          redeemErrorPayload('REDEEM_CODE_NOT_FOUND', 'Redeem code not found'),
        );
      }

      const code = await tx.redeemCode.findUnique({
        where: { id: lockedCodeId },
        include: {
          membershipLevel: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              isActive: true,
              bonusPermanentCredits: true,
            },
          },
        },
      });

      if (!code) {
        throw new NotFoundException(
          redeemErrorPayload('REDEEM_CODE_NOT_FOUND', 'Redeem code not found'),
        );
      }

      const existingLog = await tx.redeemLog.findFirst({
        where: {
          userId,
          codeId: code.id,
        },
        select: { id: true },
      });
      if (existingLog) {
        throw new ForbiddenException(
          redeemErrorPayload(
            'REDEEM_CODE_ALREADY_USED_BY_USER',
            'Redeem code already used by this user',
          ),
        );
      }
      if (code.status === RedeemCodeStatus.disabled) {
        throw new ForbiddenException(
          redeemErrorPayload('REDEEM_CODE_DISABLED', 'Redeem code disabled'),
        );
      }
      if (code.expireDate && code.expireDate < now) {
        throw new ForbiddenException(
          redeemErrorPayload('REDEEM_CODE_EXPIRED', 'Redeem code expired'),
        );
      }
      if (code.usedCount >= code.maxUseCount) {
        throw new ForbiddenException(
          redeemErrorPayload('REDEEM_CODE_EXHAUSTED', 'Redeem code exhausted'),
        );
      }
      if (code.status === RedeemCodeStatus.expired) {
        throw new ForbiddenException(
          redeemErrorPayload('REDEEM_CODE_EXPIRED', 'Redeem code expired'),
        );
      }
      if (code.status !== RedeemCodeStatus.active) {
        throw new ForbiddenException(
          redeemErrorPayload('REDEEM_CODE_DISABLED', 'Redeem code not active'),
        );
      }

      const updatedCode = await tx.redeemCode.update({
        where: { id: code.id },
        data: {
          usedCount: { increment: 1 },
          status:
            code.usedCount + 1 >= code.maxUseCount
              ? RedeemCodeStatus.expired
              : code.status,
        },
      });

      if (code.type === RedeemCodeType.credits) {
        const credits = code.credits ?? 0;
        if (credits <= 0) {
          throw new BadRequestException(
            redeemErrorPayload(
              'REDEEM_CODE_INVALID_CREDITS',
              'Invalid credits on code',
            ),
          );
        }

        const user = await tx.user.update({
          where: { id: userId },
          data: { permanentCredits: { increment: credits } },
          select: { id: true, permanentCredits: true },
        });

        await tx.redeemLog.create({
          data: {
            userId,
            codeId: code.id,
            code: code.code,
            type: code.type,
            credits,
          },
        });

        await tx.creditLog.create({
          data: {
            userId,
            amount: credits,
            balanceAfter: user.permanentCredits,
            type: 'redeem',
            source: 'permanent',
            description: `Redeem code ${code.code}`,
          },
        });

        return {
          ok: true,
          type: code.type,
          credits,
          code: updatedCode.code,
          inboxTitle: '兑换成功',
          inboxContent: `你已成功兑换积分 ${credits}。兑换码：${updatedCode.code}`,
          inboxAction: 'redeem_credits',
        };
      }

      if (!code.membershipLevelId || !code.membershipLevel || !code.membershipPeriod) {
        throw new BadRequestException(
          redeemErrorPayload(
            'REDEEM_CODE_INVALID_MEMBERSHIP',
            'Invalid membership payload on code',
          ),
        );
      }
      if (!code.membershipLevel.isActive) {
        throw new BadRequestException(
          redeemErrorPayload('REDEEM_MEMBERSHIP_LEVEL_INACTIVE', 'Membership level is inactive'),
        );
      }

      const membershipPeriod = code.membershipPeriod as MembershipPeriod;
      const membershipCycles = this.normalizeMembershipCycles(code.membershipCycles);

      const activationResult = await this.memberships.activateMembership(
        tx,
        userId,
        code.membershipLevelId,
        membershipPeriod,
        membershipCycles,
      );

      const bonusPermanentCredits = this.memberships.calculateMembershipBonusCredits(
        activationResult.level.bonusPermanentCredits,
        membershipPeriod,
        membershipCycles,
      );

      if (bonusPermanentCredits > 0) {
        const user = await tx.user.update({
          where: { id: userId },
          data: { permanentCredits: { increment: bonusPermanentCredits } },
          select: { permanentCredits: true },
        });

        await tx.creditLog.create({
          data: {
            userId,
            amount: bonusPermanentCredits,
            balanceAfter: user.permanentCredits,
            type: 'redeem',
            source: 'permanent',
            description: `会员兑换码赠送永久积分 ${bonusPermanentCredits} (${code.code})`,
          },
        });
      }

      await tx.redeemLog.create({
        data: {
          userId,
          codeId: code.id,
          code: code.code,
          type: code.type,
          membershipLevelId: code.membershipLevelId,
          membershipPeriod,
          membershipCycles,
          credits: bonusPermanentCredits > 0 ? bonusPermanentCredits : null,
        },
      });

      const periodLabel = membershipPeriod === MembershipPeriod.yearly ? '年付' : '月付';
      const inboxContent = activationResult.mode === 'scheduled'
        ? `你已成功兑换「${code.membershipLevel.name}」${periodLabel}会员（${membershipCycles}期），将在当前会员及已排队会员结束后生效。预计生效时间：${activationResult.startsAt.toLocaleString('zh-CN')}，预计到期时间：${activationResult.expireAt.toLocaleString('zh-CN')}${bonusPermanentCredits > 0 ? `，并获得永久积分 ${bonusPermanentCredits}` : ''}。兑换码：${updatedCode.code}`
        : activationResult.mode === 'renewed'
          ? `你已成功续费「${code.membershipLevel.name}」${periodLabel}会员（${membershipCycles}期），新的到期时间：${activationResult.expireAt.toLocaleString('zh-CN')}${bonusPermanentCredits > 0 ? `，并获得永久积分 ${bonusPermanentCredits}` : ''}。兑换码：${updatedCode.code}`
          : activationResult.mode === 'upgraded'
            ? `你已成功升级为「${code.membershipLevel.name}」${periodLabel}会员（${membershipCycles}期），新的到期时间：${activationResult.expireAt.toLocaleString('zh-CN')}${bonusPermanentCredits > 0 ? `，并获得永久积分 ${bonusPermanentCredits}` : ''}。兑换码：${updatedCode.code}`
            : `你已成功兑换「${code.membershipLevel.name}」${periodLabel}会员（${membershipCycles}期），到期时间：${activationResult.expireAt.toLocaleString('zh-CN')}${bonusPermanentCredits > 0 ? `，并获得永久积分 ${bonusPermanentCredits}` : ''}。兑换码：${updatedCode.code}`;
      return {
        ok: true,
        type: code.type,
        membershipLevelId: code.membershipLevelId,
        membershipLevelName: code.membershipLevel.name,
        membershipLevelNameEn: code.membershipLevel.nameEn,
        membershipPeriod,
        membershipCycles,
        expireAt: activationResult.expireAt,
        startsAt: activationResult.startsAt,
        activationMode: activationResult.mode,
        bonusPermanentCredits,
        code: updatedCode.code,
        inboxTitle: '兑换成功',
        inboxContent,
        inboxAction: 'redeem_membership',
      };
    });

    await this.inbox.sendSystemMessage({
      userId,
      type: 'redeem_success',
      level: 'success',
      title: result.inboxTitle,
      content: result.inboxContent,
      dedupKey: `redeem:${result.code}`,
      meta: {
        action: result.inboxAction,
        code: result.code,
        type: result.type,
        credits: (result as { credits?: number | null }).credits ?? null,
        membershipLevelId: (result as { membershipLevelId?: bigint | null }).membershipLevelId?.toString() ?? null,
        membershipLevelName: (result as { membershipLevelName?: string | null }).membershipLevelName ?? null,
        membershipLevelNameEn: (result as { membershipLevelNameEn?: string | null }).membershipLevelNameEn ?? null,
        membershipPeriod: (result as { membershipPeriod?: MembershipPeriod | null }).membershipPeriod ?? null,
        membershipCycles: (result as { membershipCycles?: number | null }).membershipCycles ?? null,
        activationMode: (result as { activationMode?: string | null }).activationMode ?? null,
        startsAt: (result as { startsAt?: Date | null }).startsAt?.toISOString() ?? null,
        expireAt: (result as { expireAt?: Date | null }).expireAt?.toISOString() ?? null,
      } satisfies Prisma.JsonObject,
    });

    const { inboxTitle: _title, inboxContent: _content, inboxAction: _action, ...publicResult } = result;
    return publicResult;
  }

  async history(userId: bigint) {
    return this.prisma.redeemLog.findMany({
      where: { userId },
      orderBy: { redeemedAt: 'desc' },
    });
  }
}
