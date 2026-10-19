ALTER TABLE `members` ADD `card_revision` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `rolls` ADD `visibility` text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `keeper` text;