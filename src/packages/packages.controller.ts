import { Controller, Get, Param, ParseBoolPipe, Query } from '@nestjs/common';

import { PackagesService } from './packages.service';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  list(
    @Query('activeOnly', new ParseBoolPipe({ optional: true })) activeOnly?: boolean,
    @Query('sort') sort?: 'price' | 'sort',
  ) {
    return this.packagesService.list({ activeOnly, sort });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.packagesService.detail(BigInt(id));
  }
}

