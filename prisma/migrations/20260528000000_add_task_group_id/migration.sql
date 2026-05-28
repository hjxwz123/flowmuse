ALTER TABLE `image_tasks`
  ADD COLUMN `task_group_id` VARCHAR(64) NULL;

ALTER TABLE `video_tasks`
  ADD COLUMN `task_group_id` VARCHAR(64) NULL;

CREATE INDEX `image_task_idx_group_time` ON `image_tasks`(`task_group_id`, `created_at`);
CREATE INDEX `video_task_idx_group_time` ON `video_tasks`(`task_group_id`, `created_at`);
