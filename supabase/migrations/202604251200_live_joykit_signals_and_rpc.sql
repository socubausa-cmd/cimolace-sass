-- JoyKit : hôte peut insérer un grant pour un invité ; RPC permission étendue.

-- Hôte de session : INSERT joykit_granted avec user_id = invité bénéficiaire
DROP POLICY IF EXISTS "signals_insert_joykit_granted_host" ON public.live_session_signals;
CREATE POLICY "signals_insert_joykit_granted_host" ON public.live_session_signals
FOR INSERT
WITH CHECK (
  type = 'joykit_granted'
  AND public.internal_live_session_teacher_id(live_session_id::uuid)::text = auth.uid()::text
);

COMMENT ON POLICY "signals_insert_joykit_granted_host" ON public.live_session_signals IS
  'Le formateur enregistre un grant JoyKit pour un participant (user_id = bénéficiaire).';

-- Niveau JoyKit requis pour une action LivePermissions (côté RPC)
CREATE OR REPLACE FUNCTION public._live_joykit_level_allows_action(p_level text, p_action text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(trim(COALESCE(p_level, '')))
    WHEN 'light' THEN p_action = 'canUseJoyKit'
    WHEN 'interactive' THEN p_action IN ('canUseJoyKit', 'canDrawSmartboard', 'canUseSignals')
    WHEN 'control' THEN p_action IN ('canUseJoyKit', 'canDrawSmartboard', 'canUseSignals', 'canControlScenes')
    WHEN 'full' THEN p_action IN (
      'canUseJoyKit', 'canDrawSmartboard', 'canUseSignals', 'canControlScenes', 'canMovePanel'
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.live_guest_permission_active(
  p_live_session_id uuid,
  p_user_id uuid,
  p_action text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND auth.uid() = p_user_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.live_session_signals s
        WHERE s.live_session_id = p_live_session_id
          AND s.user_id = p_user_id
          AND s.type = 'permission_request'
          AND s.resolved = true
          AND COALESCE(s.payload::jsonb->>'status', '') = 'approved'
          AND COALESCE(s.payload::jsonb->>'action', '') = p_action
          AND (
            COALESCE(s.payload::jsonb->>'grant', '') = 'session'
            OR (
              COALESCE(s.payload::jsonb->>'grant', '') = '5min'
              AND (
                (
                  NULLIF(btrim(COALESCE(s.payload::jsonb->>'expiresAt', '')), '') IS NOT NULL
                  AND (s.payload::jsonb->>'expiresAt')::timestamptz > now()
                )
                OR (
                  NULLIF(btrim(COALESCE(s.payload::jsonb->>'expiresAt', '')), '') IS NULL
                  AND NULLIF(btrim(COALESCE(s.payload::jsonb->>'decidedAt', '')), '') IS NOT NULL
                  AND (s.payload::jsonb->>'decidedAt')::timestamptz + interval '5 minutes' > now()
                )
              )
            )
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.live_session_signals s
        WHERE s.live_session_id = p_live_session_id
          AND s.user_id = p_user_id
          AND s.type = 'joykit_granted'
          AND COALESCE(s.payload::jsonb->>'status', '') = 'granted'
          AND public._live_joykit_level_allows_action(
            COALESCE(s.payload::jsonb->>'level', ''),
            p_action
          )
          AND (
            COALESCE(s.payload::jsonb->>'grant', '') = 'session'
            OR (
              COALESCE(s.payload::jsonb->>'grant', '') = '5min'
              AND (
                (
                  NULLIF(btrim(COALESCE(s.payload::jsonb->>'expiresAt', '')), '') IS NOT NULL
                  AND (s.payload::jsonb->>'expiresAt')::timestamptz > now()
                )
                OR (
                  NULLIF(btrim(COALESCE(s.payload::jsonb->>'expiresAt', '')), '') IS NULL
                  AND NULLIF(btrim(COALESCE(s.payload::jsonb->>'decidedAt', '')), '') IS NOT NULL
                  AND (s.payload::jsonb->>'decidedAt')::timestamptz + interval '5 minutes' > now()
                )
              )
            )
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.live_guest_permission_active(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.live_guest_permission_active(uuid, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public._live_joykit_level_allows_action(text, text) FROM PUBLIC;

COMMENT ON FUNCTION public.live_guest_permission_active(uuid, uuid, text) IS
  'permission_request OU joykit_granted actif (non expiré) pour l’action demandée.';
