-- MasterScript Agent : enrichir live_script_sections (titre + payload JSON structuré)

ALTER TABLE public.live_script_sections
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS master_agent JSONB;

COMMENT ON COLUMN public.live_script_sections.title IS 'Titre affiché (ex. titre slide)';
COMMENT ON COLUMN public.live_script_sections.master_agent IS 'MasterScript Agent : intention, teacher_script, key_points, transition, etc.';
