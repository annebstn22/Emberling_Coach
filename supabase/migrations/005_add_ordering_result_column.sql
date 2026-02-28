-- Add ordering_result column to threader_projects table
-- This column stores the JSON result from the Threader API ordering process

ALTER TABLE threader_projects 
ADD COLUMN IF NOT EXISTS ordering_result JSONB;

