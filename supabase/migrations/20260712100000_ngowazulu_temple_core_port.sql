-- NGOWAZULU Temple — PORT V1 → V2 (cimolace). Rend le « Pôle Temple » fonctionnel en base.
-- Adapté du V1 isna_app (202604271300_ngowazulu_temple_core.sql + 202604280900_travel_registrations.sql) :
--   • billing_plans.slug (V1) → billing_plans.key (V2) ;
--   • clause billing_payments retirée (V2 n'a pas user_id/plan_id sur billing_payments) ;
--   • colonne profiles.is_ngowazulu_secretariat_active ajoutée (absente en V2).
-- Mono-tenant assumé (le Temple = pôle du fondateur isna/Prorascience) — comme school_events.

-- 0) Colonne staff temple sur profiles ---------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_ngowazulu_secretariat_active boolean NOT NULL DEFAULT false;

-- Helpers --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_ngowazulu_staff(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id
      AND (
        lower(coalesce(p.role, '')) IN ('owner', 'admin')
        OR coalesce(p.is_ngowazulu_secretariat_active, false) = true
      )
  );
$$;

-- V2 : appartenance = abonnement Ngowazulu actif (billing_plans.key LIKE 'ngowazulu-%').
CREATE OR REPLACE FUNCTION public.is_ngowazulu_member(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  -- billing_subscriptions.plan_id est TEXT en V2 (peut stocker la clé OU l'uuid en texte) →
  -- jointure robuste sur les deux formats.
  SELECT EXISTS (
    SELECT 1
    FROM public.billing_subscriptions bs
    JOIN public.billing_plans bp ON (bs.plan_id = bp.key OR bs.plan_id = bp.id::text)
    WHERE bs.user_id = p_user_id
      AND bs.status IN ('active', 'past_due', 'pending')
      AND lower(coalesce(bp.key, '')) LIKE 'ngowazulu-%'
  );
$$;

-- Cultes ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ngowazulu_cults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  service_day text NOT NULL CHECK (service_day IN ('friday', 'sunday')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  visibility text NOT NULL DEFAULT 'members_only' CHECK (visibility IN ('members_only', 'public')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
  stream_url text,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ngowazulu_cults_starts_at ON public.ngowazulu_cults(starts_at);
CREATE INDEX IF NOT EXISTS idx_ngowazulu_cults_status ON public.ngowazulu_cults(status);

-- Dossiers de cas ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ngowazulu_case_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  case_type text NOT NULL CHECK (case_type IN ('consultation', 'intervention', 'hospital')),
  title text NOT NULL,
  summary text,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'opened' CHECK (status IN ('opened', 'in_treatment', 'stabilized', 'closed')),
  assigned_staff_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ngowazulu_case_files_patient ON public.ngowazulu_case_files(patient_id);
CREATE INDEX IF NOT EXISTS idx_ngowazulu_case_files_type_status ON public.ngowazulu_case_files(case_type, status);

CREATE TABLE IF NOT EXISTS public.ngowazulu_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.ngowazulu_case_files(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('note', 'intervention', 'ritual', 'follow_up')),
  content text NOT NULL,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ngowazulu_case_events_case ON public.ngowazulu_case_events(case_id, created_at DESC);

-- Voyages initiatiques -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ngowazulu_initiatory_travels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'open', 'completed', 'cancelled')),
  seats_total integer,
  seats_taken integer NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'members_only' CHECK (visibility IN ('members_only', 'public')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ngowazulu_travels_starts_at ON public.ngowazulu_initiatory_travels(starts_at);
CREATE INDEX IF NOT EXISTS idx_ngowazulu_travels_status ON public.ngowazulu_initiatory_travels(status);

-- Reglement interieur --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ngowazulu_community_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ngowazulu_rule_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.ngowazulu_community_rules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rule_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ngowazulu_rule_acceptances_user ON public.ngowazulu_rule_acceptances(user_id, accepted_at DESC);

-- Inscriptions voyages -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ngowazulu_travel_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES public.ngowazulu_initiatory_travels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  notes text,
  registered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(travel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ngow_travel_reg_travel ON public.ngowazulu_travel_registrations(travel_id, status);
CREATE INDEX IF NOT EXISTS idx_ngow_travel_reg_user ON public.ngowazulu_travel_registrations(user_id, registered_at DESC);

-- Triggers updated_at --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_ngowazulu_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_ngowazulu_cults_updated ON public.ngowazulu_cults;
CREATE TRIGGER trg_ngowazulu_cults_updated BEFORE UPDATE ON public.ngowazulu_cults
FOR EACH ROW EXECUTE FUNCTION public.set_ngowazulu_updated_at();
DROP TRIGGER IF EXISTS trg_ngowazulu_case_files_updated ON public.ngowazulu_case_files;
CREATE TRIGGER trg_ngowazulu_case_files_updated BEFORE UPDATE ON public.ngowazulu_case_files
FOR EACH ROW EXECUTE FUNCTION public.set_ngowazulu_updated_at();
DROP TRIGGER IF EXISTS trg_ngowazulu_travels_updated ON public.ngowazulu_initiatory_travels;
CREATE TRIGGER trg_ngowazulu_travels_updated BEFORE UPDATE ON public.ngowazulu_initiatory_travels
FOR EACH ROW EXECUTE FUNCTION public.set_ngowazulu_updated_at();
DROP TRIGGER IF EXISTS trg_ngowazulu_rules_updated ON public.ngowazulu_community_rules;
CREATE TRIGGER trg_ngowazulu_rules_updated BEFORE UPDATE ON public.ngowazulu_community_rules
FOR EACH ROW EXECUTE FUNCTION public.set_ngowazulu_updated_at();

CREATE OR REPLACE FUNCTION public.set_ngow_travel_reg_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_ngow_travel_reg_updated ON public.ngowazulu_travel_registrations;
CREATE TRIGGER trg_ngow_travel_reg_updated BEFORE UPDATE ON public.ngowazulu_travel_registrations
FOR EACH ROW EXECUTE FUNCTION public.set_ngow_travel_reg_updated_at();

CREATE OR REPLACE FUNCTION public.ngow_travel_seats_sync()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    UPDATE public.ngowazulu_initiatory_travels SET seats_taken = seats_taken + 1 WHERE id = NEW.travel_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'confirmed' AND NEW.status = 'confirmed' THEN
      UPDATE public.ngowazulu_initiatory_travels SET seats_taken = seats_taken + 1 WHERE id = NEW.travel_id;
    ELSIF OLD.status = 'confirmed' AND NEW.status <> 'confirmed' THEN
      UPDATE public.ngowazulu_initiatory_travels SET seats_taken = GREATEST(seats_taken - 1, 0) WHERE id = NEW.travel_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'confirmed' THEN
    UPDATE public.ngowazulu_initiatory_travels SET seats_taken = GREATEST(seats_taken - 1, 0) WHERE id = OLD.travel_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_ngow_travel_seats ON public.ngowazulu_travel_registrations;
CREATE TRIGGER trg_ngow_travel_seats AFTER INSERT OR UPDATE OR DELETE ON public.ngowazulu_travel_registrations
FOR EACH ROW EXECUTE FUNCTION public.ngow_travel_seats_sync();

-- RLS ------------------------------------------------------------------------
ALTER TABLE public.ngowazulu_cults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngowazulu_case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngowazulu_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngowazulu_initiatory_travels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngowazulu_community_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngowazulu_rule_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngowazulu_travel_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ngowazulu_cults_select ON public.ngowazulu_cults;
CREATE POLICY ngowazulu_cults_select ON public.ngowazulu_cults FOR SELECT USING (
  visibility = 'public' OR public.is_ngowazulu_member(auth.uid()) OR public.is_ngowazulu_staff(auth.uid()));
DROP POLICY IF EXISTS ngowazulu_cults_manage ON public.ngowazulu_cults;
CREATE POLICY ngowazulu_cults_manage ON public.ngowazulu_cults FOR ALL
  USING (public.is_ngowazulu_staff(auth.uid())) WITH CHECK (public.is_ngowazulu_staff(auth.uid()));

DROP POLICY IF EXISTS ngowazulu_cases_select ON public.ngowazulu_case_files;
CREATE POLICY ngowazulu_cases_select ON public.ngowazulu_case_files FOR SELECT USING (
  patient_id = auth.uid() OR assigned_staff_id = auth.uid() OR public.is_ngowazulu_staff(auth.uid()));
DROP POLICY IF EXISTS ngowazulu_cases_insert_staff ON public.ngowazulu_case_files;
CREATE POLICY ngowazulu_cases_insert_staff ON public.ngowazulu_case_files FOR INSERT WITH CHECK (public.is_ngowazulu_staff(auth.uid()));
DROP POLICY IF EXISTS ngowazulu_cases_update_staff ON public.ngowazulu_case_files;
CREATE POLICY ngowazulu_cases_update_staff ON public.ngowazulu_case_files FOR UPDATE USING (public.is_ngowazulu_staff(auth.uid()));

DROP POLICY IF EXISTS ngowazulu_case_events_select ON public.ngowazulu_case_events;
CREATE POLICY ngowazulu_case_events_select ON public.ngowazulu_case_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ngowazulu_case_files cf WHERE cf.id = ngowazulu_case_events.case_id
    AND (cf.patient_id = auth.uid() OR cf.assigned_staff_id = auth.uid() OR public.is_ngowazulu_staff(auth.uid()))));
DROP POLICY IF EXISTS ngowazulu_case_events_insert_staff ON public.ngowazulu_case_events;
CREATE POLICY ngowazulu_case_events_insert_staff ON public.ngowazulu_case_events FOR INSERT WITH CHECK (public.is_ngowazulu_staff(auth.uid()));

DROP POLICY IF EXISTS ngowazulu_travels_select ON public.ngowazulu_initiatory_travels;
CREATE POLICY ngowazulu_travels_select ON public.ngowazulu_initiatory_travels FOR SELECT USING (
  visibility = 'public' OR public.is_ngowazulu_member(auth.uid()) OR public.is_ngowazulu_staff(auth.uid()));
DROP POLICY IF EXISTS ngowazulu_travels_manage ON public.ngowazulu_initiatory_travels;
CREATE POLICY ngowazulu_travels_manage ON public.ngowazulu_initiatory_travels FOR ALL
  USING (public.is_ngowazulu_staff(auth.uid())) WITH CHECK (public.is_ngowazulu_staff(auth.uid()));

DROP POLICY IF EXISTS ngowazulu_rules_select ON public.ngowazulu_community_rules;
CREATE POLICY ngowazulu_rules_select ON public.ngowazulu_community_rules FOR SELECT USING (
  active = true OR public.is_ngowazulu_staff(auth.uid()));
DROP POLICY IF EXISTS ngowazulu_rules_manage ON public.ngowazulu_community_rules;
CREATE POLICY ngowazulu_rules_manage ON public.ngowazulu_community_rules FOR ALL
  USING (public.is_ngowazulu_staff(auth.uid())) WITH CHECK (public.is_ngowazulu_staff(auth.uid()));

DROP POLICY IF EXISTS ngowazulu_rule_acceptances_select ON public.ngowazulu_rule_acceptances;
CREATE POLICY ngowazulu_rule_acceptances_select ON public.ngowazulu_rule_acceptances FOR SELECT USING (
  user_id = auth.uid() OR public.is_ngowazulu_staff(auth.uid()));
DROP POLICY IF EXISTS ngowazulu_rule_acceptances_insert_self ON public.ngowazulu_rule_acceptances;
CREATE POLICY ngowazulu_rule_acceptances_insert_self ON public.ngowazulu_rule_acceptances FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ngow_travel_reg_select_own ON public.ngowazulu_travel_registrations;
CREATE POLICY ngow_travel_reg_select_own ON public.ngowazulu_travel_registrations FOR SELECT USING (
  user_id = auth.uid() OR public.is_ngowazulu_staff(auth.uid()));
DROP POLICY IF EXISTS ngow_travel_reg_insert_self ON public.ngowazulu_travel_registrations;
CREATE POLICY ngow_travel_reg_insert_self ON public.ngowazulu_travel_registrations FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS ngow_travel_reg_cancel_own ON public.ngowazulu_travel_registrations;
CREATE POLICY ngow_travel_reg_cancel_own ON public.ngowazulu_travel_registrations FOR UPDATE
  USING (user_id = auth.uid() AND status = 'pending') WITH CHECK (status = 'cancelled');
DROP POLICY IF EXISTS ngow_travel_reg_staff_all ON public.ngowazulu_travel_registrations;
CREATE POLICY ngow_travel_reg_staff_all ON public.ngowazulu_travel_registrations FOR ALL
  USING (public.is_ngowazulu_staff(auth.uid())) WITH CHECK (public.is_ngowazulu_staff(auth.uid()));

-- Seed règlement intérieur ---------------------------------------------------
INSERT INTO public.ngowazulu_community_rules (code, title, body, required, active, version)
VALUES
  ('respect-sacre', 'Respect du sacré',
   'Chaque membre respecte les espaces, les rites, les guides et la confidentialité des pratiques.', true, true, 1),
  ('non-violence', 'Non-violence et intégrité',
   'Aucune violence verbale, psychologique ou physique n''est tolérée. Le cadre est protégé.', true, true, 1),
  ('entraide', 'Entraide communautaire',
   'La communauté Ngowazulu fonctionne par soutien mutuel, discrétion et responsabilité.', true, true, 1)
ON CONFLICT (code) DO NOTHING;
