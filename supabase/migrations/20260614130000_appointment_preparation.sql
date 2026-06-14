-- Préparation d'entretien par le secrétariat (porté d'ISNA v1 booking-set-preparation).
-- Accès via l'API NestJS (service role) — RLS activée sans policy publique.
CREATE TABLE IF NOT EXISTS public.appointment_preparation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  appointment_id UUID NOT NULL UNIQUE,
  plan_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  room_type TEXT NOT NULL DEFAULT 'chat',
  notes_secretary TEXT,
  documents_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_preparation_appt
  ON public.appointment_preparation(appointment_id);

ALTER TABLE public.appointment_preparation ENABLE ROW LEVEL SECURITY;
