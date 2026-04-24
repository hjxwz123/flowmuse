ALTER TABLE `ai_models`
  ADD COLUMN `deep_research_credits_cost` INTEGER NULL;

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
  `credit_source` ENUM('permanent', 'package') NULL,
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
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `research_tasks`
  ADD CONSTRAINT `research_tasks_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `research_tasks`
  ADD CONSTRAINT `research_tasks_model_id_fkey`
  FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `research_tasks`
  ADD CONSTRAINT `research_tasks_channel_id_fkey`
  FOREIGN KEY (`channel_id`) REFERENCES `api_channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
