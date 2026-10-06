CREATE TABLE `aa_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`consent_id` text NOT NULL,
	`session_id` text,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_aa_audit_consent_time` ON `aa_audit_events` (`consent_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `aa_fetch_requests` (
	`consent_id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`state` text NOT NULL,
	`session_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `aa_rail_records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`consent_id` text NOT NULL,
	`status` text NOT NULL,
	`observed_at` text NOT NULL,
	`expires_at` text,
	`data_from` text,
	`data_to` text
);
--> statement-breakpoint
CREATE INDEX `idx_aa_records_consent` ON `aa_rail_records` (`consent_id`,`kind`,`observed_at`);