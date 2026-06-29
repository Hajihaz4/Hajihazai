-- Migration 0016: Global Knowledge Layer
-- Adds a visibility field to knowledge_document so documents can be
-- marked global (visible to all authenticated users) instead of
-- private (visible only to the owner). Haji Core docs are migrated
-- to global automatically.

-- 1. Create the visibility enum
CREATE TYPE "knowledge_visibility" AS ENUM ('private', 'global');

-- 2. Add visibility column (all existing docs default to private)
ALTER TABLE "knowledge_document"
  ADD COLUMN "visibility" "knowledge_visibility" NOT NULL DEFAULT 'private';

-- 3. Mark all Haji Core documents as global.
-- Covers both brain-assigned docs (if brains are seeded) and title-based match.
UPDATE "knowledge_document"
SET "visibility" = 'global'
WHERE "brain_id" IN (SELECT "id" FROM "brains" WHERE "slug" = 'haji-core')
   OR "title" ILIKE 'Haji%';

