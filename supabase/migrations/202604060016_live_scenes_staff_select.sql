-- Align live_scenes read with live_sessions: staff (owner/admin/secretariat) can
-- SELECT scenes for any session (e.g. import SmartBoard into a new draft for a teacher).

DROP POLICY IF EXISTS "live_scenes_staff_read" ON public.live_scenes;
CREATE POLICY "live_scenes_staff_read"
  ON public.live_scenes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
    )
  );
