-- Phase 5 : l’invité ne peut pas s’auto-accorder une permission — vérifie les signaux
-- `permission_request` résolus, approuvés, non expirés (5 min ou session).

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
    AND EXISTS (
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
    );
$$;

REVOKE ALL ON FUNCTION public.live_guest_permission_active(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.live_guest_permission_active(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.live_guest_permission_active(uuid, uuid, text) IS
  'True si l’utilisateur courant (invité) a un grant actif pour p_action sur la session (signaux permission_request).';
