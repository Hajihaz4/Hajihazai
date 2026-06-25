CREATE TABLE "user_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text DEFAULT 'note' NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_memory" ADD CONSTRAINT "user_memory_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_memory_user_idx" ON "user_memory" USING btree ("userId");