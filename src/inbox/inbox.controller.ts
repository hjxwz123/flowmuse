import { Controller, Delete, Get, Param, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InboxMessagesQueryDto } from './dto/inbox-messages-query.dto';
import { InboxService } from './inbox.service';

@UseGuards(JwtAuthGuard)
@Controller('inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get('stream')
  async stream(
    @CurrentUser('id') userId: bigint,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      (res as Response & { flush?: () => void }).flush?.();
    };

    sendEvent(await this.inbox.buildSnapshotEvent(userId));

    const unsubscribe = this.inbox.subscribe(userId, (event) => {
      if (res.writableEnded) return;
      sendEvent(event);
    });

    const heartbeat = setInterval(() => {
      if (res.writableEnded) return;
      res.write(': ping\n\n');
      (res as Response & { flush?: () => void }).flush?.();
    }, 15_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      if (!res.writableEnded) {
        res.end();
      }
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
  }

  @Get('messages')
  list(@CurrentUser('id') userId: bigint, @Query() query: InboxMessagesQueryDto) {
    return this.inbox.listMessages(userId, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('id') userId: bigint) {
    return this.inbox.unreadCount(userId);
  }

  @Put('messages/read-all')
  markAllRead(@CurrentUser('id') userId: bigint) {
    return this.inbox.markAllRead(userId);
  }

  @Put('messages/:id/read')
  markRead(@CurrentUser('id') userId: bigint, @Param('id') id: string) {
    return this.inbox.markRead(userId, BigInt(id));
  }

  @Delete('messages/:id')
  remove(@CurrentUser('id') userId: bigint, @Param('id') id: string) {
    return this.inbox.remove(userId, BigInt(id));
  }
}
