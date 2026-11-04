CREATE TABLE `admin_bootstrap` (
	`id` text PRIMARY KEY NOT NULL,
	`completedAt` integer,
	`completedBy` text,
	FOREIGN KEY (`completedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `release_overrides` (
	`tagName` text PRIMARY KEY NOT NULL,
	`releaseName` text,
	`releaseNotes` text,
	`isPublished` integer DEFAULT true NOT NULL,
	`updatedBy` text,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`updatedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `targetType` text;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `targetId` text;--> statement-breakpoint
ALTER TABLE `session` ADD `impersonatedBy` text;--> statement-breakpoint
ALTER TABLE `testimonials` ADD `title` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `testimonials` ADD `userId` text REFERENCES `user`(`id`) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `testimonials` ADD `designation` text;--> statement-breakpoint
ALTER TABLE `testimonials` ADD `publicConsent` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `testimonials` ADD `displayNameConsent` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `testimonials` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `testimonials` ADD `updatedAt` integer;--> statement-breakpoint
UPDATE `testimonials` SET `updatedAt` = `createdAt` WHERE `updatedAt` IS NULL;--> statement-breakpoint
UPDATE `testimonials` SET `title` = 'Community feedback' WHERE `title` = '';--> statement-breakpoint
UPDATE `testimonials` SET `status` = 'approved' WHERE `approvedAt` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `testimonials` ADD `reviewedBy` text REFERENCES `user`(`id`) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `testimonials` ADD `reviewedAt` integer;--> statement-breakpoint
UPDATE `testimonials` SET `reviewedAt` = `approvedAt` WHERE `approvedAt` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `testimonials_userId_unique` ON `testimonials` (`userId`);--> statement-breakpoint
CREATE INDEX `testimonials_status_idx` ON `testimonials` (`status`);--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `banReason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banExpires` integer;