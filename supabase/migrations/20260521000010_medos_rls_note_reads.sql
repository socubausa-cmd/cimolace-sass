-- MedOS — Politique RLS complète pour med_note_reads
-- Remplace la policy service_role_full_access par des policies
-- patient/praticien granulaires, conformes au cahier des charges médical.

-- Supprimer l'ancienne policy trop permissive
DROP POLICY IF EXISTS "service_role_full_access_note_reads" ON med_note_reads;

-- Praticien / clinic_admin / receptionist : lire les accusés de lecture
-- (pour savoir si un patient a lu la note partagée)
CREATE POLICY "staff_read_note_reads" ON med_note_reads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = med_note_reads.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'practitioner', 'clinic_admin', 'receptionist')
        AND tm.status = 'active'
    )
  );

-- Patient : lire uniquement ses propres accusés de lecture
CREATE POLICY "patient_read_own_note_reads" ON med_note_reads
  FOR SELECT USING (
    patient_user_id = auth.uid()
  );

-- Patient : insérer/mettre à jour son propre accusé de lecture
-- (upsert côté API — seul le patient lui-même peut marquer comme "lu")
CREATE POLICY "patient_upsert_own_note_reads" ON med_note_reads
  FOR INSERT WITH CHECK (
    patient_user_id = auth.uid()
  );

CREATE POLICY "patient_update_own_note_reads" ON med_note_reads
  FOR UPDATE USING (
    patient_user_id = auth.uid()
  ) WITH CHECK (
    patient_user_id = auth.uid()
  );

-- service_role conserve l'accès total pour les workers et jobs internes
CREATE POLICY "service_role_full_access_note_reads" ON med_note_reads
  TO service_role USING (true) WITH CHECK (true);
