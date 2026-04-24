ALTER TABLE `ai_models`
  ADD COLUMN `free_user_daily_question_limit` INTEGER NULL,
  ADD COLUMN `member_daily_question_limit` INTEGER NULL;
