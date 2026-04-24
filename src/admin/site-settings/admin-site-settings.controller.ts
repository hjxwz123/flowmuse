import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SystemSettingsService } from '../../settings/system-settings.service';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';
import { UpdateEmailWhitelistDto } from './dto/update-email-whitelist.dto';
import { UpdateWechatPayDto } from './dto/update-wechat-pay.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/site')
export class AdminSiteSettingsController {
  constructor(private readonly settings: SystemSettingsService) {}

  @Get('settings')
  getSettings() {
    return this.settings.getSiteSettingsForAdmin();
  }

  @Put('settings')
  async updateSettings(@Body() dto: UpdateSiteSettingsDto) {
    await this.settings.setPublicSettings(dto);
    return this.settings.getSiteSettingsForAdmin();
  }

  @Get('email-whitelist')
  getEmailWhitelist() {
    return this.settings.getEmailWhitelistSettings();
  }

  @Put('email-whitelist')
  updateEmailWhitelist(@Body() dto: UpdateEmailWhitelistDto) {
    return this.settings.setEmailWhitelistSettings(dto);
  }

  @Get('wechat-pay')
  getWechatPaySettings() {
    return this.settings.getWechatPaySettings();
  }

  @Put('wechat-pay')
  updateWechatPaySettings(@Body() dto: UpdateWechatPayDto) {
    return this.settings.setWechatPaySettings(dto);
  }
}
