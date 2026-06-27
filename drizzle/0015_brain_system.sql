-- Brain System Sprint: brains table, brainId on knowledge_document,
-- title/importance on user_memory.

-- 1. Create brains table
CREATE TABLE IF NOT EXISTS "brains" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "icon" text NOT NULL DEFAULT '🧠',
  "color" text NOT NULL DEFAULT '#6366f1',
  "is_system" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "brains_slug_unique" ON "brains" ("slug");
CREATE INDEX IF NOT EXISTS "brains_slug_idx" ON "brains" ("slug");

-- 2. Seed the 4 system brains
INSERT INTO "brains" ("id", "name", "slug", "description", "icon", "color", "is_system") VALUES
  (gen_random_uuid(), 'Haji Core',        'haji-core',  'Personal identity, family, education, goals, friends, hobbies, preferences, life story.', '🧠', '#6366f1', true),
  (gen_random_uuid(), 'Suplaykart Brain', 'suplaykart', 'Business operations, vendors, delivery model, finances, growth plans, roadmap, marketing.', '🏪', '#10b981', true),
  (gen_random_uuid(), 'AllBee Brain',     'allbee',     'Clients, projects, services, pricing, digital marketing, development operations.', '🚀', '#f59e0b', true),
  (gen_random_uuid(), 'Legal Brain',      'legal',      'LLB notes, constitutional law, company law, case law, legal studies, exam preparation.', '⚖️', '#8b5cf6', true)
ON CONFLICT ("slug") DO NOTHING;

-- 3. Add brainId to knowledge_document
ALTER TABLE "knowledge_document"
  ADD COLUMN IF NOT EXISTS "brain_id" text REFERENCES "brains"("id") ON DELETE SET NULL;

-- 4. Add title and importance to user_memory
ALTER TABLE "user_memory"
  ADD COLUMN IF NOT EXISTS "title" text,
  ADD COLUMN IF NOT EXISTS "importance" integer;
