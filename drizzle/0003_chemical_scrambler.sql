ALTER TABLE `projects` ADD `details` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `dsp_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `fanouts_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `variants` ADD `dsp_text` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `variants` ADD `fanouts_text` text DEFAULT '' NOT NULL;