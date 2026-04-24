import { Controller, Get, Query } from '@nestjs/common';

import { PaginationDto } from '../common/dto/pagination.dto';
import { AnnouncementsService } from './announcements.service';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get('current')
  current() {
    return this.announcements.current();
  }

  @Get()
  list(@Query() pagination: PaginationDto) {
    return this.announcements.list(pagination);
  }
}

