ALTER TABLE `users`
  ADD COLUMN `membership_rate_fen_per_day` DECIMAL(14, 6) NULL AFTER `membership_expire_at`;

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

ALTER TABLE `user_membership_schedules`
  ADD CONSTRAINT `user_membership_schedules_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_membership_schedules_membership_level_id_fkey`
    FOREIGN KEY (`membership_level_id`) REFERENCES `membership_levels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
