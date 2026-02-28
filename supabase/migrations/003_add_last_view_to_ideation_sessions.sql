-- Add last_view to track where user left off for return-to-place
ALTER TABLE ideation_sessions ADD COLUMN IF NOT EXISTS last_view TEXT;

