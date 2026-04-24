import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateToolDto } from '../../tools/dto/create-tool.dto';
import { QueryToolsDto } from '../../tools/dto/query-tools.dto';
import { ToolsService } from '../../tools/tools.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/tools')
export class AdminToolsController {
  constructor(private readonly tools: ToolsService) {}

  @Get()
  findAll(@Query() query: QueryToolsDto) {
    return this.tools.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tools.findOne(BigInt(id));
  }

  @Post()
  create(@Body() dto: CreateToolDto) {
    return this.tools.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CreateToolDto) {
    return this.tools.update(BigInt(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tools.remove(BigInt(id));
  }
}
