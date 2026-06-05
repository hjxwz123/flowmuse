-- Allow physically deleting chat models while preserving historical chat data.
ALTER TABLE `research_tasks` DROP FOREIGN KEY `research_tasks_model_id_fkey`;
ALTER TABLE `chat_conversations` DROP FOREIGN KEY `chat_conversations_model_id_fkey`;
ALTER TABLE `chat_moderation_logs` DROP FOREIGN KEY `chat_moderation_logs_model_id_fkey`;

ALTER TABLE `research_tasks` MODIFY `model_id` BIGINT NULL;
ALTER TABLE `chat_conversations` MODIFY `model_id` BIGINT NULL;
ALTER TABLE `chat_moderation_logs` MODIFY `model_id` BIGINT NULL;

ALTER TABLE `research_tasks` ADD CONSTRAINT `research_tasks_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `chat_conversations` ADD CONSTRAINT `chat_conversations_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `chat_moderation_logs` ADD CONSTRAINT `chat_moderation_logs_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
