-- Smart booking engine core schema (phase prompt v2)

CREATE TABLE IF NOT EXISTS public.secretary_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('AF_EU', 'US')),
  timezone_group TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.secretaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.secretary_teams(id) ON DELETE SET NULL,
  display_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'Africa/Libreville',
  status TEXT NOT NULL DEFAULT 'online',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE IF EXISTS public.availability_slots
  ADD COLUMN IF NOT EXISTS secretary_id UUID REFERENCES public.secretaries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS local_date DATE,
  ADD COLUMN IF NOT EXISTS local_time_label TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_prime_hour BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS booked_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.appointment_requests
  ADD COLUMN IF NOT EXISTS visitor_name TEXT,
  ADD COLUMN IF NOT EXISTS visitor_email TEXT,
  ADD COLUMN IF NOT EXISTS visitor_country TEXT,
  ADD COLUMN IF NOT EXISTS visitor_timezone TEXT,
  ADD COLUMN IF NOT EXISTS visitor_region TEXT CHECK (visitor_region IN ('AF_EU', 'US')),
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS preferred_date DATE,
  ADD COLUMN IF NOT EXISTS preferred_time TEXT,
  ADD COLUMN IF NOT EXISTS booking_reference TEXT;

ALTER TABLE IF EXISTS public.appointments
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.appointment_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_reference TEXT,
  ADD COLUMN IF NOT EXISTS secretary_id UUID REFERENCES public.secretaries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS secretary_team_id UUID REFERENCES public.secretary_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_at_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visitor_local_datetime TEXT,
  ADD COLUMN IF NOT EXISTS secretary_local_datetime TEXT,
  ADD COLUMN IF NOT EXISTS visitor_timezone TEXT,
  ADD COLUMN IF NOT EXISTS secretary_timezone TEXT,
  ADD COLUMN IF NOT EXISTS is_prime_hour BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS immersive_chat_id UUID,
  ADD COLUMN IF NOT EXISTS immersive_live_id UUID;

CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.appointment_requests(id) ON DELETE CASCADE,
  secretary_team_id UUID REFERENCES public.secretary_teams(id) ON DELETE SET NULL,
  desired_slot_utc TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json JSONB,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointment_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  summary_text TEXT,
  next_step TEXT,
  report_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.live_chat_invites
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointment_requests_booking_reference
  ON public.appointment_requests(booking_reference);
CREATE INDEX IF NOT EXISTS idx_appointments_booking_reference
  ON public.appointments(booking_reference);
CREATE INDEX IF NOT EXISTS idx_secretaries_team
  ON public.secretaries(team_id, is_active);
