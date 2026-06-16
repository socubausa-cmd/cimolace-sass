-- ════════════════════════════════════════════════════════════════════════════
-- Fix RLS salle d'attente LIRI (public.live_waiting_room_entries)
-- ════════════════════════════════════════════════════════════════════════════
-- Contexte : la migration full_schema (20260528150001) n'a posé qu'UNE policy
-- (waiting_room_select USING user_id = auth.uid()) et a OUBLIÉ INSERT + UPDATE.
-- En prod (fwfupxvmwtxbtbjdeqvu) cela donne :
--   • INSERT → deny-all  : l'invité ne peut pas « Demander l'accès ».
--   • UPDATE → deny-all  : l'hôte ne peut pas accepter / refuser.
--   • SELECT restreint    : l'hôte ne voit même pas les demandes des invités.
-- => la salle d'attente n'a jamais pu fonctionner.
--
-- Ce fix restaure les 3 policies (vocabulaire des migrations officielles
-- smart_entry / recursion_hotfix) en s'appuyant sur la fonction SECURITY DEFINER
-- public.internal_live_session_teacher_id() déjà présente en prod
-- → aucune récursion RLS (pas d'EXISTS direct sur live_sessions).
-- Le CHECK status reste inchangé : waiting / admitted / rejected / left.
-- ════════════════════════════════════════════════════════════════════════════

-- INSERT : un membre connecté crée uniquement SA propre entrée.
DROP POLICY IF EXISTS waiting_room_insert ON public.live_waiting_room_entries;
CREATE POLICY waiting_room_insert ON public.live_waiting_room_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE : l'invité annule la sienne ; le formateur (hôte) accepte / refuse.
DROP POLICY IF EXISTS waiting_room_update ON public.live_waiting_room_entries;
CREATE POLICY waiting_room_update ON public.live_waiting_room_entries
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  );

-- SELECT : l'invité voit la sienne ; le formateur voit toutes les demandes de sa session.
DROP POLICY IF EXISTS waiting_room_select ON public.live_waiting_room_entries;
CREATE POLICY waiting_room_select ON public.live_waiting_room_entries
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  );
