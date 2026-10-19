CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`object_key` text,
	`file_name` text,
	`mime` text,
	`size` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`released` integer,
	`revision` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `materials_room_created` ON `materials` (`room`,`created`);