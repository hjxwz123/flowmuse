CREATE TABLE `dashboard_daily_metrics` (
  `date` DATE NOT NULL,
  `new_users` INTEGER NOT NULL DEFAULT 0,
  `image_completed` INTEGER NOT NULL DEFAULT 0,
  `image_failed` INTEGER NOT NULL DEFAULT 0,
  `video_completed` INTEGER NOT NULL DEFAULT 0,
  `video_failed` INTEGER NOT NULL DEFAULT 0,
  `paid_orders` INTEGER NOT NULL DEFAULT 0,
  `revenue_fen` INTEGER NOT NULL DEFAULT 0,
  `credits_issued` INTEGER NOT NULL DEFAULT 0,
  `credits_used` INTEGER NOT NULL DEFAULT 0,
  `refreshed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `dashboard_metric_idx_refreshed`(`refreshed_at`),
  PRIMARY KEY (`date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `users_created_at_idx` ON `users` (`created_at`);
CREATE INDEX `credit_log_idx_time_type` ON `credit_logs` (`created_at`, `type`);

CREATE INDEX `image_task_idx_user_status_created`
  ON `image_tasks` (`user_id`, `status`, `created_at`);
CREATE INDEX `image_task_idx_channel_status_completed`
  ON `image_tasks` (`channel_id`, `status`, `completed_at`);
CREATE INDEX `image_task_idx_status_completed`
  ON `image_tasks` (`status`, `completed_at`);

CREATE INDEX `video_task_idx_user_status_created`
  ON `video_tasks` (`user_id`, `status`, `created_at`);
CREATE INDEX `video_task_idx_channel_status_completed`
  ON `video_tasks` (`channel_id`, `status`, `completed_at`);
CREATE INDEX `video_task_idx_status_completed`
  ON `video_tasks` (`status`, `completed_at`);

CREATE INDEX `research_task_idx_user_status_time`
  ON `research_tasks` (`user_id`, `status`, `created_at`);

CREATE INDEX `gallery_favorite_idx_target`
  ON `gallery_favorites` (`target_type`, `target_id`);

CREATE INDEX `payment_order_idx_user_created`
  ON `payment_orders` (`user_id`, `created_at`);
CREATE INDEX `payment_order_idx_status_paid_at`
  ON `payment_orders` (`status`, `paid_at`);

CREATE INDEX `chat_msg_idx_user_role_time`
  ON `chat_messages` (`user_id`, `role`, `created_at`);
