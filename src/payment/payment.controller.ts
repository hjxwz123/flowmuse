import { Body, Controller, Get, Headers, HttpCode, Logger, Param, Post, Query, RawBodyRequest, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaymentService } from './payment.service';

@Controller('pay')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  /** 创建订单（需登录） */
  @UseGuards(JwtAuthGuard)
  @Post('orders')
  createOrder(
    @CurrentUser('id') userId: bigint,
    @Body('packageId') packageId: string,
  ) {
    return this.paymentService.createOrder(userId, packageId);
  }

  /** 创建自定义积分购买订单 */
  @UseGuards(JwtAuthGuard)
  @Post('orders/credits')
  createCreditsOrder(
    @CurrentUser('id') userId: bigint,
    @Body('credits') credits: number,
  ) {
    return this.paymentService.createCreditsOrder(userId, Number(credits));
  }

  /** 创建会员购买订单 */
  @UseGuards(JwtAuthGuard)
  @Post('orders/membership')
  createMembershipOrder(
    @CurrentUser('id') userId: bigint,
    @Body('levelId') levelId: string,
    @Body('period') period: 'monthly' | 'yearly',
  ) {
    return this.paymentService.createMembershipOrder(userId, levelId, period);
  }

  /** 获取当前用户订单列表（需登录） */
  @UseGuards(JwtAuthGuard)
  @Get('orders')
  listOrders(
    @CurrentUser('id') userId: bigint,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentService.listUserOrders(userId, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  /** 查询订单状态（需登录） */
  @UseGuards(JwtAuthGuard)
  @Get('orders/:orderNo')
  getOrder(
    @CurrentUser('id') userId: bigint,
    @Param('orderNo') orderNo: string,
  ) {
    return this.paymentService.getOrder(userId, orderNo);
  }

  /**
   * 微信支付回调（公开接口，微信服务器调用）
   * V3 规范：立即 204 应答，然后异步处理业务逻辑（避免 5s 超时）
   */
  @HttpCode(204)
  @Post('notify/wechat')
  async wechatNotify(
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? '';

    // ─── 调试日志 ───────────────────────────────────────────────────────────
    this.logger.log('✅ 收到微信回调请求');
    this.logger.log(`Headers: ${JSON.stringify({
      'wechatpay-serial': headers['wechatpay-serial'],
      'wechatpay-timestamp': headers['wechatpay-timestamp'],
      'wechatpay-nonce': headers['wechatpay-nonce'],
      'content-type': headers['content-type'],
    })}`);
    this.logger.log(`rawBody 长度: ${rawBody.length}`);
    if (rawBody.length > 0) {
      try {
        const parsed = JSON.parse(rawBody);
        this.logger.log(`event_type: ${parsed.event_type}`);
        this.logger.log(`resource.algorithm: ${parsed.resource?.algorithm}`);
      } catch {
        this.logger.warn(`rawBody 解析失败（非 JSON）: ${rawBody.slice(0, 200)}`);
      }
    } else {
      this.logger.warn('⚠️ rawBody 为空！可能是 bodyParser 配置问题');
    }
    // ─────────────────────────────────────────────────────────────────────────

    // 立即响应 204（V3 规范：成功应答无需正文），再异步处理业务
    res.status(204).end();

    // 异步处理，不阻塞响应
    this.paymentService.handleNotify(headers, rawBody).catch(err => {
      this.logger.error(`handleNotify 异常: ${err}`);
    });
  }
}
