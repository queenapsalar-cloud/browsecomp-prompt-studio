CREATE TABLE `prompt_model_tests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` text NOT NULL,
	`model` text NOT NULL,
	`result` text NOT NULL,
	`tested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_model_tests_prompt_model_idx` ON `prompt_model_tests` (`prompt_id`,`model`);