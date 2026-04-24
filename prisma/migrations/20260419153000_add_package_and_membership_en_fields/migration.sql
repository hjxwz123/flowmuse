ALTER TABLE `packages`
  ADD COLUMN `name_en` VARCHAR(100) NULL,
  ADD COLUMN `description_en` TEXT NULL;

ALTER TABLE `membership_levels`
  ADD COLUMN `name_en` VARCHAR(100) NULL,
  ADD COLUMN `benefits_en` JSON NULL;
