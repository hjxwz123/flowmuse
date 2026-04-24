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

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateTemplateDto } from './dto/create-template.dto';
import { QueryTemplatesDto } from './dto/query-templates.dto';
import { TemplatesService } from './templates.service';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  /** GET /templates — 公开系统模板，无需登录 */
  @Get()
  findPublic(@Query() query: QueryTemplatesDto) {
    return this.templates.findPublic(query);
  }

  /** GET /templates/presets — 当前用户预设，需登录 */
  @UseGuards(JwtAuthGuard)
  @Get('presets')
  findMyPresets(
    @CurrentUser('id') userId: bigint,
    @Query() query: QueryTemplatesDto,
  ) {
    return this.templates.findMyPresets(userId, query);
  }

  /** GET /templates/:id — 获取单个模板 */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templates.findOne(BigInt(id));
  }

  /** POST /templates/presets — 保存用户预设，需登录 */
  @UseGuards(JwtAuthGuard)
  @Post('presets')
  createPreset(
    @CurrentUser('id') userId: bigint,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templates.create(dto, userId, false);
  }

  /** PUT /templates/presets/:id — 更新用户预设，需登录 */
  @UseGuards(JwtAuthGuard)
  @Put('presets/:id')
  updatePreset(
    @CurrentUser('id') userId: bigint,
    @Param('id') id: string,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templates.update(BigInt(id), dto, userId, false);
  }

  /** DELETE /templates/presets/:id — 删除用户预设，需登录 */
  @UseGuards(JwtAuthGuard)
  @Delete('presets/:id')
  removePreset(
    @CurrentUser('id') userId: bigint,
    @Param('id') id: string,
  ) {
    return this.templates.remove(BigInt(id), userId, false);
  }
}
