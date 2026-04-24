-- Add model-level icon so icon can be configured per model
ALTER TABLE `ai_models`
ADD COLUMN `icon` TEXT NULL;

-- Backfill existing provider icon into model icon for a smooth transition
UPDATE `ai_models` AS m
LEFT JOIN `model_providers` AS p ON p.`provider` = m.`provider`
SET m.`icon` = p.`icon`
WHERE m.`icon` IS NULL;
