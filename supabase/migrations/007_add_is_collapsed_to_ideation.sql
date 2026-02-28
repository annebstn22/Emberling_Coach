-- Add is_collapsed column to ideation_sessions to persist collapsed state
ALTER TABLE ideation_sessions 
ADD COLUMN IF NOT EXISTS is_collapsed BOOLEAN DEFAULT false;

-- Add is_collapsed column to threader_projects to persist collapsed state
ALTER TABLE threader_projects 
ADD COLUMN IF NOT EXISTS is_collapsed BOOLEAN DEFAULT false;

