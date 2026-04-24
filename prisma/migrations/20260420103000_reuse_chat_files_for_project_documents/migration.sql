ALTER TABLE `chat_files`
  DROP FOREIGN KEY `chat_files_conversation_id_fkey`;

ALTER TABLE `chat_files`
  MODIFY `conversation_id` BIGINT NULL,
  ADD COLUMN `project_asset_id` BIGINT NULL;

ALTER TABLE `chat_files`
  ADD UNIQUE INDEX `chat_files_project_asset_id_key`(`project_asset_id`),
  ADD INDEX `chat_file_idx_project_asset_time`(`project_asset_id`, `created_at`);

ALTER TABLE `chat_files`
  ADD CONSTRAINT `chat_files_conversation_id_fkey`
  FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `chat_files`
  ADD CONSTRAINT `chat_files_project_asset_id_fkey`
  FOREIGN KEY (`project_asset_id`) REFERENCES `project_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
