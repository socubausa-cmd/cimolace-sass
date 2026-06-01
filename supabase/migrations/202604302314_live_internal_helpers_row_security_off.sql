-- Cas Supabase / Postgres : SECURITY DEFINER n’empêche pas toujours l’application des politiques RLS
-- sur les lectures internes si le propriétaire de la fonction n’est pas propriétaire de la table.
-- Symptôme client : 42P17 « infinite recursion detected in policy for relation live_sessions »
-- sur live_invitations, live_visibility_rules, live_waiting_room_entries (embeds / filtres live_sessions).
--
-- Désactive RLS pour le corps de ces helpers uniquement (équivalent « lecture système » contrôlée).

CREATE OR REPLACE FUNCTION public.internal_live_session_teacher_id(p_session_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT teacher_id FROM public.live_sessions WHERE id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.internal_is_live_session_participant(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_session_participants
    WHERE live_session_id = p_session_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.internal_live_session_status(p_session_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT status FROM public.live_sessions WHERE id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.internal_user_has_live_invitation(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_invitations
    WHERE live_session_id = p_session_id
      AND user_id = p_user_id
      AND status IN ('pending', 'sent', 'seen', 'accepted')
  );
$$;

-- Débat : même principe si les politiques se croisent avec live_sessions.
CREATE OR REPLACE FUNCTION public.internal_debate_moderator_id(p_debate_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT moderator_id FROM public.debates WHERE id = p_debate_id;
$$;

CREATE OR REPLACE FUNCTION public.internal_user_is_debate_participant(p_debate_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.debate_participants
    WHERE debate_id = p_debate_id AND user_id = p_user_id
  );
$$;
