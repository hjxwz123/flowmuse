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

ALTER TABLE `project_prompts`
  ADD CONSTRAINT `project_prompts_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `project_prompts`
  ADD CONSTRAINT `project_prompts_project_id_fkey`
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
