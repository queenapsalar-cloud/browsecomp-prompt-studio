ALTER TABLE `prompt_families` ADD `source_urls` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `prompt_families` ADD `logic_trace` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `variants` ADD `logic_trace` text DEFAULT '' NOT NULL;