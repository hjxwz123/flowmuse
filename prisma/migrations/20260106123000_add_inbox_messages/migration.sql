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

-- AddForeignKey
ALTER TABLE `inbox_messages` ADD CONSTRAINT `inbox_messages_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

