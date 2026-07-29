-- Aligne le pipeline LIVE réel avec l'adaptateur Master Factory.
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS transcript text;

ALTER TABLE public.live_neuro_recall_state
  DROP CONSTRAINT IF EXISTS live_neuro_recall_state_workflow_status_check;

ALTER TABLE public.live_neuro_recall_state
  ADD CONSTRAINT live_neuro_recall_state_workflow_status_check
  CHECK (workflow_status IN (
    'idle', 'processing', 'draft_generated', 'needs_review', 'pending_review',
    'approved', 'published', 'rejected', 'error'
  ));
