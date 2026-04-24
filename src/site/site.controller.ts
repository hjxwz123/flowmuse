import { Controller, Get } from '@nestjs/common';

import { SystemSettingsService } from '../settings/system-settings.service';
import { PublicSettingsDto } from './dto/public-settings.dto';

@Controller('site')
export class SiteController {
  constructor(private readonly settings: SystemSettingsService) {}

  @Get('settings')
  async getSettings(): Promise<PublicSettingsDto> {
    return this.settings.getPublicSettings();
  }
}
