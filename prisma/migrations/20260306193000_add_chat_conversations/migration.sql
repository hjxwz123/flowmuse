-- Extend model type enum values to support chat models.
ALTER TABLE `ai_models`
MODIFY `type` ENUM('image', 'video', 'chat') NOT NULL;

ALTER TABLE `templates`
MODIFY `type` ENUM('image', 'video', 'chat') NOT NULL;

ALTER TABLE `tools`
MODIFY `type` ENUM('image', 'video', 'chat') NOT NULL;

-- Create chat conversations and messages tables.
CREATE TABLE `chat_conversations` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `model_id` BIGINT NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `last_message_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `chat_conv_idx_user_updated`(`user_id`, `updated_at`),
  INDEX `chat_conv_idx_model`(`model_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `chat_messages` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `conversation_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `role` ENUM('user', 'assistant', 'system') NOT NULL,
  `content` LONGTEXT NOT NULL,
  `images` JSON NULL,
  `provider_data` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `chat_msg_idx_conv_time`(`conversation_id`, `created_at`),
  INDEX `chat_msg_idx_user_time`(`user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `chat_conversations`
ADD CONSTRAINT `chat_conversations_user_id_fkey`
FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `chat_conversations`
ADD CONSTRAINT `chat_conversations_model_id_fkey`
FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `chat_messages`
ADD CONSTRAINT `chat_messages_conversation_id_fkey`
FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `chat_messages`
ADD CONSTRAINT `chat_messages_user_id_fkey`
FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
