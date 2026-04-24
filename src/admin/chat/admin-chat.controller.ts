import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminChatService } from './admin-chat.service';
import { ListConversationsDto } from './dto/list-conversations.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/chat')
export class AdminChatController {
  constructor(private readonly service: AdminChatService) {}

  @Get('conversations')
  listConversations(@Query() query: ListConversationsDto) {
    return this.service.listConversations(query);
  }

  @Get('conversations/:id/messages')
  getConversationMessages(@Param('id') id: string) {
    return this.service.getConversationMessages(id);
  }

  @Delete('conversations/:id')
  removeConversation(@Param('id') id: string) {
    return this.service.removeConversation(id);
  }
}
