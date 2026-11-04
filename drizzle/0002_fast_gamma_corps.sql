CREATE TABLE `billing_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`stripeCustomerId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_customers_userId_unique` ON `billing_customers` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `billing_customers_stripeCustomerId_unique` ON `billing_customers` (`stripeCustomerId`);--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`brand` text NOT NULL,
	`last4` text NOT NULL,
	`expiryMonth` integer NOT NULL,
	`expiryYear` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payment_methods_userId_idx` ON `payment_methods` (`userId`);--> statement-breakpoint
CREATE TABLE `profile_details` (
	`userId` text PRIMARY KEY NOT NULL,
	`gender` text,
	`organization` text,
	`currentPosition` text,
	`avatar` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
