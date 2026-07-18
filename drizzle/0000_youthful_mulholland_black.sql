CREATE TABLE `prompt_families` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`prompt_text` text DEFAULT '' NOT NULL,
	`reference_answer` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_urls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`added_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`used_at` text,
	`prompt_id` text,
	`variant_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_urls_url_unique` ON `source_urls` (`url`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`project` text NOT NULL,
	`submitted_at` text NOT NULL,
	`submission_ref` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_variant_id_unique` ON `submissions` (`variant_id`);--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_id` text NOT NULL,
	`project` text NOT NULL,
	`project_slug` text NOT NULL,
	`version` integer NOT NULL,
	`based_on` text NOT NULL,
	`prompt_text` text DEFAULT '' NOT NULL,
	`reference_answer` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variants_prompt_project_version_idx` ON `variants` (`prompt_id`,`project_slug`,`version`);