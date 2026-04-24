ALTER TABLE `chat_conversations`
  ADD COLUMN `project_context_id` BIGINT NULL;

ALTER TABLE `chat_conversations`
  ADD INDEX `chat_conv_idx_project_context`(`project_context_id`);

ALTER TABLE `chat_conversations`
  ADD CONSTRAINT `chat_conversations_project_context_id_fkey`
  FOREIGN KEY (`project_context_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
