CREATE TYPE "public"."knowledge_visibility" AS ENUM('private', 'global');--> statement-breakpoint
CREATE TABLE "blocked_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_emails_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "brains" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text DEFAULT '🧠' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brains_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "knowledge_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"action" text NOT NULL,
	"document_id" text,
	"document_title" text NOT NULL,
	"content_before" text,
	"content_after" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"granted_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_permissions_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"target_type" text DEFAULT 'all' NOT NULL,
	"sent_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"notification_id" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_document" ADD COLUMN "brain_id" text;--> statement-breakpoint
ALTER TABLE "knowledge_document" ADD COLUMN "visibility" "knowledge_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_memory" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "user_memory" ADD COLUMN "importance" integer;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "is_disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "is_terminated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "is_suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "knowledge_audit_log" ADD CONSTRAINT "knowledge_audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocked_emails_email_idx" ON "blocked_emails" USING btree ("email");--> statement-breakpoint
CREATE INDEX "brains_slug_idx" ON "brains" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "knowledge_audit_log_user_idx" ON "knowledge_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "knowledge_audit_log_created_idx" ON "knowledge_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "knowledge_permissions_email_idx" ON "knowledge_permissions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_sent_idx" ON "notifications" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "user_notifications_user_idx" ON "user_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_notifications_notification_idx" ON "user_notifications" USING btree ("notification_id");--> statement-breakpoint
ALTER TABLE "knowledge_document" ADD CONSTRAINT "knowledge_document_brain_id_brains_id_fk" FOREIGN KEY ("brain_id") REFERENCES "public"."brains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_project_idx" ON "conversation" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "knowledge_document_project_idx" ON "knowledge_document" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "knowledge_document_brain_idx" ON "knowledge_document" USING btree ("brain_id");--> statement-breakpoint
CREATE INDEX "password_reset_expires_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_profiles_created_idx" ON "user_profiles" USING btree ("created_at");