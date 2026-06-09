-- Lien session live → deck smartboard généré (Architect / Masterclass).
--
-- Permet à la régie hôte ET à la salle élève de charger automatiquement le bon
-- deck (sans paramètre d'URL) : le client lit `live_sessions.smartboard_deck_id`
-- via fetchSessionDeckId(), puis fetchLiveDeck() pour les slides.
--
-- Additif et idempotent : aucune donnée existante impactée. Tant que la colonne
-- est NULL, le client retombe sur le deck d'exemple (LIVE_DECK).

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS smartboard_deck_id UUID
  REFERENCES public.smartboard_decks(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.live_sessions.smartboard_deck_id IS
  'Deck smartboard (smartboard_decks.id) diffusé pendant ce live. NULL → aucun deck lié (le client affiche le deck d''exemple).';

CREATE INDEX IF NOT EXISTS idx_live_sessions_smartboard_deck
  ON public.live_sessions(smartboard_deck_id);
