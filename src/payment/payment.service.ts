import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MembershipPeriod, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import axios from 'axios';

import { InboxService } from '../inbox/inbox.service';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../settings/system-settings.service';

const WXPAY_BASE = 'https://api.mch.weixin.qq.com';

type UserOrderRow = {
  orderNo: string;
  status: string;
  orderType: string | null;
  amount: number | string | bigint;
  credits: number | string | bigint | null;
  packageName: string | null;
  packageType: string | null;
  membershipName: string | null;
  membershipPeriod: MembershipPeriod | null;
  paidAt: Date | null;
  expireAt: Date;
  createdAt: Date;
};

type CountRow = {
  total: number | string | bigint;
};

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SystemSettingsService,
    private readonly inbox: InboxService,
    private readonly memberships: MembershipsService,
  ) {}

  private toSafeNumber(value: number | string | bigint | null | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string' && value.trim().length > 0) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }

  private normalizeOrderStatus(status: string | null | undefined): 'pending' | 'paid' | 'failed' | 'expired' {
    const s = (status ?? '').toLowerCase();

    if (s === 'pending' || s === 'paid' || s === 'failed' || s === 'expired') {
      return s;
    }

    // 兼容历史状态值，避免旧数据导致列表异常
    if (s === 'success' || s === 'succeeded' || s === 'completed') return 'paid';
    if (s === 'cancelled' || s === 'canceled' || s === 'error') return 'failed';

    return 'pending';
  }

  private formatUserOrders(
    rows: UserOrderRow[],
    page: number,
    limit: number,
    total: number,
  ) {
    const totalPages = Math.ceil(total / limit);
    return {
      data: rows.map((row) => ({
        ...(((row.orderType === 'membership') || Boolean(row.membershipPeriod && row.membershipName))
          ? {
              packageName: row.membershipName
                ? `${row.membershipName}会员${row.membershipPeriod === MembershipPeriod.yearly ? '（年付）' : '（月付）'}`
                : '会员购买',
              membershipPeriod: row.membershipPeriod ?? null,
            }
          : {
              packageName: row.packageName ?? '自定义积分',
              membershipPeriod: null,
            }),
        orderNo: row.orderNo,
        status: this.normalizeOrderStatus(row.status),
        orderType: ((row.orderType === 'membership') || Boolean(row.membershipPeriod && row.membershipName))
          ? 'membership'
          : (row.orderType ?? 'package'),
        amount: this.toSafeNumber(row.amount),
        credits: row.credits == null ? null : this.toSafeNumber(row.credits),
        packageType: row.packageType ?? null,
        paidAt: row.paidAt,
        expireAt: row.expireAt,
        createdAt: row.createdAt,
      })),
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    };
  }

  private async listUserOrdersFallback(userId: bigint, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [rows, totals] = await Promise.all([
      this.prisma.$queryRaw<UserOrderRow[]>(
        Prisma.sql`
          SELECT
            po.order_no AS orderNo,
            po.status AS status,
            po.order_type AS orderType,
            po.amount AS amount,
            po.credits AS credits,
            p.name AS packageName,
            p.package_type AS packageType,
            ml.name AS membershipName,
            po.membership_period AS membershipPeriod,
            po.paid_at AS paidAt,
            po.expire_at AS expireAt,
            po.created_at AS createdAt
          FROM payment_orders po
          LEFT JOIN packages p ON p.id = po.package_id
          LEFT JOIN membership_levels ml ON ml.id = po.membership_level_id
          WHERE po.user_id = ${userId}
          ORDER BY po.created_at DESC
          LIMIT ${limit}
          OFFSET ${skip}
        `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
          SELECT COUNT(1) AS total
          FROM payment_orders po
          WHERE po.user_id = ${userId}
        `,
      ),
    ]);

    const total = this.toSafeNumber(totals[0]?.total);
    return this.formatUserOrders(rows, page, limit, total);
  }

  private genOrderNo(): string {
    const now = new Date();
    const ts = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `AI${ts}${rand}`;
  }

  private async getPaymentSiteTitle(): Promise<string> {
    const siteSettings = await this.settings.getPublicSettings();
    const title = siteSettings.siteTitle?.trim();
    return title || 'AI 创作平台';
  }

  private buildAuthHeader(method: string, urlPath: string, body: string, mchId: string, serialNo: string, privateKey: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
    const sign = crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64');
    return `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${sign}"`;
  }

  private async awardInvitePaymentCredits(
    tx: Prisma.TransactionClient,
    input: {
      inviterId?: bigint | null;
      inviteeId: bigint;
      orderNo: string;
      orderAmountFen: number;
      creditsPerYuan: number;
    },
  ): Promise<number> {
    if (!input.inviterId) return 0;

    const rewardCredits = Math.max(0, Math.ceil((input.orderAmountFen * Math.max(0, input.creditsPerYuan)) / 100));
    const eventKey = `payment:${input.orderNo}`;

    try {
      await tx.inviteRewardLog.create({
        data: {
          eventKey,
          inviterId: input.inviterId,
          inviteeId: input.inviteeId,
          rewardType: 'payment',
          inviterRewardCredits: rewardCredits,
          inviteeRewardCredits: 0,
          orderNo: input.orderNo,
          orderAmountFen: input.orderAmountFen,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return 0;
      }
      throw error;
    }

    if (rewardCredits <= 0) return 0;

    const inviter = await tx.user.update({
      where: { id: input.inviterId },
      data: { permanentCredits: { increment: rewardCredits } },
      select: { permanentCredits: true },
    });

    await tx.creditLog.create({
      data: {
        userId: input.inviterId,
        amount: rewardCredits,
        balanceAfter: inviter.permanentCredits,
        type: 'redeem',
        source: 'permanent',
        description: `邀请消费返利 ${rewardCredits} 积分（订单 ${input.orderNo}）`,
      },
    });

    return rewardCredits;
  }

  private async doCreateWxOrder(description: string, orderNo: string, amountFen: number, notifyUrl: string, cfg: any): Promise<string> {
    const expireAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const reqBody = JSON.stringify({
      appid: cfg.appId, mchid: cfg.mchId,
      description,
      out_trade_no: orderNo,
      notify_url: notifyUrl,
      time_expire: expireAt.toISOString().replace('.000Z', '+08:00'),
      amount: { total: amountFen, currency: 'CNY' },
    });
    const urlPath = '/v3/pay/transactions/native';
    const auth = this.buildAuthHeader('POST', urlPath, reqBody, cfg.mchId, cfg.serialNo, cfg.privateKey);
    try {
      const resp = await axios.post(`${WXPAY_BASE}${urlPath}`, reqBody, {
        headers: { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      return resp.data.code_url;
    } catch (e: any) {
      this.logger.error('WechatPay create order failed', e?.response?.data ?? e?.message);
      throw new BadRequestException('创建支付订单失败，请稍后重试');
    }
  }

  /** 创建套餐购买订单 */
  async createOrder(userId: bigint, packageId: string) {
    const cfg = await this.settings.getWechatPaySettings();
    if (!cfg.enabled) throw new BadRequestException('微信支付未启用');
    if (!cfg.appId || !cfg.mchId || !cfg.apiV3Key || !cfg.privateKey || !cfg.serialNo || !cfg.notifyUrl)
      throw new BadRequestException('微信支付配置不完整，请联系管理员');

    const pkg = await this.prisma.package.findUnique({
      where: {
        id: BigInt(packageId),
        isActive: true,
        packageType: 'credits',
      },
    });
    if (!pkg) throw new NotFoundException('套餐不存在');

    const siteTitle = await this.getPaymentSiteTitle();
    const amountFen = Math.round(Number(pkg.price) * 100);
    const orderNo = this.genOrderNo();
    const expireAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const codeUrl = await this.doCreateWxOrder(`${siteTitle} - ${pkg.name}`, orderNo, amountFen, cfg.notifyUrl, cfg);

    const order = await this.prisma.paymentOrder.create({
      data: { orderNo, userId, packageId: BigInt(packageId), orderType: 'package', amount: amountFen, codeUrl, expireAt },
    });
    return { orderNo: order.orderNo, codeUrl, amount: amountFen, expireAt };
  }

  /** 创建自定义积分购买订单 */
  async createCreditsOrder(userId: bigint, credits: number) {
    const siteSettings = await this.settings.getPublicSettings();
    const siteTitle = siteSettings.siteTitle?.trim() || 'AI 创作平台';
    if (!siteSettings.creditBuyEnabled) throw new BadRequestException('积分购买未启用');

    const { creditBuyRatePerYuan, creditBuyMinCredits, creditBuyMaxCredits } = siteSettings;
    if (credits < creditBuyMinCredits) throw new BadRequestException(`最少购买 ${creditBuyMinCredits} 积分`);
    if (credits > creditBuyMaxCredits) throw new BadRequestException(`最多购买 ${creditBuyMaxCredits} 积分`);

    const cfg = await this.settings.getWechatPaySettings();
    if (!cfg.enabled) throw new BadRequestException('微信支付未启用');
    if (!cfg.appId || !cfg.mchId || !cfg.apiV3Key || !cfg.privateKey || !cfg.serialNo || !cfg.notifyUrl)
      throw new BadRequestException('微信支付配置不完整');

    const amountFen = Math.ceil((credits / creditBuyRatePerYuan) * 100);
    const orderNo = this.genOrderNo();
    const expireAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const codeUrl = await this.doCreateWxOrder(`${siteTitle} - ${credits}积分`, orderNo, amountFen, cfg.notifyUrl, cfg);

    const order = await this.prisma.paymentOrder.create({
      data: { orderNo, userId, packageId: undefined, credits, orderType: 'custom_credits', amount: amountFen, codeUrl, expireAt },
    });
    return { orderNo: order.orderNo, codeUrl, amount: amountFen, expireAt };
  }

  /** 创建会员购买订单 */
  async createMembershipOrder(userId: bigint, levelId: string, period: 'monthly' | 'yearly') {
    const cfg = await this.settings.getWechatPaySettings();
    if (!cfg.enabled) throw new BadRequestException('微信支付未启用');
    if (!cfg.appId || !cfg.mchId || !cfg.apiV3Key || !cfg.privateKey || !cfg.serialNo || !cfg.notifyUrl)
      throw new BadRequestException('微信支付配置不完整');

    const membershipPeriod = period === 'yearly' ? MembershipPeriod.yearly : MembershipPeriod.monthly;

    let membershipLevelId: bigint;
    try {
      membershipLevelId = BigInt(levelId);
    } catch {
      throw new BadRequestException('无效的会员等级ID');
    }

    const level = await this.prisma.membershipLevel.findUnique({
      where: { id: membershipLevelId },
    });
    if (!level || !level.isActive) throw new NotFoundException('会员等级不存在或已禁用');

    const amountYuan = membershipPeriod === MembershipPeriod.yearly ? Number(level.yearlyPrice) : Number(level.monthlyPrice);
    const amountFen = Math.round(amountYuan * 100);

    const siteTitle = await this.getPaymentSiteTitle();
    const orderNo = this.genOrderNo();
    const expireAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const periodLabel = membershipPeriod === MembershipPeriod.yearly ? '年付' : '月付';
    const codeUrl = await this.doCreateWxOrder(`${siteTitle} - ${level.name}${periodLabel}会员`, orderNo, amountFen, cfg.notifyUrl, cfg);

    const order = await this.prisma.paymentOrder.create({
      data: {
        orderNo,
        userId,
        orderType: 'membership',
        amount: amountFen,
        codeUrl,
        expireAt,
        membershipLevelId,
        membershipPeriod,
      },
    });
    return { orderNo: order.orderNo, codeUrl, amount: amountFen, expireAt };
  }

  async getOrder(userId: bigint, orderNo: string) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { orderNo } });
    if (!order || order.userId !== userId) throw new NotFoundException('订单不存在');
    return { orderNo: order.orderNo, status: order.status, amount: order.amount, paidAt: order.paidAt, expireAt: order.expireAt };
  }

  /** 获取用户订单列表 */
  async listUserOrders(userId: bigint, page = 1, limit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;
    const skip = (safePage - 1) * safeLimit;
    const where = { userId };
    try {
      const [orders, total] = await Promise.all([
        this.prisma.paymentOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: safeLimit,
          include: {
            package: { select: { name: true, packageType: true } },
            membershipLevel: { select: { name: true } },
          },
        }),
        this.prisma.paymentOrder.count({ where }),
      ]);

      return this.formatUserOrders(
        orders.map((o) => ({
          orderNo: o.orderNo,
          status: o.status,
          orderType: (o as any).orderType ?? 'package',
          amount: o.amount,
          credits: (o as any).credits ?? null,
          packageName: o.package?.name ?? '自定义积分',
          packageType: o.package?.packageType ?? null,
          membershipName: o.membershipLevel?.name ?? null,
          membershipPeriod: o.membershipPeriod ?? null,
          paidAt: o.paidAt,
          expireAt: o.expireAt,
          createdAt: o.createdAt,
        })),
        safePage,
        safeLimit,
        total,
      );
    } catch (error: any) {
      this.logger.warn(
        `listUserOrders prisma query failed, fallback to raw query: ${error?.message ?? String(error)}`,
      );
      return this.listUserOrdersFallback(userId, safePage, safeLimit);
    }
  }

  async handleNotify(headers: Record<string, string>, rawBody: string): Promise<void> {
    const cfg = await this.settings.getWechatPaySettings();
    if (!cfg.enabled || !cfg.apiV3Key) return;
    const publicSettings = await this.settings.getPublicSettings();

    let payload: any;
    try { payload = JSON.parse(rawBody); } catch { this.logger.warn('Invalid notify body'); return; }
    if (payload.event_type !== 'TRANSACTION.SUCCESS') return;

    const { ciphertext, nonce, associated_data } = payload.resource;
    let transaction: any;
    try {
      const key = Buffer.from(cfg.apiV3Key, 'utf8');
      const cipherBuf = Buffer.from(ciphertext, 'base64');
      const authTag = cipherBuf.slice(cipherBuf.length - 16);
      const data = cipherBuf.slice(0, cipherBuf.length - 16);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf8'));
      decipher.setAuthTag(authTag);
      decipher.setAAD(Buffer.from(associated_data, 'utf8'));
      transaction = JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
    } catch (e) { this.logger.error('Decrypt notify failed', e); return; }

    const { out_trade_no, trade_state, transaction_id } = transaction;
    if (trade_state !== 'SUCCESS') return;

    const order = await this.prisma.paymentOrder.findUnique({
      where: { orderNo: out_trade_no },
      include: {
        package: { select: { packageType: true, totalCredits: true, name: true } },
        membershipLevel: { select: { id: true, name: true, bonusPermanentCredits: true } },
        user: { select: { invitedById: true } },
      },
    });
    if (!order || order.status !== 'pending') return;

    type PaymentInboxMessage = {
      type: string;
      title: string;
      content: string;
      level?: 'success' | 'info' | 'error';
      meta: Prisma.JsonObject;
    };

    const inboxMessage = await this.prisma.$transaction<PaymentInboxMessage | null>(async (tx) => {
      await tx.paymentOrder.update({
        where: { orderNo: out_trade_no },
        data: { status: 'paid', transactionId: transaction_id, paidAt: new Date() },
      });

      const hasMembershipPayload = Boolean(order.membershipLevelId && order.membershipPeriod);
      const hasCreditsPayload = typeof order.credits === 'number' && order.credits > 0;
      const hasPackagePayload = Boolean(order.packageId && order.package);

      // 会员订单优先根据 membership 字段识别，避免历史/异常数据中 orderType 写错导致漏开通。
      if (hasMembershipPayload) {
        if (order.orderType !== 'membership') {
          this.logger.warn(
            `Membership fulfillment fallback by payload: order=${out_trade_no}, orderType=${order.orderType ?? 'null'}`,
          );
        }

        const activateResult = await this.memberships.activatePaidMembership(
          tx,
          order.userId,
          order.membershipLevelId!,
          order.membershipPeriod!,
          order.amount,
        );

        const bonusPermanentCredits = this.memberships.calculateMembershipBonusCredits(
          activateResult.level?.bonusPermanentCredits ?? 0,
          order.membershipPeriod!,
          1,
        );
        if (bonusPermanentCredits > 0) {
          const updatedUser = await tx.user.update({
            where: { id: order.userId },
            data: { permanentCredits: { increment: bonusPermanentCredits } },
            select: { permanentCredits: true },
          });

          await tx.creditLog.create({
            data: {
              userId: order.userId,
              amount: bonusPermanentCredits,
              balanceAfter: updatedUser.permanentCredits,
              type: 'redeem',
              source: 'permanent',
              description: `购买会员赠送永久积分 ${bonusPermanentCredits} (订单 ${out_trade_no})`,
            },
          });
        }

        await this.awardInvitePaymentCredits(tx, {
          inviterId: order.user.invitedById,
          inviteeId: order.userId,
          orderNo: out_trade_no,
          orderAmountFen: order.amount,
          creditsPerYuan: publicSettings.invitePaymentCreditsPerYuan,
        });

        const periodLabel = order.membershipPeriod === MembershipPeriod.yearly ? '年付' : '月付';
        const membershipTitle = activateResult.mode === 'scheduled'
          ? '会员购买成功'
          : activateResult.mode === 'renewed'
            ? '会员续费成功'
            : activateResult.mode === 'upgraded'
              ? '会员升级成功'
              : '会员购买成功';
        const membershipContent = activateResult.mode === 'scheduled'
          ? `你已成功购买${activateResult.level?.name ? `「${activateResult.level.name}」` : ''}${periodLabel}会员，将在当前会员及已排队会员结束后生效。预计生效时间：${activateResult.startsAt.toLocaleString('zh-CN')}，预计到期时间：${activateResult.expireAt.toLocaleString('zh-CN')}。${bonusPermanentCredits > 0 ? `并获得永久积分 ${bonusPermanentCredits}。` : ''}订单号：${out_trade_no}`
          : activateResult.mode === 'renewed'
            ? `你已成功续费${activateResult.level?.name ? `「${activateResult.level.name}」` : ''}${periodLabel}会员。新的到期时间：${activateResult.expireAt.toLocaleString('zh-CN')}。${bonusPermanentCredits > 0 ? `并获得永久积分 ${bonusPermanentCredits}。` : ''}订单号：${out_trade_no}`
            : activateResult.mode === 'upgraded'
              ? `你已成功升级为${activateResult.level?.name ? `「${activateResult.level.name}」` : ''}${periodLabel}会员。新的到期时间：${activateResult.expireAt.toLocaleString('zh-CN')}。${bonusPermanentCredits > 0 ? `并获得永久积分 ${bonusPermanentCredits}。` : ''}订单号：${out_trade_no}`
              : `你已成功开通${activateResult.level?.name ? `「${activateResult.level.name}」` : ''}${periodLabel}会员。到期时间：${activateResult.expireAt.toLocaleString('zh-CN')}。${bonusPermanentCredits > 0 ? `并获得永久积分 ${bonusPermanentCredits}。` : ''}订单号：${out_trade_no}`;
        return {
          type: 'payment_success',
          level: 'success',
          title: membershipTitle,
          content: membershipContent,
          meta: {
            action: 'payment_membership',
            orderNo: out_trade_no,
            membershipLevelId: order.membershipLevelId?.toString() ?? null,
            membershipPeriod: order.membershipPeriod,
            membershipActionMode: activateResult.mode,
            startsAt: activateResult.startsAt.toISOString(),
            expireAt: activateResult.expireAt.toISOString(),
            bonusPermanentCredits,
          },
        };

      } else if (order.orderType === 'custom_credits' && hasCreditsPayload) {
        // 自定义积分购买 → 直接增加永久积分
        const creditsToAdd = order.credits;
        if (typeof creditsToAdd !== 'number') return null;
        await tx.user.update({ where: { id: order.userId }, data: { permanentCredits: { increment: creditsToAdd } } });
        await tx.creditLog.create({ data: { userId: order.userId, amount: creditsToAdd, balanceAfter: 0, type: 'redeem', source: 'permanent', description: `购买积分 ${creditsToAdd} (订单 ${out_trade_no})` } });

        await this.awardInvitePaymentCredits(tx, {
          inviterId: order.user.invitedById,
          inviteeId: order.userId,
          orderNo: out_trade_no,
          orderAmountFen: order.amount,
          creditsPerYuan: publicSettings.invitePaymentCreditsPerYuan,
        });
        return {
          type: 'payment_success',
          level: 'success',
          title: '积分购买成功',
          content: `你已成功购买积分 ${creditsToAdd}。订单号：${out_trade_no}`,
          meta: {
            action: 'payment_custom_credits',
            orderNo: out_trade_no,
            credits: creditsToAdd,
          },
        };

      } else if (order.orderType === 'package' && hasPackagePayload) {
        const pkg = order.package;
        if (!pkg) return null;
        if (pkg.packageType !== 'credits') {
          this.logger.warn(
            `Skip non-credits package fulfillment (legacy order): order=${out_trade_no}, packageType=${pkg.packageType}`,
          );
          return null;
        }

        // 积分充值套餐 → 增加永久积分
        const updatedUser = await tx.user.update({
          where: { id: order.userId },
          data: { permanentCredits: { increment: pkg.totalCredits } },
          select: { permanentCredits: true },
        });
        await tx.creditLog.create({
          data: {
            userId: order.userId,
            amount: pkg.totalCredits,
            balanceAfter: updatedUser.permanentCredits,
            type: 'redeem',
            source: 'permanent',
            description: `购买积分套餐 ${pkg.name} (订单 ${out_trade_no})`,
          },
        });

        await this.awardInvitePaymentCredits(tx, {
          inviterId: order.user.invitedById,
          inviteeId: order.userId,
          orderNo: out_trade_no,
          orderAmountFen: order.amount,
          creditsPerYuan: publicSettings.invitePaymentCreditsPerYuan,
        });
        return {
          type: 'payment_success',
          level: 'success',
          title: '积分套餐购买成功',
          content: `你已成功购买积分套餐「${pkg.name}」，获得永久积分 ${pkg.totalCredits}。订单号：${out_trade_no}`,
          meta: {
            action: 'payment_package_credits',
            orderNo: out_trade_no,
            packageName: pkg.name,
            credits: pkg.totalCredits,
          },
        };
      } else {
        // 防止异常数据被静默吞掉，保留告警便于排查。
        this.logger.warn(
          `Paid order has no fulfillable payload: order=${out_trade_no}, orderType=${order.orderType}, packageId=${String(order.packageId ?? '')}, credits=${String(order.credits ?? '')}, membershipLevelId=${String(order.membershipLevelId ?? '')}, membershipPeriod=${String(order.membershipPeriod ?? '')}`,
        );
        return null;
      }
    });

    if (inboxMessage) {
      await this.inbox.sendSystemMessage({
        userId: order.userId,
        type: inboxMessage.type,
        level: inboxMessage.level ?? 'success',
        title: inboxMessage.title,
        content: inboxMessage.content,
        dedupKey: `payment:${out_trade_no}`,
        meta: inboxMessage.meta,
      });
    }

    this.logger.log(`Payment success: order=${out_trade_no}, txn=${transaction_id}`);
  }
}
