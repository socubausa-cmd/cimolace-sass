-- ============================================================================
-- Live Guest Permissions + Guest Notes
-- ----------------------------------------------------------------------------
-- Contexte : salle de classe virtuelle LIRI. Cette migration :
--   1) Ajoute des flags dans live_sessions.config.guest_permissions pour que
--      le professeur contrôle, par session, ce que les élèves peuvent faire.
--      (Valeurs par défaut rétro-compatibles — les sessions existantes
--      continuent de fonctionner sans retouche.)
--   2) Crée la table live_session_guest_notes pour persister le cahier de
--      notes personnel d'un élève par session. Notes en markdown léger,
--      avec références de scène Smartboard et pièces jointes (captures).
--   3) RLS : l'élève lit/écrit UNIQUEMENT ses propres notes ; le professeur
--      lit les notes explicitement partagées avec lui (shared_with_teacher).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Permissions élèves : valeurs par défaut dans live_sessions.config
-- ---------------------------------------------------------------------------
-- On n'altère pas la structure (config est déjà JSONB). On documente le shape
-- attendu et on backfill les sessions existantes pour garantir la présence
-- des clés avec des valeurs raisonnables pour une classe.

DO $$
BEGIN
  -- Backfill : toute session sans guest_permissions reçoit le preset "classe"
  UPDATE public.live_sessions
     SET config = COALESCE(config, '{}'::jsonb)
                  || jsonb_build_object(
                       'guest_permissions',
                       jsonb_build_object(
                         'can_raise_hand', true,
                         'can_react_emoji', true,
                         'can_chat_public', true,
                         'can_whisper_teacher', true,
                         'can_chat_peer', false,
                         'can_request_speak', true,
                         'can_request_screenshare', false,
                         'can_annotate_whiteboard', false,
                         'can_use_video_blur', true,
                         'can_use_ai_coach', true,
                         'can_use_neuronq', true,
                         'show_members_grid', true,
                         'can_export_notes', true,
                         'can_send_notes_to_teacher', true,
                         'require_proctor_consent', false
                       )
                     )
   WHERE config IS NULL
      OR NOT (config ? 'guest_permissions');
END $$;

COMMENT ON COLUMN public.live_sessions.config IS
  'Configuration JSONB. Clé guest_permissions : matrice de capacités invité (élève) contrôlée par l''hôte (professeur). Voir migration 202604221400.';

-- ---------------------------------------------------------------------------
-- 2. Table live_session_guest_notes — cahier de notes personnel élève
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_session_guest_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  content_md      TEXT NOT NULL DEFAULT '',
  -- Entrées structurées du cahier : array d'objets
  --   { id, text_md, created_at, scene_ref?: {scene_id, scene_label, page?},
  --     attachments?: [{kind:'smartboard_capture', url, thumb_url}] }
  entries         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Dernière scène Smartboard active (snapshot pour lien "revenir à la scène")
  last_scene_ref  JSONB,
  -- Flag envoi au prof : 'never' | 'once' | 'live' (si l'élève envoie ses notes
  -- en fin de cours, on passe à 'once' + shared_at)
  shared_with_teacher TEXT NOT NULL DEFAULT 'never'
    CHECK (shared_with_teacher IN ('never', 'once', 'live')),
  shared_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Une seule ligne par (session, élève)
  CONSTRAINT live_session_guest_notes_uniq UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lsgn_session_user
  ON public.live_session_guest_notes (session_id, user_id);

CREATE INDEX IF NOT EXISTS idx_lsgn_shared
  ON public.live_session_guest_notes (session_id)
  WHERE shared_with_teacher <> 'never';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_lsgn_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lsgn_touch ON public.live_session_guest_notes;
CREATE TRIGGER trg_lsgn_touch
  BEFORE UPDATE ON public.live_session_guest_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_lsgn_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS — l'élève lit/écrit UNIQUEMENT ses notes ; le prof lit les partagées
-- ---------------------------------------------------------------------------
ALTER TABLE public.live_session_guest_notes ENABLE ROW LEVEL SECURITY;

-- Lecture : propriétaire (user_id = auth.uid()) OU teacher de la session SI partagé
DROP POLICY IF EXISTS "lsgn_select" ON public.live_session_guest_notes;
CREATE POLICY "lsgn_select" ON public.live_session_guest_notes
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      shared_with_teacher <> 'never'
      AND EXISTS (
        SELECT 1 FROM public.live_sessions ls
         WHERE ls.id = live_session_guest_notes.session_id
           AND ls.teacher_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
    )
  );

-- Insert : uniquement soi-même ET inscrit comme participant de la session
DROP POLICY IF EXISTS "lsgn_insert" ON public.live_session_guest_notes;
CREATE POLICY "lsgn_insert" ON public.live_session_guest_notes
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.live_session_participants lp
         WHERE lp.live_session_id = live_session_guest_notes.session_id
           AND lp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.live_sessions ls
         WHERE ls.id = live_session_guest_notes.session_id
           AND ls.teacher_id = auth.uid()
      )
    )
  );

-- Update : uniquement soi-même
DROP POLICY IF EXISTS "lsgn_update" ON public.live_session_guest_notes;
CREATE POLICY "lsgn_update" ON public.live_session_guest_notes
  FOR UPDATE USING (user_id = auth.uid())
              WITH CHECK (user_id = auth.uid());

-- Delete : uniquement soi-même (l'élève peut purger ses notes)
DROP POLICY IF EXISTS "lsgn_delete" ON public.live_session_guest_notes;
CREATE POLICY "lsgn_delete" ON public.live_session_guest_notes
  FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE public.live_session_guest_notes IS
  'Cahier de notes personnel d''un élève dans une session live LIRI. Markdown léger + entrées timestampées + références scène Smartboard. RLS : l''élève est seul auteur, le prof ne voit que les notes partagées explicitement.';

COMMIT;
