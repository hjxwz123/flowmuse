ALTER TABLE `chat_conversations`
ADD COLUMN `is_pinned` TINYINT(1) NOT NULL DEFAULT 0 AFTER `title`;

CREATE INDEX `chat_conv_idx_user_pin_updated`
ON `chat_conversations`(`user_id`, `is_pinned`, `updated_at`);
