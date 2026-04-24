-- Merge legacy daily-limit package credits into membership daily credits.
-- This migration is written to be resume-friendly in partially-applied environments.

-- 1) Add new membership daily credit columns.
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `membership_daily_credits` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `membership_daily_date` DATE NULL;

ALTER TABLE `membership_levels`
  ADD COLUMN IF NOT EXISTS `daily_credits` INTEGER NOT NULL DEFAULT 0;

-- 2) Temporarily widen enums so data normalization can safely run.
ALTER TABLE `credit_logs`
  MODIFY `source` ENUM('permanent', 'package', 'membership') NOT NULL;

ALTER TABLE `redeem_codes`
  MODIFY `type` ENUM('package', 'credits', 'membership') NOT NULL;

ALTER TABLE `redeem_logs`
  MODIFY `type` ENUM('package', 'credits', 'membership') NOT NULL;

ALTER TABLE `image_tasks`
  MODIFY `credit_source` ENUM('permanent', 'package', 'membership') NULL;

ALTER TABLE `video_tasks`
  MODIFY `credit_source` ENUM('permanent', 'package', 'membership') NULL;

ALTER TABLE `research_tasks`
  MODIFY `credit_source` ENUM('permanent', 'package', 'membership') NULL;

-- 3) Normalize legacy values to new enum members.
UPDATE `credit_logs`
SET `source` = 'membership'
WHERE `source` = 'package';

UPDATE `image_tasks`
SET `credit_source` = 'membership'
WHERE `credit_source` = 'package';

UPDATE `video_tasks`
SET `credit_source` = 'membership'
WHERE `credit_source` = 'package';

UPDATE `research_tasks`
SET `credit_source` = 'membership'
WHERE `credit_source` = 'package';

UPDATE `redeem_codes`
SET `type` = 'membership'
WHERE `type` = 'package';

UPDATE `redeem_logs`
SET `type` = 'membership'
WHERE `type` = 'package';

-- 4) Drop legacy foreign keys only when they exist.
SET @drop_redeem_codes_package_fk = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'redeem_codes'
        AND CONSTRAINT_NAME = 'redeem_codes_package_id_fkey'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE `redeem_codes` DROP FOREIGN KEY `redeem_codes_package_id_fkey`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @drop_redeem_codes_package_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @drop_credit_logs_package_fk = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'credit_logs'
        AND CONSTRAINT_NAME = 'credit_logs_package_id_fkey'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE `credit_logs` DROP FOREIGN KEY `credit_logs_package_id_fkey`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @drop_credit_logs_package_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5) Reshape redeem/credit schemas.
ALTER TABLE `redeem_codes`
  DROP COLUMN IF EXISTS `package_id`;

ALTER TABLE `redeem_codes`
  ADD COLUMN IF NOT EXISTS `membership_level_id` BIGINT NULL,
  ADD COLUMN IF NOT EXISTS `membership_period` ENUM('monthly', 'yearly') NULL,
  ADD COLUMN IF NOT EXISTS `membership_cycles` INTEGER NULL DEFAULT 1,
  MODIFY `type` ENUM('membership', 'credits') NOT NULL;

ALTER TABLE `redeem_logs`
  DROP COLUMN IF EXISTS `package_id`;

ALTER TABLE `redeem_logs`
  ADD COLUMN IF NOT EXISTS `membership_level_id` BIGINT NULL,
  ADD COLUMN IF NOT EXISTS `membership_period` ENUM('monthly', 'yearly') NULL,
  ADD COLUMN IF NOT EXISTS `membership_cycles` INTEGER NULL DEFAULT 1,
  MODIFY `type` ENUM('membership', 'credits') NOT NULL;

ALTER TABLE `credit_logs`
  DROP COLUMN IF EXISTS `package_id`,
  MODIFY `source` ENUM('permanent', 'membership') NOT NULL;

ALTER TABLE `image_tasks`
  MODIFY `credit_source` ENUM('permanent', 'membership') NULL;

ALTER TABLE `video_tasks`
  MODIFY `credit_source` ENUM('permanent', 'membership') NULL;

ALTER TABLE `research_tasks`
  MODIFY `credit_source` ENUM('permanent', 'membership') NULL;

-- 6) Add new foreign keys only when absent.
SET @add_redeem_codes_membership_fk = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'redeem_codes'
        AND CONSTRAINT_NAME = 'redeem_codes_membership_level_id_fkey'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'SELECT 1',
    'ALTER TABLE `redeem_codes` ADD CONSTRAINT `redeem_codes_membership_level_id_fkey` FOREIGN KEY (`membership_level_id`) REFERENCES `membership_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
  )
);
PREPARE stmt FROM @add_redeem_codes_membership_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_redeem_logs_membership_fk = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'redeem_logs'
        AND CONSTRAINT_NAME = 'redeem_logs_membership_level_id_fkey'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'SELECT 1',
    'ALTER TABLE `redeem_logs` ADD CONSTRAINT `redeem_logs_membership_level_id_fkey` FOREIGN KEY (`membership_level_id`) REFERENCES `membership_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
  )
);
PREPARE stmt FROM @add_redeem_logs_membership_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7) Remove legacy table.
DROP TABLE IF EXISTS `user_packages`;
