ALTER TABLE `projects` ADD `llm_share_links_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `variants` ADD `llm_share_links_text` text DEFAULT '' NOT NULL;