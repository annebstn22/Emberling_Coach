-- Add coach_project_id to ideation_sessions to link ideation sessions to Writing Coach projects
ALTER TABLE ideation_sessions 
ADD COLUMN IF NOT EXISTS coach_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ideation_sessions_coach_project_id ON ideation_sessions(coach_project_id);

