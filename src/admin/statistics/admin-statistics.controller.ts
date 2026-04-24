import { Controller, Get, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminStatisticsService } from './admin-statistics.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/statistics')
export class AdminStatisticsController {
  constructor(private readonly statsService: AdminStatisticsService) {}

  @Get('overview')
  overview() {
    return this.statsService.overview();
  }

  @Get('redeem')
  redeem() {
    return this.statsService.redeem();
  }

  @Get('tasks')
  tasks() {
    return this.statsService.tasks();
  }

  @Get('channels')
  channels() {
    return this.statsService.channels();
  }
}

