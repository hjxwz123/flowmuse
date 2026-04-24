-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `username` VARCHAR(100) NULL,
    `avatar` VARCHAR(500) NULL,
    `permanent_credits` INTEGER NOT NULL DEFAULT 0,
    `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    `status` ENUM('active', 'banned') NOT NULL DEFAULT 'active',
    `email_verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `packages` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `duration_days` INTEGER NOT NULL,
    `credits_per_day` INTEGER NOT NULL,
    `total_credits` INTEGER NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `original_price` DECIMAL(10, 2) NULL,
    `description` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_packages` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `package_id` BIGINT NOT NULL,
    `total_credits` INTEGER NOT NULL,
    `used_credits` INTEGER NOT NULL DEFAULT 0,
    `remaining_credits` INTEGER NOT NULL,
    `start_date` DATE NOT NULL,
    `expire_date` DATE NOT NULL,
    `status` ENUM('active', 'expired', 'exhausted') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_user_expire`(`user_id`, `expire_date`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `redeem_codes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `type` ENUM('package', 'credits') NOT NULL,
    `package_id` BIGINT NULL,
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
    `type` ENUM('package', 'credits') NOT NULL,
    `package_id` BIGINT NULL,
    `credits` INTEGER NULL,
    `redeemed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_user_code`(`user_id`, `code_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `amount` INTEGER NOT NULL,
    `balance_after` INTEGER NOT NULL,
    `type` ENUM('redeem', 'consume', 'refund', 'admin_adjust') NOT NULL,
    `source` ENUM('permanent', 'package') NOT NULL,
    `package_id` BIGINT NULL,
    `related_id` BIGINT NULL,
    `description` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_user_time`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
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
    `type` ENUM('image', 'video') NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `channel_id` BIGINT NOT NULL,
    `credits_per_use` INTEGER NOT NULL,
    `default_params` JSON NULL,
    `param_constraints` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
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
    `icon` VARCHAR(500) NULL,
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
    `task_no` VARCHAR(64) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `provider_task_id` VARCHAR(255) NULL,
    `prompt` TEXT NOT NULL,
    `negative_prompt` TEXT NULL,
    `parameters` JSON NULL,
    `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL,
    `result_url` VARCHAR(500) NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `oss_key` VARCHAR(500) NULL,
    `credits_cost` INTEGER NULL,
    `credit_source` ENUM('permanent', 'package') NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `error_message` TEXT NULL,
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `image_tasks_task_no_key`(`task_no`),
    INDEX `idx_user_time`(`user_id`, `created_at`),
    INDEX `idx_public`(`is_public`, `status`, `created_at`),
    INDEX `idx_provider_task`(`provider`, `provider_task_id`),
    INDEX `idx_status`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_tasks` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `model_id` BIGINT NOT NULL,
    `channel_id` BIGINT NOT NULL,
    `task_no` VARCHAR(64) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `provider_task_id` VARCHAR(255) NULL,
    `prompt` TEXT NOT NULL,
    `parameters` JSON NULL,
    `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL,
    `result_url` VARCHAR(500) NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `oss_key` VARCHAR(500) NULL,
    `credits_cost` INTEGER NULL,
    `credit_source` ENUM('permanent', 'package') NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `error_message` TEXT NULL,
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `video_tasks_task_no_key`(`task_no`),
    INDEX `idx_user_time`(`user_id`, `created_at`),
    INDEX `idx_public`(`is_public`, `status`, `created_at`),
    INDEX `idx_provider_task`(`provider`, `provider_task_id`),
    INDEX `idx_status`(`status`, `created_at`),
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
    UNIQUE INDEX `gallery_favorites_user_id_target_type_target_id_key`(`user_id`, `target_type`, `target_id`),
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

-- AddForeignKey
ALTER TABLE `user_packages` ADD CONSTRAINT `user_packages_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_packages` ADD CONSTRAINT `user_packages_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redeem_codes` ADD CONSTRAINT `redeem_codes_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redeem_codes` ADD CONSTRAINT `redeem_codes_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redeem_logs` ADD CONSTRAINT `redeem_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redeem_logs` ADD CONSTRAINT `redeem_logs_code_id_fkey` FOREIGN KEY (`code_id`) REFERENCES `redeem_codes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_logs` ADD CONSTRAINT `credit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_logs` ADD CONSTRAINT `credit_logs_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `user_packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_models` ADD CONSTRAINT `ai_models_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `api_channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_tasks` ADD CONSTRAINT `image_tasks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_tasks` ADD CONSTRAINT `image_tasks_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_tasks` ADD CONSTRAINT `image_tasks_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `api_channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_tasks` ADD CONSTRAINT `video_tasks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_tasks` ADD CONSTRAINT `video_tasks_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_tasks` ADD CONSTRAINT `video_tasks_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `api_channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gallery_likes` ADD CONSTRAINT `gallery_likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gallery_favorites` ADD CONSTRAINT `gallery_favorites_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

