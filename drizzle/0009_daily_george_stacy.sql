CREATE TYPE "public"."tool_invocation_status" AS ENUM('success', 'error', 'timeout');--> statement-breakpoint
CREATE TABLE "tool_invocation" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"toolName" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"status" "tool_invocation_status" NOT NULL,
	"durationMs" integer NOT NULL,
	"error" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tool_invocation" ADD CONSTRAINT "tool_invocation_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tool_invocation_user_idx" ON "tool_invocation" USING btree ("userId");