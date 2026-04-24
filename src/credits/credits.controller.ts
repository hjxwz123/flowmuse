import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreditLogsQueryDto } from './dto/credit-logs-query.dto';
import { CreditsService } from './credits.service';

@UseGuards(JwtAuthGuard)
@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('balance')
  balance(@CurrentUser('id') userId: bigint) {
    return this.creditsService.getBalance(userId);
  }

  @Get('logs')
  logs(@CurrentUser('id') userId: bigint, @Query() query: CreditLogsQueryDto) {
    return this.creditsService.getLogs(userId, query);
  }
}

