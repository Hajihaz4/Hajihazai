ALTER TABLE "knowledge_document" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;