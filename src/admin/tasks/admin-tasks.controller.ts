import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RetryTaskDto } from './dto/retry-task.dto';
import { AdminTasksService } from './admin-tasks.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/tasks')
export class AdminTasksController {
  constructor(private readonly tasksService: AdminTasksService) {}

  @Get('images')
  images(@Query('status') status?: string) {
    return this.tasksService.listImages(status);
  }

  @Get('videos')
  videos(@Query('status') status?: string) {
    return this.tasksService.listVideos(status);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string, @Body() dto: RetryTaskDto) {
    return this.tasksService.retry(BigInt(id), dto.type ?? 'image');
  }
}
