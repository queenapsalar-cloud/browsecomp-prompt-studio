CREATE TABLE `variant_model_tests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`variant_id` text NOT NULL,
	`model` text NOT NULL,
	`result` text NOT NULL,
	`tested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variant_model_tests_variant_model_idx` ON `variant_model_tests` (`variant_id`,`model`);--> statement-breakpoint
ALTER TABLE `prompt_families` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `prompt_families` ADD `archive_reason` text;