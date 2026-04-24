import { PartialType } from '@nestjs/mapped-types';

import { CreateMembershipLevelDto } from './create-membership-level.dto';

export class UpdateMembershipLevelDto extends PartialType(CreateMembershipLevelDto) {}

