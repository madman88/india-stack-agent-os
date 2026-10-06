CREATE TABLE `business_access` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`consent_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviewer_access` (
	`business_id` text NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`active` integer DEFAULT 1 NOT NULL,
	`granted_by` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`business_id`, `email`)
);
--> statement-breakpoint
CREATE INDEX `idx_reviewer_business_user` ON `reviewer_access` (`business_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `aa_audit_events` ADD `actor_user_id` text;--> statement-breakpoint
ALTER TABLE `aa_audit_events` ADD `actor_role` text;