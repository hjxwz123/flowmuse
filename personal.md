# FlowMuse Personal 个人版改造方案

## 1. 改造目标

将当前面向多用户和商业运营的 FlowMuse SaaS 平台，裁剪为一个可在个人电脑上直接部署和使用的本地单用户 AI 创作 App。

个人版目标：

- 不需要登录、注册、邮箱验证、管理员账号。
- 不需要 MySQL，最多使用 SQLite 本地文件数据库。
- 不需要 Redis、BullMQ、独立 worker 服务。
- 不需要支付、套餐、会员、积分、兑换码、邀请奖励等商业功能。
- 不需要多用户隔离、用户管理、封禁、运营后台。
- 用户打开应用即可使用。
- 用户在本地“设置”里填写自己的 API Key。
- 项目、聊天、任务、素材、作品均保存在本机。

推荐最终形态：

```text
FlowMuse Personal
├── Next.js 前端
├── NestJS 本地后端
├── SQLite 本地数据库
├── uploads/ 本地文件目录
└── 本地任务执行器
```

## 2. 当前项目判断

当前项目是完整 SaaS 架构：

```text
Frontend: Next.js 15 + React 19
Backend: NestJS 10 + Prisma
Database: MySQL
Cache/Queue: Redis + BullMQ
Storage: Local / Tencent COS
Business: 支付、套餐、会员、积分、兑换码、邀请奖励
Admin: 用户、模型、渠道、任务、项目、套餐、会员、订单、公告、站点配置
```

当前架构适合商业网站，不适合个人本机轻量使用。因此个人版不建议只改配置，而应做一次明确裁剪。

## 3. 个人版保留功能

### 3.1 核心创作功能

建议保留：

- 图片生成
- 视频生成，可选
- 聊天式创作助手
- 自动项目工作流，可选保留
- 项目管理
- 项目素材管理
- 提示词管理
- 任务历史
- 本地作品库
- 模型和供应商配置
- 本地文件上传和解析

对应后端模块大致包括：

```text
src/images
src/videos
src/chat
src/projects
src/tasks
src/models
src/providers
src/adapters
src/storage
src/settings，可重构
src/prompt-optimize，可选
src/research，可选
src/openai-external，可选
```

对应前端页面建议保留：

```text
frontend/src/app/[locale]/create
frontend/src/app/[locale]/chat
frontend/src/app/[locale]/projects
frontend/src/app/[locale]/tasks
frontend/src/app/[locale]/gallery，可改成本地作品库
frontend/src/app/[locale]/settings，建议新增或由 admin/config 改造
```

## 4. 个人版删除功能

### 4.1 登录和用户体系

个人 App 不需要登录。建议删除或绕过：

```text
src/auth
src/user
src/common/guards/jwt-auth.guard.ts
src/common/guards/optional-jwt-auth.guard.ts
src/common/guards/roles.guard.ts
src/common/decorators/current-user.decorator.ts
src/common/decorators/roles.decorator.ts
```

前端删除：

```text
frontend/src/app/[locale]/auth/login
frontend/src/app/[locale]/auth/register
frontend/src/app/[locale]/auth/forgot-password
frontend/src/app/[locale]/auth/reset-password
frontend/src/app/[locale]/auth/verify-email
```

也应删除或重构：

```text
frontend/src/lib/store/authStore.ts
frontend/src/lib/auth/unauthorized.ts
登录按钮
注册入口
用户菜单中的退出登录
需要登录后访问的路由保护逻辑
```

### 4.2 商业功能

删除：

```text
src/payment
src/packages
src/memberships
src/redeem
src/credits
```

前端删除：

```text
frontend/src/app/[locale]/packages
frontend/src/app/[locale]/dashboard/credits
frontend/src/app/[locale]/dashboard/orders
frontend/src/app/[locale]/dashboard/invite
frontend/src/app/[locale]/admin/packages
frontend/src/app/[locale]/admin/memberships
frontend/src/app/[locale]/admin/payments
frontend/src/app/[locale]/admin/redeem-codes
frontend/src/app/[locale]/admin/config/payment
frontend/src/components/shared/PurchaseGuideModal.tsx
```

数据库删除相关模型：

```text
Package
PaymentOrder
MembershipLevel
UserMembershipSchedule
RedeemCode
RedeemLog
CreditLog
InviteRewardLog
```

### 4.3 运营后台

个人版不需要传统管理后台。建议把“后台”改成“设置”。

删除或重构：

```text
src/admin
src/metrics
src/announcements
src/inbox
src/email
```

前端删除：

```text
frontend/src/app/[locale]/admin/dashboard
frontend/src/app/[locale]/admin/users
frontend/src/app/[locale]/admin/gallery
frontend/src/app/[locale]/admin/chat-moderation
frontend/src/app/[locale]/admin/announcements
frontend/src/app/[locale]/admin/site
frontend/src/app/[locale]/admin/config/announcements
frontend/src/app/[locale]/admin/config/email-whitelist
```

可保留并改造成设置页：

```text
frontend/src/app/[locale]/admin/models
frontend/src/app/[locale]/admin/config/ai
frontend/src/app/[locale]/admin/config/chat-models
frontend/src/app/[locale]/admin/config/site，可选
```

### 4.4 社区功能

公共画廊中的社区互动不适合个人版。建议删除：

```text
GalleryLike
GalleryFavorite
GalleryComment
公开审核状态
点赞
收藏
评论
用户主页
内容审核后台
```

保留方向：

```text
本地作品库
本地搜索
本地筛选
本地删除
本地重新生成
```

## 5. 无登录设计

### 5.1 推荐方案：固定本地用户

第一阶段不建议立即删除所有 `userId` 字段，因为当前业务逻辑大量依赖用户隔离。为了减少改造风险，推荐使用固定本地用户：

```ts
export const LOCAL_USER_ID = 1n;
```

所有原本需要登录用户的接口，都改为使用 `LOCAL_USER_ID`。

优点：

- 改动最小。
- 项目、任务、聊天、素材等既有逻辑更容易复用。
- 后续如果想重新支持登录，也有回退空间。

缺点：

- 数据库仍然保留部分 `userId` 字段。
- 从概念上仍有“用户”，但只有一个本地用户。

### 5.2 后续方案：彻底移除用户字段

当个人版稳定后，可以逐步删除业务表中的 `userId`：

```text
ImageTask.userId
VideoTask.userId
Project.userId
ProjectAsset.userId
ChatConversation.userId
ChatMessage.userId
ChatFile.userId
Template.userId
ResearchTask.userId
```

这个方案更干净，但第一次改造成本更高，不建议作为第一步。

## 6. API Key 本地配置

个人版的关键变化是：用户自己填写 API Key，本地保存，本地调用。

建议新增本地设置模块：

```text
src/local-settings/local-settings.module.ts
src/local-settings/local-settings.service.ts
src/local-settings/local-settings.controller.ts
```

建议数据库表：

```prisma
model LocalSetting {
  id        Int      @id @default(autoincrement())
  key       String   @unique
  value     String
  encrypted Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

建议保存内容：

```text
openai.apiKey
openai.baseUrl
openai.defaultChatModel
openai.defaultImageModel
midjourney.apiKey
flux.apiKey
keling.apiKey
doubao.apiKey
storage.uploadDir
app.language
app.theme
```

API Key 应加密后存储。当前项目已有：

```text
src/encryption
```

可以复用 `EncryptionService`。

如果追求最简单，也可以先使用 `.env`：

```text
OPENAI_API_KEY=...
OPENAI_BASE_URL=...
UPLOAD_DIR=./uploads
```

但从个人 App 体验看，更推荐前端设置页保存 API Key。

## 7. SQLite 改造

### 7.1 Prisma datasource

从 MySQL 改为 SQLite：

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

`.env`：

```env
DATABASE_URL="file:./data/flowmuse.sqlite"
```

### 7.2 不建议直接迁移完整 schema

当前 `prisma/schema.prisma` 大量使用 MySQL 专属类型，例如：

```text
@db.VarChar
@db.Text
@db.LongText
@db.BigInt
@db.Decimal
@db.Date
```

SQLite 不支持这些 MySQL 类型标注。建议新建个人版 schema，而不是直接在现有 SaaS schema 上硬改。

### 7.3 推荐个人版核心模型

个人版建议保留这些模型：

```text
LocalSetting
AiModel
ModelProvider
ImageTask
VideoTask
Project
ProjectAsset
ProjectPrompt
ChatConversation
ChatMessage
ChatFile
Template，可选
Tool，可选
ResearchTask，可选
```

可以删除这些模型：

```text
User
UserAuthEvent
Package
PaymentOrder
MembershipLevel
UserMembershipSchedule
RedeemCode
RedeemLog
CreditLog
InviteRewardLog
InboxMessage
Announcement
GalleryLike
GalleryFavorite
GalleryComment
ChatModerationLog
InputModerationLog，可选删除
```

## 8. 去 Redis 和 BullMQ

当前图片、视频、邮件、研究等任务使用 Redis/BullMQ。个人版不需要 Redis。

建议新增本地任务执行器：

```text
src/local-runner/local-runner.module.ts
src/local-runner/local-task-runner.service.ts
```

执行逻辑：

```text
1. 创建任务，写入 SQLite，状态 pending。
2. LocalTaskRunnerService 将任务加入内存队列。
3. 后台异步执行，状态改为 processing。
4. 调用 AI provider。
5. 保存结果到 uploads/。
6. 更新任务为 completed 或 failed。
7. 应用重启时扫描 pending/processing 任务，恢复为 pending 或 failed。
```

建议并发限制：

```text
图片任务并发：1-2
视频任务并发：1
研究任务并发：1
```

删除或重构：

```text
src/redis
src/queues
src/images/image-task.processor.ts
src/videos/video-task.processor.ts
src/research/research.processor.ts
src/email/email.processor.ts
```

## 9. 积分逻辑替换

当前生成图片/视频可能会调用积分扣费逻辑。个人版应全部删除。

要替换的逻辑：

```text
检查积分余额
扣除积分
失败退积分
会员每日额度
特殊模型额外积分
购买引导
积分不足弹窗
```

个人版改为：

```text
检查是否配置 API Key
检查模型是否启用
创建任务
直接执行
失败显示 provider 错误
```

前端模型卡片中的积分文案应改为：

```text
模型名称
供应商
支持能力
默认尺寸/比例
是否已配置 API Key
```

## 10. 前端导航建议

个人版主导航建议：

```text
首页
创作
聊天
项目
任务
作品库
设置
```

删除：

```text
套餐
积分
订单
邀请
收件箱
公告
用户管理
运营后台
```

设置页建议包含：

```text
API Key 设置
模型设置
默认模型
本地存储目录
外观设置
数据备份/导入导出
```

## 11. 后端 AppModule 裁剪建议

当前 `src/app.module.ts` 引入了大量 SaaS 模块。个人版初期建议保留：

```ts
ConfigModule
ScheduleModule，可选
PrismaModule
EncryptionModule
StorageModule
ModelsModule
ProvidersModule
ImagesModule
VideosModule
GalleryModule，可改成本地作品库
PromptOptimizeModule，可选
TemplatesModule，可选
ToolsModule，可选
ChatModule
ResearchModule，可选
ProjectsModule
TasksModule
LocalSettingsModule，新增
LocalRunnerModule，新增
```

建议删除：

```ts
RedisModule
QueuesModule
EmailModule
AuthModule
UserModule
PackagesModule
RedeemModule
CreditsModule
AdminModule
SchedulerModule，若只服务商业任务则删除
WebhooksModule，除非某些 provider 必须回调
SiteModule，可选
AnnouncementsModule
InboxModule
PaymentModule
MembershipsModule
OpenaiExternalModule，可选
```

## 12. 部署方式

个人版不需要 Docker Compose。推荐本地启动：

```bash
npm install
cd frontend && npm install
cd ..
npm run prisma:generate
npm run prisma:migrate
npm run dev:all
```

也可以新增脚本：

```json
{
  "dev:personal": "concurrently \"npm run start:dev\" \"cd frontend && npm run dev\"",
  "build:personal": "npm run build && npm run build:frontend",
  "start:personal": "npm run start:all"
}
```

最小 `.env`：

```env
DATABASE_URL="file:./data/flowmuse.sqlite"
PORT=3000
FRONTEND_PORT=5173
APP_PUBLIC_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
APP_ENCRYPTION_KEY=change-me-32-bytes-minimum-length
UPLOAD_DIR=./uploads
```

如果先用 `.env` 存 API Key：

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
```

## 13. 推荐实施阶段

### 阶段一：无登录个人模式

目标：先让应用不登录也能使用。

任务：

```text
1. 前端移除登录入口和登录态拦截。
2. 后端移除接口上的 JwtAuthGuard。
3. 后端统一使用 LOCAL_USER_ID = 1。
4. seed 创建本地用户 id=1，或业务层固定处理。
5. 图片、视频、项目、聊天接口可直接访问。
```

### 阶段二：删除商业功能

目标：删除支付、会员、积分、套餐、兑换码。

任务：

```text
1. AppModule 移除商业模块。
2. 图片/视频生成移除积分检查和扣费。
3. 前端删除套餐、积分、订单、邀请页面。
4. 删除购买引导弹窗。
5. 删除后台商业菜单。
```

### 阶段三：本地 API Key 设置

目标：用户在设置页填写 API Key。

任务：

```text
1. 新增 LocalSettingsModule。
2. 新增 LocalSetting 表。
3. API Key 加密保存。
4. Provider 调用时读取本地设置。
5. 前端新增设置页。
```

### 阶段四：SQLite schema

目标：去掉 MySQL，改用 SQLite。

任务：

```text
1. 新建个人版 Prisma schema。
2. 删除 MySQL 专属字段类型。
3. 保留核心创作模型。
4. 新建 SQLite migration。
5. 新建 personal seed。
```

### 阶段五：去 Redis 和 BullMQ

目标：本机无需 Redis。

任务：

```text
1. 新增 LocalTaskRunnerService。
2. 图片任务改为本地队列执行。
3. 视频任务改为本地队列执行。
4. 研究任务可选改造。
5. 移除 RedisModule 和 QueuesModule。
```

### 阶段六：前端彻底个人化

目标：界面变成个人 App，而不是商业平台。

任务：

```text
1. 重做导航。
2. admin 改名 settings。
3. 删除商业 i18n 文案。
4. 删除用户中心商业页面。
5. gallery 改成本地作品库。
6. 首页文案改为个人 AI 创作工作台。
```

## 14. 建议不要第一步就做的事

不建议一开始就：

```text
彻底删除所有 userId 字段
彻底合并前后端为单进程
一次性删除整个 admin 目录
一次性重写 Prisma schema 并迁移全部业务
一次性删除所有队列和 processor
```

原因：

- 当前项目体量较大，模块耦合多。
- 直接大删容易引入大量编译错误。
- 固定本地用户和逐步裁剪更稳。

## 15. 最终个人版效果

最终用户体验应为：

```text
1. 用户本机启动 FlowMuse Personal。
2. 浏览器打开 http://localhost:5173。
3. 不需要登录，直接进入首页。
4. 首次使用进入设置页，填写 OpenAI 或其他模型 API Key。
5. 创建项目或打开聊天助手。
6. 生成图片/视频。
7. 结果保存到本地 uploads/ 和 SQLite。
8. 可在作品库、任务页、项目页继续管理和复用。
```

## 16. 推荐结论

这个项目适合改成个人版，但应采用“先绕过登录和商业逻辑，再替换基础设施”的方式。

推荐最小可行个人版范围：

```text
无登录
SQLite
本地 uploads
本地 API Key 设置
图片生成
聊天助手
项目管理
任务历史
本地作品库
```

第一阶段最关键目标不是删除所有代码，而是先让项目以个人模式跑起来。等个人模式稳定后，再逐步删除用户、商业、运营和队列相关代码。
