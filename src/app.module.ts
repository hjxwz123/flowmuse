import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { EmailModule } from './email/email.module';
import { EncryptionModule } from './encryption/encryption.module';
import { AuthModule } from './auth/auth.module';
// import { ChannelHealthModule } from './channel-health/channel-health.module'; // 已禁用
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { PackagesModule } from './packages/packages.module';
import { RedeemModule } from './redeem/redeem.module';
import { CreditsModule } from './credits/credits.module';
import { ModelsModule } from './models/models.module';
import { ImagesModule } from './images/images.module';
import { VideosModule } from './videos/videos.module';
import { GalleryModule } from './gallery/gallery.module';
import { ProvidersModule } from './providers/providers.module';
import { AdminModule } from './admin/admin.module';
import { QueuesModule } from './queues/queues.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { StorageModule } from './storage/storage.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { RedisModule } from './redis/redis.module';
import { SiteModule } from './site/site.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { InboxModule } from './inbox/inbox.module';
import { PromptOptimizeModule } from './prompt-optimize/prompt-optimize.module';
import { TemplatesModule } from './templates/templates.module';
import { ToolsModule } from './tools/tools.module';
import { PaymentModule } from './payment/payment.module';
import { ChatModule } from './chat/chat.module';
import { MembershipsModule } from './memberships/memberships.module';
import { ResearchModule } from './research/research.module';
import { OpenaiExternalModule } from './openai-external/openai-external.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    EncryptionModule,
    StorageModule,
    QueuesModule,
    EmailModule,
    // ChannelHealthModule, // 已禁用占用过多 Redis 资源
    SchedulerModule,
    WebhooksModule,
    AuthModule,
    UserModule,
    PackagesModule,
    RedeemModule,
    CreditsModule,
    ModelsModule,
    ProvidersModule,
    ImagesModule,
    VideosModule,
    GalleryModule,
    SiteModule,
    AnnouncementsModule,
    InboxModule,
    PromptOptimizeModule,
    TemplatesModule,
    ToolsModule,
    PaymentModule,
    MembershipsModule,
    ChatModule,
    ResearchModule,
    ProjectsModule,
    TasksModule,
    OpenaiExternalModule,
    AdminModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
