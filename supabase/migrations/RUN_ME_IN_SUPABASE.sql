-- Safe migrations: ADD COLUMN IF NOT EXISTS
-- Existing data is untouched. New columns are nullable; existing rows get NULL.

-- 1. Add idea_id to misfit_ideas (for "Restore Idea" feature)
ALTER TABLE misfit_ideas ADD COLUMN IF NOT EXISTS idea_id UUID;

-- 2. Add last_view to ideation_sessions (for return-to-place in ideation)
ALTER TABLE ideation_sessions ADD COLUMN IF NOT EXISTS last_view TEXT;

