import { Module } from '@nestjs/common';

import { AuthUserCacheModule } from '../auth/auth-user-cache.module';
import { AdminChannelsController } from './channels/admin-channels.controller';
import { AdminConfigsController } from './configs/admin-configs.controller';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminGalleryController } from './gallery/admin-gallery.controller';
import { AdminModelsController } from './models/admin-models.controller';
import { AdminPackagesController } from './packages/admin-packages.controller';
import { AdminProvidersController } from './providers/admin-providers.controller';
import { AdminRedeemCodesController } from './redeem-codes/admin-redeem-codes.controller';
import { AdminStatisticsController } from './statistics/admin-statistics.controller';
import { AdminTasksController } from './tasks/admin-tasks.controller';
import { AdminUnifiedTasksController } from './tasks/admin-unified-tasks.controller';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminSiteSettingsController } from './site-settings/admin-site-settings.controller';
import { AdminAnnouncementsController } from './announcements/admin-announcements.controller';
import { AdminAiSettingsController } from './ai-settings/admin-ai-settings.controller';
import { AdminChatModelsService } from './ai-settings/admin-chat-models.service';
import { AdminMembershipsController } from './memberships/admin-memberships.controller';
import { AdminTemplatesController } from './templates/admin-templates.controller';
import { AdminToolsController } from './tools/admin-tools.controller';
import { AdminPaymentsController } from './payments/admin-payments.controller';
import { AdminChatController } from './chat/admin-chat.controller';
import { AdminChatModerationController } from './chat-moderation/admin-chat-moderation.controller';
import { AdminProjectsController } from './projects/admin-projects.controller';
import { AdminPaymentsService } from './payments/admin-payments.service';
import { AdminChatService } from './chat/admin-chat.service';
import { AdminChatModerationService } from './chat-moderation/admin-chat-moderation.service';
import { AdminProjectsService } from './projects/admin-projects.service';

import { AdminChannelsService } from './channels/admin-channels.service';
import { AdminConfigsService } from './configs/admin-configs.service';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { AdminGalleryService } from './gallery/admin-gallery.service';
import { AdminModelsService } from './models/admin-models.service';
import { AdminPackagesService } from './packages/admin-packages.service';
import { AdminProvidersService } from './providers/admin-providers.service';
import { AdminRedeemCodesService } from './redeem-codes/admin-redeem-codes.service';
import { AdminStatisticsService } from './statistics/admin-statistics.service';
import { AdminTasksService } from './tasks/admin-tasks.service';
import { AdminUsersService } from './users/admin-users.service';
import { CreditsModule } from '../credits/credits.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminAnnouncementsService } from './announcements/admin-announcements.service';
import { InboxModule } from '../inbox/inbox.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { TemplatesModule } from '../templates/templates.module';
import { ToolsModule } from '../tools/tools.module';
import { AdminMembershipsService } from './memberships/admin-memberships.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [CreditsModule, SettingsModule, InboxModule, MembershipsModule, TemplatesModule, ToolsModule, MetricsModule, AuthUserCacheModule],
  controllers: [
    AdminUsersController,
    AdminRedeemCodesController,
    AdminTasksController,
    AdminUnifiedTasksController,
    AdminPackagesController,
    AdminProvidersController,
    AdminChannelsController,
    AdminModelsController,
    AdminGalleryController,
    AdminConfigsController,
    AdminStatisticsController,
    AdminDashboardController,
    AdminSiteSettingsController,
    AdminAnnouncementsController,
    AdminAiSettingsController,
    AdminMembershipsController,
    AdminTemplatesController,
    AdminToolsController,
    AdminPaymentsController,
    AdminChatController,
    AdminChatModerationController,
    AdminProjectsController,
  ],
  providers: [
    AdminUsersService,
    AdminRedeemCodesService,
    AdminTasksService,
    AdminPackagesService,
    AdminProvidersService,
    AdminChannelsService,
    AdminModelsService,
    AdminGalleryService,
    AdminConfigsService,
    AdminStatisticsService,
    AdminDashboardService,
    AdminAnnouncementsService,
    AdminPaymentsService,
    AdminChatService,
    AdminChatModerationService,
    AdminChatModelsService,
    AdminMembershipsService,
    AdminProjectsService,
  ],
})
export class AdminModule {}
