ALTER TABLE `chat_conversations`
  ADD COLUMN `composer_mode` VARCHAR(20) NULL AFTER `is_pinned`;
