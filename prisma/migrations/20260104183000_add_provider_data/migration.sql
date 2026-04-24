-- Add provider_data to image_tasks and video_tasks
ALTER TABLE `image_tasks` ADD COLUMN `provider_data` JSON NULL;
ALTER TABLE `video_tasks` ADD COLUMN `provider_data` JSON NULL;
