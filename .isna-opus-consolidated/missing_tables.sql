CREATE TABLE IF NOT EXISTS live_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  joined_at TIMESTAMPTZ, left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(live_session_id, user_id));

CREATE TABLE IF NOT EXISTS live_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, room_name TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'production',
  live_session_id UUID REFERENCES live_sessions(id) ON DELETE SET NULL,
  payload JSONB, processed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS live_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE NOT NULL,
  egress_id TEXT, status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  output_url TEXT, duration_seconds INTEGER,
  tenant_slug TEXT, storage_filepath TEXT, raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS smartboard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL DEFAULT '', source_text TEXT NOT NULL DEFAULT '',
  format JSONB, theme JSONB, global_rules JSONB, layout JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS smartboard_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID REFERENCES smartboard_decks(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  slide_index INTEGER NOT NULL DEFAULT 0, step TEXT,
  title TEXT NOT NULL DEFAULT '', subtitle TEXT,
  core_idea TEXT, pedagogical_goal TEXT, dominant_mode TEXT,
  hero_visual JSONB, development JSONB, illustration JSONB,
  illustration_image_url TEXT, slide_summary TEXT, progressive_build JSONB,
  content JSONB, visual JSONB, graphic JSONB,
  student_action TEXT, teacher_note TEXT, transition TEXT, master_script JSONB,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
