-- Add idea_id to misfit_ideas to link back to the session idea for restore functionality
-- Nullable, no FK - idea id comes from client session state
ALTER TABLE misfit_ideas ADD COLUMN IF NOT EXISTS idea_id UUID;

