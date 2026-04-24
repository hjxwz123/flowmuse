-- Add per-model capability flags for frontend controls.
ALTER TABLE `ai_models`
ADD COLUMN `supports_image_input` BOOLEAN NULL,
ADD COLUMN `supports_resolution_select` BOOLEAN NULL,
ADD COLUMN `supports_size_select` BOOLEAN NULL;
