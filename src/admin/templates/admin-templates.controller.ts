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
import { CreateTemplateDto } from '../../templates/dto/create-template.dto';
import { QueryTemplatesDto } from '../../templates/dto/query-templates.dto';
import { TemplatesService } from '../../templates/templates.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/templates')
export class AdminTemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  findAll(@Query() query: QueryTemplatesDto) {
    return this.templates.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templates.findOne(BigInt(id));
  }

  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.templates.create(dto, undefined, true);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CreateTemplateDto) {
    return this.templates.update(BigInt(id), dto, undefined, true);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templates.remove(BigInt(id), undefined, true);
  }
}
