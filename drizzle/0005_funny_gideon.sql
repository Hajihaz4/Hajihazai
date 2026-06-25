CREATE TYPE "public"."knowledge_source_type" AS ENUM('pdf', 'text', 'website', 'note');--> statement-breakpoint
CREATE TYPE "public"."knowledge_status" AS ENUM('processing', 'active', 'failed');--> statement-breakpoint
CREATE TABLE "knowledge_document" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"sourceType" "knowledge_source_type" DEFAULT 'note' NOT NULL,
	"status" "knowledge_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_document" ADD CONSTRAINT "knowledge_document_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_document_user_idx" ON "knowledge_document" USING btree ("userId");