-- Add Threader tables for semantic ordering tool

-- Create threader_projects table (Threader sessions/projects)
CREATE TABLE threader_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  coach_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create threader_items table (Points/items within a threader project)
CREATE TABLE threader_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES threader_projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  order_index INTEGER,
  original_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for foreign keys and frequently queried columns
CREATE INDEX idx_threader_projects_user_id ON threader_projects(user_id);
CREATE INDEX idx_threader_projects_created_at ON threader_projects(created_at DESC);
CREATE INDEX idx_threader_projects_coach_project_id ON threader_projects(coach_project_id);
CREATE INDEX idx_threader_items_project_id ON threader_items(project_id);
CREATE INDEX idx_threader_items_order_index ON threader_items(project_id, order_index);

-- Create trigger for updated_at on threader_projects
CREATE TRIGGER update_threader_projects_updated_at
  BEFORE UPDATE ON threader_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE threader_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE threader_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for threader_projects
CREATE POLICY "Users can view their own threader projects"
  ON threader_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own threader projects"
  ON threader_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own threader projects"
  ON threader_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own threader projects"
  ON threader_projects FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for threader_items
CREATE POLICY "Users can view items in their own threader projects"
  ON threader_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM threader_projects
      WHERE threader_projects.id = threader_items.project_id
      AND threader_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert items in their own threader projects"
  ON threader_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM threader_projects
      WHERE threader_projects.id = threader_items.project_id
      AND threader_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items in their own threader projects"
  ON threader_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM threader_projects
      WHERE threader_projects.id = threader_items.project_id
      AND threader_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items in their own threader projects"
  ON threader_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM threader_projects
      WHERE threader_projects.id = threader_items.project_id
      AND threader_projects.user_id = auth.uid()
    )
  );

