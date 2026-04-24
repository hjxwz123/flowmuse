import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RedeemDto } from './dto/redeem.dto';
import { RedeemService } from './redeem.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class RedeemController {
  constructor(private readonly redeemService: RedeemService) {}

  @Post('redeem')
  redeem(@CurrentUser('id') userId: bigint, @Body() dto: RedeemDto) {
    return this.redeemService.redeem(userId, dto);
  }

  @Get('redeem/history')
  history(@CurrentUser('id') userId: bigint) {
    return this.redeemService.history(userId);
  }
}

