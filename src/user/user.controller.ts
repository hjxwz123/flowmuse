import { Body, Controller, Get, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserService } from './user.service';

@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  profile(@CurrentUser('id') userId: bigint) {
    return this.userService.getProfile(userId);
  }

  @Put('profile')
  updateProfile(@CurrentUser('id') userId: bigint, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(userId, dto);
  }

  @Get('invite')
  invite(@CurrentUser('id') userId: bigint) {
    return this.userService.getInviteInfo(userId);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadAvatar(@CurrentUser('id') userId: bigint, @UploadedFile() file: Express.Multer.File) {
    return this.userService.updateAvatar(userId, file);
  }

  @Put('password')
  changePassword(@CurrentUser('id') userId: bigint, @Body() dto: ChangePasswordDto) {
    return this.userService.changePassword(userId, dto);
  }
}
