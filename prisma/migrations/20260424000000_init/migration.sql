-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `username` VARCHAR(100) NULL,
    `avatar` VARCHAR(500) NULL,
    `invite_code` VARCHAR(32) NULL,
    `invited_by_id` BIGINT NULL,
    `invited_at` DATETIME(3) NULL,
    `permanent_credits` INTEGER NOT NULL DEFAULT 0,
    `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    `status` ENUM('active', 'banned', 'unverified') NOT NULL DEFAULT 'active',
    `ban_reason` TEXT NULL,
    `ban_expire_at` DATETIME(3) NULL,
    `email_verified` BOOLEAN NOT NULL DEFAULT false,
    `membership_level_id` BIGINT NULL,
    `membership_expire_at` DATETIME(3) NULL,
    `membership_rate_fen_per_day` DECIMAL(14, 6) NULL,
    `membership_daily_credits` INTEGER NOT NULL DEFAULT 0,
    `membership_daily_date` DATE NULL,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_invite_code_key`(`invite_code`),
    INDEX `users_created_at_idx`(`created_at`),
    INDEX `users_invited_by_id_idx`(`invited_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_auth_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `type` ENUM('register', 'login') NOT NULL,
    `ip` VARCHAR(128) NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_auth_event_idx_user_time`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `packages` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `name_en` VARCHAR(100) NULL,
    `package_type` VARCHAR(20) NOT NULL DEFAULT 'subscription',
    `duration_days` INTEGER NOT NULL,
    `credits_per_day` INTEGER NOT NULL,
    `total_credits` INTEGER NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `original_price` DECIMAL(10, 2) NULL,
    `description` TEXT NULL,
    `description_en` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `redeem_codes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `type` ENUM('membership', 'credits') NOT NULL,
    `membership_level_id` BIGINT NULL,
    `membership_period` ENUM('monthly', 'yearly') NULL,
    `membership_cycles` INTEGER NULL DEFAULT 1,
    `credits` INTEGER NULL,
    `max_use_count` INTEGER NOT NULL DEFAULT 1,
    `used_count` INTEGER NOT NULL DEFAULT 0,
    `expire_date` DATETIME(3) NULL,
    `status` ENUM('active', 'expired', 'disabled') NOT NULL,
    `description` VARCHAR(500) NULL,
    `created_by` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `redeem_codes_code_key`(`code`),
    INDEX `idx_code`(`code`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `redeem_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `code_id` BIGINT NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `type` ENUM('membership', 'credits') NOT NULL,
    `membership_level_id` BIGINT NULL,
    `membership_period` ENUM('monthly', 'yearly') NULL,
    `membership_cycles` INTEGER NULL DEFAULT 1,
    `credits` INTEGER NULL,
    `redeemed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_user_code`(`user_id`, `code_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invite_reward_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `event_key` VARCHAR(128) NOT NULL,
    `inviter_id` BIGINT NOT NULL,
    `invitee_id` BIGINT NOT NULL,
    `reward_type` VARCHAR(20) NOT NULL,
    `inviter_reward_credits` INTEGER NOT NULL DEFAULT 0,
    `invitee_reward_credits` INTEGER NOT NULL DEFAULT 0,
    `order_no` VARCHAR(64) NULL,
    `order_amount_fen` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `invite_reward_logs_event_key_key`(`event_key`),
    INDEX `invite_reward_idx_inviter_time`(`inviter_id`, `created_at`),
    INDEX `invite_reward_idx_invitee_time`(`invitee_id`, `created_at`),
    INDEX `invite_reward_idx_type_time`(`reward_type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `amount` INTEGER NOT NULL,
    `balance_after` INTEGER NOT NULL,
    `type` ENUM('redeem', 'consume', 'refund', 'admin_adjust', 'expire') NOT NULL,
    `source` ENUM('permanent', 'membership') NOT NULL,
    `related_id` BIGINT NULL,
    `description` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `credit_log_idx_time_type`(`created_at`, `type`),
    INDEX `idx_user_time`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dashboard_daily_metrics` (
    `date` DATE NOT NULL,
    `new_users` INTEGER NOT NULL DEFAULT 0,
    `image_completed` INTEGER NOT NULL DEFAULT 0,
    `image_failed` INTEGER NOT NULL DEFAULT 0,
    `video_completed` INTEGER NOT NULL DEFAULT 0,
    `video_failed` INTEGER NOT NULL DEFAULT 0,
    `paid_orders` INTEGER NOT NULL DEFAULT 0,
    `revenue_fen` INTEGER NOT NULL DEFAULT 0,
    `credits_issued` INTEGER NOT NULL DEFAULT 0,
    `credits_used` INTEGER NOT NULL DEFAULT 0,
    `refreshed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `dashboard_metric_idx_refreshed`(`refreshed_at`),
    PRIMARY KEY (`date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_channels` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `base_url` VARCHAR(500) NOT NULL,
    `api_key` VARCHAR(500) NULL,
    `api_secret` VARCHAR(500) NULL,
    `extra_headers` JSON NULL,
    `timeout` INTEGER NOT NULL DEFAULT 300000,
    `max_retry` INTEGER NOT NULL DEFAULT 3,
    `rate_limit` INTEGER NULL,
    `status` ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_provider_status`(`provider`, `status`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_models` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `model_key` VARCHAR(100) NOT NULL,
    `icon` TEXT NULL,
    `type` ENUM('image', 'video', 'chat') NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `channel_id` BIGINT NOT NULL,
    `credits_per_use` INTEGER NOT NULL,
    `special_credits_per_use` INTEGER NULL,
    `extra_credits_config` JSON NULL,
    `default_params` JSON NULL,
    `param_constraints` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `supports_image_input` BOOLEAN NULL,
    `supports_resolution_select` BOOLEAN NULL,
    `supports_size_select` BOOLEAN NULL,
    `supports_quick_mode` BOOLEAN NULL,
    `supports_agent_mode` BOOLEAN NULL,
    `supports_auto_mode` BOOLEAN NULL,
    `free_user_daily_question_limit` INTEGER NULL,
    `member_daily_question_limit` INTEGER NULL,
    `max_context_rounds` INTEGER NULL,
    `system_prompt` TEXT NULL,
    `deep_research_credits_cost` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_type_active`(`type`, `is_active`, `sort_order`),
    INDEX `idx_provider`(`provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `model_providers` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(50) NOT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `adapter_class` VARCHAR(200) NOT NULL,
    `icon` TEXT NULL,
    `support_types` JSON NOT NULL,
    `default_params` JSON NULL,
    `param_schema` JSON NULL,
    `webhook_required` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `model_providers_provider_key`(`provider`),
    INDEX `idx_active`(`is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `image_tasks` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `model_id` BIGINT NOT NULL,
    `channel_id` BIGINT NOT NULL,
    `project_id` BIGINT NULL,
    `task_no` VARCHAR(64) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `provider_task_id` VARCHAR(255) NULL,
    `prompt` TEXT NOT NULL,
    `negative_prompt` TEXT NULL,
    `parameters` JSON NULL,
    `provider_data` JSON NULL,
    `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL,
    `result_url` VARCHAR(500) NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `oss_key` VARCHAR(500) NULL,
    `credits_cost` INTEGER NULL,
    `credit_source` ENUM('permanent', 'membership') NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `public_moderation_status` ENUM('private', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'private',
    `public_requested_at` DATETIME(3) NULL,
    `public_moderated_at` DATETIME(3) NULL,
    `public_moderated_by` VARCHAR(255) NULL,
    `public_moderation_note` TEXT NULL,
    `error_message` TEXT NULL,
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tool_id` BIGINT NULL,

    UNIQUE INDEX `image_tasks_task_no_key`(`task_no`),
    INDEX `idx_user_time`(`user_id`, `created_at`),
    INDEX `idx_public`(`is_public`, `status`, `created_at`),
    INDEX `idx_public_moderation`(`public_moderation_status`, `created_at`),
    INDEX `idx_provider_task`(`provider`, `provider_task_id`),
    INDEX `idx_project_time`(`project_id`, `created_at`),
    INDEX `idx_status`(`status`, `created_at`),
    INDEX `image_task_idx_user_status_created`(`user_id`, `status`, `created_at`),
    INDEX `image_task_idx_channel_status_completed`(`channel_id`, `status`, `completed_at`),
    INDEX `image_task_idx_status_completed`(`status`, `completed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_tasks` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `model_id` BIGINT NOT NULL,
    `channel_id` BIGINT NOT NULL,
    `project_id` BIGINT NULL,
    `task_no` VARCHAR(64) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `provider_task_id` VARCHAR(255) NULL,
    `prompt` TEXT NOT NULL,
    `parameters` JSON NULL,
    `provider_data` JSON NULL,
    `auto_project_shot_id` VARCHAR(120) NULL,
    `auto_project_workflow_stage` VARCHAR(40) NULL,
    `auto_project_final_storyboard` BOOLEAN NULL,
    `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL,
    `result_url` VARCHAR(500) NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `oss_key` VARCHAR(500) NULL,
    `credits_cost` INTEGER NULL,
    `credit_source` ENUM('permanent', 'membership') NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `public_moderation_status` ENUM('private', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'private',
    `public_requested_at` DATETIME(3) NULL,
    `public_moderated_at` DATETIME(3) NULL,
    `public_moderated_by` VARCHAR(255) NULL,
    `public_moderation_note` TEXT NULL,
    `error_message` TEXT NULL,
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tool_id` BIGINT NULL,

    UNIQUE INDEX `video_tasks_task_no_key`(`task_no`),
    INDEX `idx_user_time`(`user_id`, `created_at`),
    INDEX `idx_public`(`is_public`, `status`, `created_at`),
    INDEX `idx_public_moderation`(`public_moderation_status`, `created_at`),
    INDEX `idx_provider_task`(`provider`, `provider_task_id`),
    INDEX `idx_project_time`(`project_id`, `created_at`),
    INDEX `idx_project_storyboard_lookup`(`project_id`, `auto_project_final_storyboard`, `auto_project_shot_id`, `created_at`),
    INDEX `idx_project_auto_stage_time`(`project_id`, `auto_project_workflow_stage`, `created_at`),
    INDEX `idx_status`(`status`, `created_at`),
    INDEX `video_task_idx_user_status_created`(`user_id`, `status`, `created_at`),
    INDEX `video_task_idx_channel_status_completed`(`channel_id`, `status`, `completed_at`),
    INDEX `video_task_idx_status_completed`(`status`, `completed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `concept` TEXT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_idx_user_time`(`user_id`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_assets` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `project_id` BIGINT NOT NULL,
    `kind` ENUM('image', 'video', 'document') NOT NULL,
    `source` ENUM('upload', 'task') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `source_prompt` TEXT NULL,
    `file_name` VARCHAR(255) NULL,
    `mime_type` VARCHAR(120) NULL,
    `file_size` INTEGER NULL,
    `url` VARCHAR(500) NOT NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `oss_key` VARCHAR(500) NULL,
    `image_task_id` BIGINT NULL,
    `video_task_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_asset_idx_project_time`(`project_id`, `created_at`),
    INDEX `project_asset_idx_user_time`(`user_id`, `created_at`),
    UNIQUE INDEX `project_assets_project_id_image_task_id_key`(`project_id`, `image_task_id`),
    UNIQUE INDEX `project_assets_project_id_video_task_id_key`(`project_id`, `video_task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_inspirations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `project_id` BIGINT NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `episode_number` INTEGER NULL,
    `idea_text` LONGTEXT NOT NULL,
    `context_text` LONGTEXT NULL,
    `plot_text` LONGTEXT NULL,
    `generated_prompt` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_inspiration_idx_project_time`(`project_id`, `created_at`),
    INDEX `project_inspiration_idx_user_time`(`user_id`, `created_at`),
    INDEX `project_inspiration_idx_project_episode`(`project_id`, `episode_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_prompts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `project_id` BIGINT NOT NULL,
    `type` ENUM('image', 'video') NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `prompt` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_prompt_idx_project_time`(`project_id`, `created_at`),
    INDEX `project_prompt_idx_user_time`(`user_id`, `created_at`),
    INDEX `project_prompt_idx_project_type`(`project_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `research_tasks` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `model_id` BIGINT NOT NULL,
    `channel_id` BIGINT NOT NULL,
    `task_no` VARCHAR(64) NOT NULL,
    `topic` TEXT NOT NULL,
    `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL,
    `stage` VARCHAR(50) NOT NULL DEFAULT 'queued',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `plan` JSON NULL,
    `queries` JSON NULL,
    `findings` JSON NULL,
    `report` LONGTEXT NULL,
    `provider_data` JSON NULL,
    `credits_cost` INTEGER NULL,
    `credit_source` ENUM('permanent', 'membership') NULL,
    `error_message` TEXT NULL,
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `research_tasks_task_no_key`(`task_no`),
    INDEX `research_task_idx_user_time`(`user_id`, `created_at`),
    INDEX `research_task_idx_status`(`status`, `created_at`),
    INDEX `research_task_idx_task_no`(`task_no`),
    INDEX `research_task_idx_user_status_time`(`user_id`, `status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gallery_likes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `target_type` ENUM('image', 'video') NOT NULL,
    `target_id` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_target`(`target_type`, `target_id`),
    UNIQUE INDEX `gallery_likes_user_id_target_type_target_id_key`(`user_id`, `target_type`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gallery_favorites` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `target_type` ENUM('image', 'video') NOT NULL,
    `target_id` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_user_time`(`user_id`, `created_at`),
    INDEX `gallery_favorite_idx_target`(`target_type`, `target_id`),
    UNIQUE INDEX `gallery_favorites_user_id_target_type_target_id_key`(`user_id`, `target_type`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gallery_comments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `target_type` ENUM('image', 'video') NOT NULL,
    `target_id` BIGINT NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_target_time`(`target_type`, `target_id`, `created_at`),
    INDEX `gc_idx_user_time`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_configs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NULL,
    `description` VARCHAR(500) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_configs_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcements` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `starts_at` DATETIME(3) NULL,
    `ends_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_active`(`is_active`, `is_pinned`, `sort_order`, `created_at`),
    INDEX `idx_window`(`starts_at`, `ends_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inbox_messages` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `level` VARCHAR(20) NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NULL,
    `related_type` VARCHAR(20) NULL,
    `related_id` BIGINT NULL,
    `dedup_key` VARCHAR(150) NULL,
    `meta` JSON NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `inbox_messages_dedup_key_key`(`dedup_key`),
    INDEX `idx_user_read`(`user_id`, `is_read`, `created_at`),
    INDEX `idx_related`(`user_id`, `related_type`, `related_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `templates` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `cover_url` VARCHAR(500) NULL,
    `prompt` TEXT NOT NULL,
    `type` ENUM('image', 'video', 'chat') NOT NULL,
    `model_id` BIGINT NULL,
    `parameters` JSON NULL,
    `category` VARCHAR(100) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_by` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_public_sort`(`is_public`, `created_by`, `sort_order`),
    INDEX `idx_type_public`(`type`, `is_public`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tools` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `notes` TEXT NULL,
    `cover_url` VARCHAR(500) NULL,
    `prompt` TEXT NOT NULL,
    `type` ENUM('image', 'video', 'chat') NOT NULL,
    `model_id` BIGINT NOT NULL,
    `image_count` INTEGER NOT NULL DEFAULT 1,
    `image_labels` JSON NULL,
    `parameters` JSON NULL,
    `category` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tool_idx_active_sort`(`is_active`, `sort_order`),
    INDEX `tool_idx_type_active`(`type`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_orders` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orderNo` VARCHAR(64) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `package_id` BIGINT NULL,
    `membership_level_id` BIGINT NULL,
    `membership_period` ENUM('monthly', 'yearly') NULL,
    `credits` INTEGER NULL,
    `order_type` VARCHAR(20) NOT NULL DEFAULT 'package',
    `amount` INTEGER NOT NULL,
    `status` ENUM('pending', 'paid', 'failed', 'expired') NOT NULL DEFAULT 'pending',
    `pay_type` VARCHAR(20) NOT NULL DEFAULT 'wechat_native',
    `transaction_id` VARCHAR(64) NULL,
    `code_url` VARCHAR(500) NULL,
    `expire_at` DATETIME(3) NOT NULL,
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_orders_orderNo_key`(`orderNo`),
    INDEX `idx_payment_user_status`(`user_id`, `status`),
    INDEX `idx_payment_order_no`(`orderNo`),
    INDEX `idx_payment_expire`(`expire_at`, `status`),
    INDEX `payment_order_idx_user_created`(`user_id`, `created_at`),
    INDEX `payment_order_idx_status_paid_at`(`status`, `paid_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_levels` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `name_en` VARCHAR(100) NULL,
    `color` VARCHAR(20) NOT NULL,
    `monthly_price` DECIMAL(10, 2) NOT NULL,
    `yearly_price` DECIMAL(10, 2) NOT NULL,
    `daily_credits` INTEGER NOT NULL DEFAULT 0,
    `bonus_permanent_credits` INTEGER NOT NULL DEFAULT 0,
    `benefits` JSON NULL,
    `benefits_en` JSON NULL,
    `permissions` JSON NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_membership_active_sort`(`is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_membership_schedules` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `membership_level_id` BIGINT NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `expire_at` DATETIME(3) NOT NULL,
    `rate_fen_per_day` DECIMAL(14, 6) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `membership_schedule_idx_user_start`(`user_id`, `starts_at`),
    INDEX `membership_schedule_idx_level_expire`(`membership_level_id`, `expire_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_conversations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `model_id` BIGINT NOT NULL,
    `project_context_id` BIGINT NULL,
    `title` VARCHAR(200) NOT NULL,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `composer_mode` VARCHAR(20) NULL,
    `last_message_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `chat_conv_idx_user_updated`(`user_id`, `updated_at`),
    INDEX `chat_conv_idx_user_pin_updated`(`user_id`, `is_pinned`, `updated_at`),
    INDEX `chat_conv_idx_model`(`model_id`),
    INDEX `chat_conv_idx_project_context`(`project_context_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_messages` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `conversation_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `role` ENUM('user', 'assistant', 'system') NOT NULL,
    `content` LONGTEXT NOT NULL,
    `images` JSON NULL,
    `files` JSON NULL,
    `provider_data` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chat_msg_idx_conv_time`(`conversation_id`, `created_at`),
    INDEX `chat_msg_idx_user_time`(`user_id`, `created_at`),
    INDEX `chat_msg_idx_user_role_time`(`user_id`, `role`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_moderation_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `conversation_id` BIGINT NULL,
    `model_id` BIGINT NOT NULL,
    `content` LONGTEXT NOT NULL,
    `reason` TEXT NULL,
    `provider_model` VARCHAR(100) NULL,
    `provider_response` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chat_moderation_idx_user_time`(`user_id`, `created_at`),
    INDEX `chat_moderation_idx_conv_time`(`conversation_id`, `created_at`),
    INDEX `chat_moderation_idx_model_time`(`model_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `input_moderation_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `model_id` BIGINT NULL,
    `source` VARCHAR(30) NOT NULL,
    `scene` VARCHAR(60) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `reason` TEXT NULL,
    `provider_model` VARCHAR(100) NULL,
    `provider_response` LONGTEXT NULL,
    `task_id` BIGINT NULL,
    `task_no` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `input_moderation_idx_user_time`(`user_id`, `created_at`),
    INDEX `input_moderation_idx_source_time`(`source`, `created_at`),
    INDEX `input_moderation_idx_scene_time`(`scene`, `created_at`),
    INDEX `input_moderation_idx_model_time`(`model_id`, `created_at`),
    INDEX `input_moderation_idx_task_time`(`task_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_files` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `conversation_id` BIGINT NULL,
    `project_asset_id` BIGINT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(120) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `extension` VARCHAR(20) NOT NULL,
    `extracted_text` LONGTEXT NOT NULL,
    `text_length` INTEGER NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `chat_files_project_asset_id_key`(`project_asset_id`),
    INDEX `chat_file_idx_conv_time`(`conversation_id`, `created_at`),
    INDEX `chat_file_idx_user_time`(`user_id`, `created_at`),
    INDEX `chat_file_idx_project_asset_time`(`project_asset_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_membership_level_id_fkey` FOREIGN KEY (`membership_level_id`) REFERENCES `membership_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_invited_by_id_fkey` FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_auth_events` ADD CONSTRAINT `user_auth_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redeem_codes` ADD CONSTRAINT `redeem_codes_membership_level_id_fkey` FOREIGN KEY (`membership_level_id`) REFERENCES `membership_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redeem_codes` ADD CONSTRAINT `redeem_codes_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redeem_logs` ADD CONSTRAINT `redeem_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redeem_logs` ADD CONSTRAINT `redeem_logs_code_id_fkey` FOREIGN KEY (`code_id`) REFERENCES `redeem_codes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redeem_logs` ADD CONSTRAINT `redeem_logs_membership_level_id_fkey` FOREIGN KEY (`membership_level_id`) REFERENCES `membership_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invite_reward_logs` ADD CONSTRAINT `invite_reward_logs_inviter_id_fkey` FOREIGN KEY (`inviter_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invite_reward_logs` ADD CONSTRAINT `invite_reward_logs_invitee_id_fkey` FOREIGN KEY (`invitee_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_logs` ADD CONSTRAINT `credit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_models` ADD CONSTRAINT `ai_models_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `api_channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_tasks` ADD CONSTRAINT `image_tasks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_tasks` ADD CONSTRAINT `image_tasks_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_tasks` ADD CONSTRAINT `image_tasks_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `api_channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_tasks` ADD CONSTRAINT `image_tasks_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_tasks` ADD CONSTRAINT `image_tasks_tool_id_fkey` FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_tasks` ADD CONSTRAINT `video_tasks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_tasks` ADD CONSTRAINT `video_tasks_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_tasks` ADD CONSTRAINT `video_tasks_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `api_channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_tasks` ADD CONSTRAINT `video_tasks_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_tasks` ADD CONSTRAINT `video_tasks_tool_id_fkey` FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_assets` ADD CONSTRAINT `project_assets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_assets` ADD CONSTRAINT `project_assets_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_assets` ADD CONSTRAINT `project_assets_image_task_id_fkey` FOREIGN KEY (`image_task_id`) REFERENCES `image_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_assets` ADD CONSTRAINT `project_assets_video_task_id_fkey` FOREIGN KEY (`video_task_id`) REFERENCES `video_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_inspirations` ADD CONSTRAINT `project_inspirations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_inspirations` ADD CONSTRAINT `project_inspirations_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_prompts` ADD CONSTRAINT `project_prompts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_prompts` ADD CONSTRAINT `project_prompts_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `research_tasks` ADD CONSTRAINT `research_tasks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `research_tasks` ADD CONSTRAINT `research_tasks_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `research_tasks` ADD CONSTRAINT `research_tasks_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `api_channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gallery_likes` ADD CONSTRAINT `gallery_likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gallery_favorites` ADD CONSTRAINT `gallery_favorites_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gallery_comments` ADD CONSTRAINT `gallery_comments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_messages` ADD CONSTRAINT `inbox_messages_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `templates` ADD CONSTRAINT `templates_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tools` ADD CONSTRAINT `tools_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_orders` ADD CONSTRAINT `payment_orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_orders` ADD CONSTRAINT `payment_orders_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_orders` ADD CONSTRAINT `payment_orders_membership_level_id_fkey` FOREIGN KEY (`membership_level_id`) REFERENCES `membership_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_membership_schedules` ADD CONSTRAINT `user_membership_schedules_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_membership_schedules` ADD CONSTRAINT `user_membership_schedules_membership_level_id_fkey` FOREIGN KEY (`membership_level_id`) REFERENCES `membership_levels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_conversations` ADD CONSTRAINT `chat_conversations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_conversations` ADD CONSTRAINT `chat_conversations_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_conversations` ADD CONSTRAINT `chat_conversations_project_context_id_fkey` FOREIGN KEY (`project_context_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_moderation_logs` ADD CONSTRAINT `chat_moderation_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_moderation_logs` ADD CONSTRAINT `chat_moderation_logs_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_moderation_logs` ADD CONSTRAINT `chat_moderation_logs_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `input_moderation_logs` ADD CONSTRAINT `input_moderation_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `input_moderation_logs` ADD CONSTRAINT `input_moderation_logs_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_files` ADD CONSTRAINT `chat_files_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_files` ADD CONSTRAINT `chat_files_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_files` ADD CONSTRAINT `chat_files_project_asset_id_fkey` FOREIGN KEY (`project_asset_id`) REFERENCES `project_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

