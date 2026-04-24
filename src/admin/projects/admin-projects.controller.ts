import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminProjectsService } from './admin-projects.service';
import { ListAdminProjectsDto } from './dto/list-admin-projects.dto';
import { UpdateFreeProjectQuotaDto } from './dto/update-free-project-quota.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/projects')
export class AdminProjectsController {
  constructor(private readonly projectsService: AdminProjectsService) {}

  @Get()
  list(@Query() dto: ListAdminProjectsDto) {
    return this.projectsService.listProjects(dto);
  }

  @Get('free-quota')
  getFreeQuota() {
    return this.projectsService.getFreeProjectQuota();
  }

  @Put('free-quota')
  updateFreeQuota(@Body() dto: UpdateFreeProjectQuotaDto) {
    return this.projectsService.updateFreeProjectQuota(dto);
  }
}
