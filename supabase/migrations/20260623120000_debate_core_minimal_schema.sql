-- ════════════════════════════════════════════════════════════════════════════
-- DebateCore — schéma minimal fonctionnel (jamais déployé en prod).
-- Le code (StudioDebateBuilderPage + runtime live) utilise debate_rounds /
-- debate_participants + ~12 colonnes de `debates` qui n'existaient pas en prod ;
-- et debates/debate_votes avaient RLS ON sans AUCUNE policy (= deny-all).
-- Migration ADDITIVE + idempotente. Aligne le schéma sur le code.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) Colonnes manquantes sur debates ──────────────────────────────────────
ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS title            text,
  ADD COLUMN IF NOT EXISTS description      text,
  ADD COLUMN IF NOT EXISTS round_count      integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS seconds_per_turn integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS access_mode      text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS access_password  text,
  ADD COLUMN IF NOT EXISTS vote_type        text NOT NULL DEFAULT 'per_round_ab',
  ADD COLUMN IF NOT EXISTS neuronq_enabled  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_judge_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_weight        numeric NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS moderator_id     uuid,
  ADD COLUMN IF NOT EXISTS live_session_id  uuid,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

-- `topic` était NOT NULL mais le code peut l'envoyer null → relâcher.
ALTER TABLE public.debates ALTER COLUMN topic DROP NOT NULL;

-- ── 2) debate_rounds ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.debate_rounds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id    uuid NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  status       text NOT NULL DEFAULT 'pending',
  score_a      integer NOT NULL DEFAULT 0,
  score_b      integer NOT NULL DEFAULT 0,
  ai_score_a   numeric,
  ai_score_b   numeric,
  active_side  text,
  round_label  text,
  brief_public text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (debate_id, round_number)
);
CREATE INDEX IF NOT EXISTS idx_debate_rounds_debate ON public.debate_rounds(debate_id);

-- ── 3) debate_participants ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.debate_participants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id    uuid NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  role         text NOT NULL DEFAULT 'debater',
  side         text,
  ready_status text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (debate_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_debate_participants_debate ON public.debate_participants(debate_id);

-- ── 4) RLS (pragmatique pour un débat minimal : lecture large nécessaire pour
--        que le bandeau/scores s'affichent à tous les participants du live ;
--        écriture du barème/manches réservée au modérateur du débat) ─────────
ALTER TABLE public.debate_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_participants ENABLE ROW LEVEL SECURITY;

-- debates : lecture + création authentifiée ; modif/suppr par le modérateur.
DROP POLICY IF EXISTS debates_select_auth ON public.debates;
CREATE POLICY debates_select_auth ON public.debates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS debates_insert_auth ON public.debates;
CREATE POLICY debates_insert_auth ON public.debates FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS debates_update_mod ON public.debates;
CREATE POLICY debates_update_mod ON public.debates FOR UPDATE TO authenticated
  USING (moderator_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (moderator_id = auth.uid() OR created_by = auth.uid());
DROP POLICY IF EXISTS debates_delete_mod ON public.debates;
CREATE POLICY debates_delete_mod ON public.debates FOR DELETE TO authenticated
  USING (moderator_id = auth.uid() OR created_by = auth.uid());

-- debate_rounds : lecture authentifiée ; écriture par le modérateur du débat.
DROP POLICY IF EXISTS debate_rounds_select_auth ON public.debate_rounds;
CREATE POLICY debate_rounds_select_auth ON public.debate_rounds FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS debate_rounds_insert_auth ON public.debate_rounds;
CREATE POLICY debate_rounds_insert_auth ON public.debate_rounds FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS debate_rounds_update_mod ON public.debate_rounds;
CREATE POLICY debate_rounds_update_mod ON public.debate_rounds FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.debates d WHERE d.id = debate_id AND (d.moderator_id = auth.uid() OR d.created_by = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.debates d WHERE d.id = debate_id AND (d.moderator_id = auth.uid() OR d.created_by = auth.uid())));

-- debate_participants : lecture authentifiée ; écriture self ou modérateur.
DROP POLICY IF EXISTS debate_participants_select_auth ON public.debate_participants;
CREATE POLICY debate_participants_select_auth ON public.debate_participants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS debate_participants_write ON public.debate_participants;
CREATE POLICY debate_participants_write ON public.debate_participants FOR ALL TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.debates d WHERE d.id = debate_id AND (d.moderator_id = auth.uid() OR d.created_by = auth.uid())))
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.debates d WHERE d.id = debate_id AND (d.moderator_id = auth.uid() OR d.created_by = auth.uid())));

-- ── 5) Étendre le CHECK session_type pour autoriser 'conference' ─────────────
-- Le code (wizard live, type Conférence) pose session_type='conference', or le CHECK
-- prod ne l'autorisait pas → la création d'un live Conférence échouait. 'debate' est
-- déjà autorisé ; 'classe' reste mappé → 'class' côté createLiveSession.
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_session_type_check;
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_session_type_check
  CHECK (session_type = ANY (ARRAY['class','workshop','webinar','consultation','debate','commercial','masterclass','conference']));
