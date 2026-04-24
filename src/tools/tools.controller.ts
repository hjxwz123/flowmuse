import { Controller, Get, Param, Query } from '@nestjs/common';

import { QueryToolsDto } from './dto/query-tools.dto';
import { ToolsService } from './tools.service';

@Controller('tools')
export class ToolsController {
  constructor(private readonly tools: ToolsService) {}

  @Get()
  findActive(@Query() query: QueryToolsDto) {
    return this.tools.findActive(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tools.findOne(BigInt(id));
  }
}
