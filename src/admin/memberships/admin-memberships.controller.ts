import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminMembershipsService } from './admin-memberships.service';
import { CreateMembershipLevelDto } from './dto/create-membership-level.dto';
import { UpdateMembershipChatModelQuotasDto } from './dto/update-membership-chat-model-quotas.dto';
import { UpdateMembershipLevelDto } from './dto/update-membership-level.dto';
import { UpdateMembershipProjectQuotaDto } from './dto/update-membership-project-quota.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/memberships')
export class AdminMembershipsController {
  constructor(private readonly membershipsService: AdminMembershipsService) {}

  @Get()
  list() {
    return this.membershipsService.list();
  }

  @Post()
  create(@Body() dto: CreateMembershipLevelDto) {
    return this.membershipsService.create(dto);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.membershipsService.detail(BigInt(id));
  }

  @Get(':id/chat-model-quotas')
  chatModelQuotas(@Param('id') id: string) {
    return this.membershipsService.chatModelQuotas(BigInt(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMembershipLevelDto) {
    return this.membershipsService.update(BigInt(id), dto);
  }

  @Put(':id/chat-model-quotas')
  updateChatModelQuotas(@Param('id') id: string, @Body() dto: UpdateMembershipChatModelQuotasDto) {
    return this.membershipsService.updateChatModelQuotas(BigInt(id), dto);
  }

  @Get(':id/project-quota')
  getProjectQuota(@Param('id') id: string) {
    return this.membershipsService.getProjectQuota(BigInt(id));
  }

  @Put(':id/project-quota')
  updateProjectQuota(@Param('id') id: string, @Body() dto: UpdateMembershipProjectQuotaDto) {
    return this.membershipsService.updateProjectQuota(BigInt(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.membershipsService.remove(BigInt(id));
  }
}
