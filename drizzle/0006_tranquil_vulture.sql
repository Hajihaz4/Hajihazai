CREATE TABLE "knowledge_content" (
	"id" text PRIMARY KEY NOT NULL,
	"documentId" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_content" ADD CONSTRAINT "knowledge_content_documentId_knowledge_document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."knowledge_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_content_document_idx" ON "knowledge_content" USING btree ("documentId");