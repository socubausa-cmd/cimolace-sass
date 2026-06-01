-- LIRI — Persistance des captions live traduits (chunks finals uniquement).
-- Permet de rejouer le transcript multilingue après la séance.

CREATE TABLE IF NOT EXISTS public.liri_multilang_live_captions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id text      NOT NULL,
  inserted_by   uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source_lang   text        NOT NULL,
  target_lang   text        NOT NULL,
  source_text   text        NOT NULL,
  translated_text text      NOT NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liri_ml_caps_session
  ON public.liri_multilang_live_captions (live_session_id, occurred_at ASC);

CREATE INDEX IF NOT EXISTS idx_liri_ml_caps_inserted_by
  ON public.liri_multilang_live_captions (inserted_by, live_session_id);

COMMENT ON TABLE public.liri_multilang_live_captions
  IS 'LIRI — chunks finals traduits pendant une séance live (source + cible).';

ALTER TABLE public.liri_multilang_live_captions ENABLE ROW LEVEL SECURITY;

-- L'hôte (inserted_by) peut lire ses propres captions.
DROP POLICY IF EXISTS "liri_ml_caps_select_own" ON public.liri_multilang_live_captions;
CREATE POLICY "liri_ml_caps_select_own"
  ON public.liri_multilang_live_captions FOR SELECT TO authenticated
  USING (inserted_by = auth.uid());

-- Tout utilisateur authentifié peut insérer (l'hôte insère côté client).
DROP POLICY IF EXISTS "liri_ml_caps_insert_auth" ON public.liri_multilang_live_captions;
CREATE POLICY "liri_ml_caps_insert_auth"
  ON public.liri_multilang_live_captions FOR INSERT TO authenticated
  WITH CHECK (inserted_by = auth.uid());

GRANT SELECT, INSERT ON public.liri_multilang_live_captions TO authenticated;
