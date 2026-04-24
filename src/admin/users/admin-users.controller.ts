import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdjustCreditsDto } from './dto/adjust-credits.dto';
import { GrantMembershipDto } from './dto/grant-membership.dto';
import { SendUserMessageDto } from './dto/send-user-message.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AdminUsersService } from './admin-users.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.usersService.list({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.usersService.detail(BigInt(id));
  }

  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.updateStatus(BigInt(id), dto);
  }

  @Post(':id/credits')
  adjustCredits(@Param('id') id: string, @Body() dto: AdjustCreditsDto) {
    return this.usersService.adjustCredits(BigInt(id), dto);
  }

  @Post(':id/membership')
  grantMembership(@Param('id') id: string, @Body() dto: GrantMembershipDto) {
    return this.usersService.grantMembership(BigInt(id), dto);
  }

  @Post(':id/messages')
  sendCustomMessage(
    @CurrentUser('id') adminId: bigint,
    @Param('id') id: string,
    @Body() dto: SendUserMessageDto,
  ) {
    return this.usersService.sendCustomMessage(BigInt(id), adminId, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('id') adminId: bigint,
    @Param('id') id: string,
  ) {
    return this.usersService.removeUser(BigInt(id), adminId);
  }

  @Get(':id/credits/transactions')
  creditTransactions(@Param('id') id: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.usersService.creditTransactions(BigInt(id), {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get(':id/creations')
  creations(@Param('id') id: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.usersService.creations(BigInt(id), {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }
}
