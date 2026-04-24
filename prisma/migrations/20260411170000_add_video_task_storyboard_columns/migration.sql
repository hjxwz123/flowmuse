ALTER TABLE `video_tasks`
  ADD COLUMN `auto_project_shot_id` VARCHAR(120) NULL,
  ADD COLUMN `auto_project_workflow_stage` VARCHAR(40) NULL,
  ADD COLUMN `auto_project_final_storyboard` BOOLEAN NULL;

UPDATE `video_tasks`
SET
  `auto_project_shot_id` = NULLIF(
    JSON_UNQUOTE(JSON_EXTRACT(`provider_data`, '$.autoProjectAsset.shotId')),
    ''
  ),
  `auto_project_workflow_stage` = NULLIF(
    JSON_UNQUOTE(JSON_EXTRACT(`provider_data`, '$.autoProjectAsset.workflowStage')),
    ''
  ),
  `auto_project_final_storyboard` = CASE
    WHEN JSON_EXTRACT(`provider_data`, '$.autoProjectAsset.finalStoryboard') = TRUE THEN TRUE
    WHEN JSON_EXTRACT(`provider_data`, '$.autoProjectAsset.finalStoryboard') = FALSE THEN FALSE
    ELSE NULL
  END
WHERE `provider_data` IS NOT NULL;

CREATE INDEX `idx_project_storyboard_lookup`
  ON `video_tasks` (`project_id`, `auto_project_final_storyboard`, `auto_project_shot_id`, `created_at`);

CREATE INDEX `idx_project_auto_stage_time`
  ON `video_tasks` (`project_id`, `auto_project_workflow_stage`, `created_at`);
