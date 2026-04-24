import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminTasksService } from './admin-tasks.service';
import { UnifiedTasksQueryDto } from './dto/unified-tasks-query.dto';
import { RetryTaskDto } from './dto/retry-task.dto';
import { CancelTaskDto } from './dto/cancel-task.dto';
import { BatchStatusDto } from './dto/batch-status.dto';
import { BatchDeleteDto } from './dto/batch-delete.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('tasks')
export class AdminUnifiedTasksController {
  constructor(private readonly tasksService: AdminTasksService) {}

  @Get()
  list(@Query() query: UnifiedTasksQueryDto) {
    return this.tasksService.listUnified(query);
  }

  @Get('stats')
  stats(@Query() query: UnifiedTasksQueryDto) {
    return this.tasksService.stats(query);
  }

  @Get(':id')
  detail(@Param('id') id: string, @Query('type') type?: 'image' | 'video' | 'research') {
    return this.tasksService.detail(BigInt(id), type);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string, @Body() dto: RetryTaskDto) {
    return this.tasksService.retryUnified(BigInt(id), dto.type);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelTaskDto) {
    return this.tasksService.cancel(BigInt(id), dto.type);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('type') type?: 'image' | 'video' | 'research') {
    return this.tasksService.remove(BigInt(id), type);
  }

  @Post('batch/status')
  batchStatus(@Body() dto: BatchStatusDto) {
    return this.tasksService.batchStatus(dto);
  }

  @Post('batch/delete')
  batchDelete(@Body() dto: BatchDeleteDto) {
    return this.tasksService.batchDelete(dto);
  }
}
