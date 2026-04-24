import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateResearchTaskDto } from './dto/create-research-task.dto';
import { ResearchTasksQueryDto } from './dto/research-tasks-query.dto';
import { ResearchService } from './research.service';

@UseGuards(JwtAuthGuard)
@Controller('research')
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  @Post('tasks')
  createTask(@CurrentUser('id') userId: bigint, @Body() dto: CreateResearchTaskDto) {
    return this.researchService.createTask(userId, dto);
  }

  @Get('tasks')
  listTasks(@CurrentUser('id') userId: bigint, @Query() query: ResearchTasksQueryDto) {
    return this.researchService.listTasks(userId, query);
  }

  @Get('tasks/:id')
  getTask(@CurrentUser('id') userId: bigint, @Param('id') id: string) {
    return this.researchService.getTask(userId, id);
  }

  @Delete('tasks/:id')
  deleteTask(@CurrentUser('id') userId: bigint, @Param('id') id: string) {
    return this.researchService.deleteTask(userId, id);
  }
}
