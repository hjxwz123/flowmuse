import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BatchRedeemCodeDto } from './dto/batch-redeem-code.dto';
import { CreateRedeemCodeDto } from './dto/create-redeem-code.dto';
import { UpdateRedeemCodeDto } from './dto/update-redeem-code.dto';
import { AdminRedeemCodesService } from './admin-redeem-codes.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/redeem-codes')
export class AdminRedeemCodesController {
  constructor(private readonly redeemCodesService: AdminRedeemCodesService) {}

  @Get()
  list() {
    return this.redeemCodesService.list();
  }

  @Post()
  create(@Body() dto: CreateRedeemCodeDto) {
    return this.redeemCodesService.create(dto);
  }

  @Post('batch')
  batch(@Body() dto: BatchRedeemCodeDto) {
    return this.redeemCodesService.batch(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRedeemCodeDto) {
    return this.redeemCodesService.update(BigInt(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.redeemCodesService.remove(BigInt(id));
  }

  @Get(':id/logs')
  logs(@Param('id') id: string) {
    return this.redeemCodesService.logs(BigInt(id));
  }

  @Get('export')
  exportAll() {
    return this.redeemCodesService.exportAll();
  }
}

