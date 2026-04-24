ALTER TABLE `ai_models`
  ADD COLUMN `max_context_rounds` INTEGER NULL;

ALTER TABLE `chat_messages`
  ADD COLUMN `files` JSON NULL;

CREATE TABLE `chat_files` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `conversation_id` BIGINT NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(120) NOT NULL,
  `file_size` INTEGER NOT NULL,
  `extension` VARCHAR(20) NOT NULL,
  `extracted_text` LONGTEXT NOT NULL,
  `text_length` INTEGER NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `error_message` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `chat_file_idx_conv_time`(`conversation_id`, `created_at`),
  INDEX `chat_file_idx_user_time`(`user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `chat_files`
  ADD CONSTRAINT `chat_files_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `chat_files`
  ADD CONSTRAINT `chat_files_conversation_id_fkey`
  FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
