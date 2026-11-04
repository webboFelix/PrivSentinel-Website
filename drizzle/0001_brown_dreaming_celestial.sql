CREATE TABLE `testimonials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`location` text,
	`quote` text NOT NULL,
	`rating` integer NOT NULL,
	`approvedAt` integer,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `testimonials_approvedAt_idx` ON `testimonials` (`approvedAt`);