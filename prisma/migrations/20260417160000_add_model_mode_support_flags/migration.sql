ALTER TABLE `ai_models`
  ADD COLUMN `supports_quick_mode` BOOLEAN NULL,
  ADD COLUMN `supports_agent_mode` BOOLEAN NULL,
  ADD COLUMN `supports_auto_mode` BOOLEAN NULL;
