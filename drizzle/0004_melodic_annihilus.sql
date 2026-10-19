CREATE TABLE `identity_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`started` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `identity_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`user` text NOT NULL,
	`auth_version` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `identity_sessions` (`expires`);--> statement-breakpoint
ALTER TABLE `members` ADD `password_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `password_salt` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `auth_version` integer DEFAULT 0 NOT NULL;