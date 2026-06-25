CREATE TABLE "knowledge_chunk" (
	"id" text PRIMARY KEY NOT NULL,
	"documentId" text NOT NULL,
	"chunkIndex" integer NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_chunk" ADD CONSTRAINT "knowledge_chunk_documentId_knowledge_document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."knowledge_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_chunk_document_idx" ON "knowledge_chunk" USING btree ("documentId");