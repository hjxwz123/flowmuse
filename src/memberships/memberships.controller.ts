import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MembershipsService } from './memberships.service';

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get('levels')
  listLevels() {
    return this.membershipsService.listActiveLevels();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  myMembership(@CurrentUser('id') userId: bigint) {
    return this.membershipsService.getUserMembership(userId);
  }
}

