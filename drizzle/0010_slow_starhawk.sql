ALTER TABLE "tool_invocation" ADD COLUMN "inputSize" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_invocation" ADD COLUMN "outputSize" integer DEFAULT 0 NOT NULL;