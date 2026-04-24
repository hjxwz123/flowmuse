CREATE TABLE `projects` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `project_idx_user_time`(`user_id`, `updated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `project_assets` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `project_id` BIGINT NOT NULL,
  `kind` ENUM('image', 'video') NOT NULL,
  `source` ENUM('upload', 'task') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
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

  UNIQUE INDEX `project_asset_project_image_task_unique`(`project_id`, `image_task_id`),
  UNIQUE INDEX `project_asset_project_video_task_unique`(`project_id`, `video_task_id`),
  INDEX `project_asset_idx_project_time`(`project_id`, `created_at`),
  INDEX `project_asset_idx_user_time`(`user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `image_tasks`
  ADD COLUMN `project_id` BIGINT NULL;

ALTER TABLE `video_tasks`
  ADD COLUMN `project_id` BIGINT NULL;

CREATE INDEX `idx_project_time` ON `image_tasks`(`project_id`, `created_at`);
CREATE INDEX `idx_project_time` ON `video_tasks`(`project_id`, `created_at`);

ALTER TABLE `projects`
  ADD CONSTRAINT `projects_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE `project_assets`
  ADD CONSTRAINT `project_assets_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE `project_assets`
  ADD CONSTRAINT `project_assets_project_id_fkey`
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE `project_assets`
  ADD CONSTRAINT `project_assets_image_task_id_fkey`
  FOREIGN KEY (`image_task_id`) REFERENCES `image_tasks`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE `project_assets`
  ADD CONSTRAINT `project_assets_video_task_id_fkey`
  FOREIGN KEY (`video_task_id`) REFERENCES `video_tasks`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE `image_tasks`
  ADD CONSTRAINT `image_tasks_project_id_fkey`
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE `video_tasks`
  ADD CONSTRAINT `video_tasks_project_id_fkey`
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
