-- DebateCore — pilotage live dans l’Arena (round, parole, chrono)
-- Activer aussi Realtime sur public.debates (Dashboard → Database → Replication) pour la synchro temps réel.

ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS arena_current_round INT NOT NULL DEFAULT 1
    CHECK (arena_current_round >= 1 AND arena_current_round <= 50);

ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS arena_active_side TEXT
    CHECK (arena_active_side IS NULL OR arena_active_side IN ('A', 'B'));

ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS arena_turn_deadline TIMESTAMPTZ;

COMMENT ON COLUMN public.debates.arena_current_round IS 'DebateCore Arena : index du round affiché (1..N).';
COMMENT ON COLUMN public.debates.arena_active_side IS 'DebateCore Arena : camp ayant la parole (A ou B).';
COMMENT ON COLUMN public.debates.arena_turn_deadline IS 'DebateCore Arena : fin du tour de parole (horodatage).';
