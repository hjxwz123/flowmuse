-- Add membership fields to users
ALTER TABLE `users`
  ADD COLUMN `membership_level_id` BIGINT NULL,
  ADD COLUMN `membership_expire_at` DATETIME(3) NULL;

-- Create membership levels table
CREATE TABLE `membership_levels` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `color` VARCHAR(20) NOT NULL,
  `monthly_price` DECIMAL(10, 2) NOT NULL,
  `yearly_price` DECIMAL(10, 2) NOT NULL,
  `benefits` JSON NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `idx_membership_active_sort`(`is_active`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add membership fields to payment orders
ALTER TABLE `payment_orders`
  ADD COLUMN `membership_level_id` BIGINT NULL,
  ADD COLUMN `membership_period` ENUM('monthly', 'yearly') NULL;

-- Add foreign keys
ALTER TABLE `users`
  ADD CONSTRAINT `users_membership_level_id_fkey`
  FOREIGN KEY (`membership_level_id`) REFERENCES `membership_levels`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `payment_orders`
  ADD CONSTRAINT `payment_orders_membership_level_id_fkey`
  FOREIGN KEY (`membership_level_id`) REFERENCES `membership_levels`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
