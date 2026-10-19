CREATE TABLE `members` (
	`room` text NOT NULL,
	`user` text NOT NULL,
	`name` text NOT NULL,
	`card` text NOT NULL,
	`seen` integer NOT NULL,
	`last_roll` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`room`, `user`)
);
--> statement-breakpoint
CREATE TABLE `rolls` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`user` text NOT NULL,
	`data` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rolls_room_created` ON `rolls` (`room`,`created`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`created` integer NOT NULL
);
