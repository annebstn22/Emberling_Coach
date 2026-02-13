-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (extends Supabase Auth users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create projects table (Writing Coach projects)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  coach_mode TEXT NOT NULL CHECK (coach_mode IN ('normal', 'baymax', 'edna')),
  current_task_index INTEGER NOT NULL DEFAULT 0,
  skips_used INTEGER NOT NULL DEFAULT 0,
  completed_work TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create tasks table (Tasks within projects)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  focus TEXT NOT NULL,
  duration INTEGER NOT NULL,
  suggested_duration INTEGER NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  user_work TEXT,
  feedback TEXT,
  completed_at TIMESTAMPTZ,
  needs_improvement BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  actionable_points TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create ideation_sessions table (Pre-writing ideation sessions)
CREATE TABLE ideation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  timer INTEGER NOT NULL DEFAULT 0,
  is_timer_running BOOLEAN NOT NULL DEFAULT false,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  uploaded_files JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create ideas table (Ideas within ideation sessions)
CREATE TABLE ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  card_id TEXT NOT NULL,
  card_text TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('active', 'discarded', 'selected')),
  attached_files JSONB DEFAULT '[]'::jsonb,
  wins INTEGER,
  score INTEGER,
  thurstone_score NUMERIC,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create misfit_ideas table (Island of Misfit Ideas)
CREATE TABLE misfit_ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  reason_discarded TEXT NOT NULL,
  original_session_title TEXT,
  attached_files JSONB DEFAULT '[]'::jsonb,
  rediscovered_in TEXT,
  discarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for foreign keys and frequently queried columns
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_ideation_sessions_user_id ON ideation_sessions(user_id);
CREATE INDEX idx_ideation_sessions_created_at ON ideation_sessions(created_at DESC);
CREATE INDEX idx_ideas_session_id ON ideas(session_id);
CREATE INDEX idx_misfit_ideas_user_id ON misfit_ideas(user_id);
CREATE INDEX idx_misfit_ideas_discarded_at ON misfit_ideas(discarded_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ideation_sessions_updated_at
  BEFORE UPDATE ON ideation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE misfit_ideas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks in their own projects"
  ON tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tasks in their own projects"
  ON tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tasks in their own projects"
  ON tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tasks in their own projects"
  ON tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for ideation_sessions
CREATE POLICY "Users can view their own ideation sessions"
  ON ideation_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ideation sessions"
  ON ideation_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ideation sessions"
  ON ideation_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ideation sessions"
  ON ideation_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for ideas
CREATE POLICY "Users can view ideas in their own sessions"
  ON ideas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ideation_sessions
      WHERE ideation_sessions.id = ideas.session_id
      AND ideation_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert ideas in their own sessions"
  ON ideas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ideation_sessions
      WHERE ideation_sessions.id = ideas.session_id
      AND ideation_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update ideas in their own sessions"
  ON ideas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM ideation_sessions
      WHERE ideation_sessions.id = ideas.session_id
      AND ideation_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete ideas in their own sessions"
  ON ideas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM ideation_sessions
      WHERE ideation_sessions.id = ideas.session_id
      AND ideation_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for misfit_ideas
CREATE POLICY "Users can view their own misfit ideas"
  ON misfit_ideas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own misfit ideas"
  ON misfit_ideas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own misfit ideas"
  ON misfit_ideas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own misfit ideas"
  ON misfit_ideas FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

