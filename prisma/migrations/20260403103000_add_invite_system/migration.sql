ALTER TABLE `users`
  ADD COLUMN `invite_code` VARCHAR(32) NULL,
  ADD COLUMN `invited_by_id` BIGINT NULL,
  ADD COLUMN `invited_at` DATETIME(3) NULL;

CREATE UNIQUE INDEX `users_invite_code_key` ON `users`(`invite_code`);
CREATE INDEX `users_invited_by_id_idx` ON `users`(`invited_by_id`);

ALTER TABLE `users`
  ADD CONSTRAINT `users_invited_by_id_fkey`
  FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

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

ALTER TABLE `invite_reward_logs`
  ADD CONSTRAINT `invite_reward_logs_inviter_id_fkey`
  FOREIGN KEY (`inviter_id`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE `invite_reward_logs`
  ADD CONSTRAINT `invite_reward_logs_invitee_id_fkey`
  FOREIGN KEY (`invitee_id`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
