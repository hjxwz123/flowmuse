ALTER TABLE `projects`
  ADD COLUMN `concept` TEXT NULL AFTER `name`;

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

ALTER TABLE `project_inspirations`
  ADD CONSTRAINT `project_inspirations_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE `project_inspirations`
  ADD CONSTRAINT `project_inspirations_project_id_fkey`
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
