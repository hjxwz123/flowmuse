import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { AdminPackagesService } from './admin-packages.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/packages')
export class AdminPackagesController {
  constructor(private readonly packagesService: AdminPackagesService) {}

  @Get()
  list() {
    return this.packagesService.list();
  }

  @Post()
  create(@Body() dto: CreatePackageDto) {
    return this.packagesService.create(dto);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.packagesService.detail(BigInt(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.packagesService.update(BigInt(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.packagesService.remove(BigInt(id));
  }
}

