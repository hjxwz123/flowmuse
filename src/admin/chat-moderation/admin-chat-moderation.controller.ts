import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminChatModerationService } from './admin-chat-moderation.service';
import { ChatModerationLogsQueryDto } from './dto/chat-moderation-logs-query.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/chat-moderation')
export class AdminChatModerationController {
  constructor(private readonly service: AdminChatModerationService) {}

  @Get('logs')
  listLogs(@Query() query: ChatModerationLogsQueryDto) {
    return this.service.listLogs(query);
  }
}
