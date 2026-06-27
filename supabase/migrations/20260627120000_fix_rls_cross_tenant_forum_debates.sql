-- ════════════════════════════════════════════════════════════════════
-- FIX SÉCURITÉ — fermeture des fuites RLS cross-tenant (forum + débats).
--
-- AVANT : `formation_student_questions.forum_public_read` = USING(is_public=true)
-- sans filtre tenant → un tenant B lisait le forum public d'un tenant A. Idem
-- `debates`/`debate_participants`/`debate_rounds` en USING(true).
-- APRÈS : la lecture est scopée au(x) tenant(s) du lecteur via tenant_memberships.
-- Appliqué en prod le 2026-06-27 (run-sql.js) ; ce fichier = trace versionnée.
-- ════════════════════════════════════════════════════════════════════

-- ─── FORUM : colonne tenant_id + backfill + auto-remplissage + lecture scopée ───
ALTER TABLE formation_student_questions ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE formation_student_questions q
  SET tenant_id = c.tenant_id
  FROM courses c
  WHERE q.formation_id = c.id AND q.tenant_id IS NULL;

UPDATE formation_student_questions q
  SET tenant_id = m.tenant_id
  FROM tenant_memberships m
  WHERE q.tenant_id IS NULL AND m.user_id = q.student_id AND m.status = 'active';

CREATE OR REPLACE FUNCTION fsq_fill_tenant_id() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.formation_id IS NOT NULL THEN
    SELECT c.tenant_id INTO NEW.tenant_id FROM courses c WHERE c.id = NEW.formation_id;
  END IF;
  IF NEW.tenant_id IS NULL THEN
    SELECT m.tenant_id INTO NEW.tenant_id FROM tenant_memberships m
      WHERE m.user_id = NEW.student_id AND m.status = 'active' LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fsq_fill_tenant_id ON formation_student_questions;
CREATE TRIGGER trg_fsq_fill_tenant_id BEFORE INSERT ON formation_student_questions
  FOR EACH ROW EXECUTE FUNCTION fsq_fill_tenant_id();

DROP POLICY IF EXISTS forum_public_read ON formation_student_questions;
CREATE POLICY forum_public_read ON formation_student_questions FOR SELECT
  USING (
    is_public = true
    AND tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND status = 'active')
  );

-- ─── DÉBATS : lecture scopée par tenant (debates a déjà tenant_id) ───
DROP POLICY IF EXISTS debates_select_auth ON debates;
CREATE POLICY debates_select_auth ON debates FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

DROP POLICY IF EXISTS debate_participants_select_auth ON debate_participants;
CREATE POLICY debate_participants_select_auth ON debate_participants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM debates d WHERE d.id = debate_participants.debate_id
      AND d.tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND status = 'active')
  ));

DROP POLICY IF EXISTS debate_rounds_select_auth ON debate_rounds;
CREATE POLICY debate_rounds_select_auth ON debate_rounds FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM debates d WHERE d.id = debate_rounds.debate_id
      AND d.tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND status = 'active')
  ));
