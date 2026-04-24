import { PartialType } from '@nestjs/mapped-types';

import { CreateRedeemCodeDto } from './create-redeem-code.dto';

export class UpdateRedeemCodeDto extends PartialType(CreateRedeemCodeDto) {}

