-- Player de cours — questions élève (bouton « J'ai une question ») :
-- colonnes de contexte manquantes + tables mentions/notifications absentes.
--
-- Fichier : apps/app/src/components/school/formations/CoursePlayerInterface.jsx
--
-- Symptômes vérifiés en prod (DATABASE_URL .env.production) :
--   • submitQuestion() (~ligne 519) insère basePayload avec
--     module_id / week_id / day_id / video_id, MAIS ces 4 colonnes
--     N'EXISTENT PAS sur public.formation_student_questions → l'insert via
--     PostgREST échoue (42703 → PGRST204 « Could not find the 'module_id'
--     column ») → questionStatus='error', la question n'est jamais enregistrée.
--   • loadMyQuestions() (~ligne 325) fait SELECT ...,video_id,day_id puis
--     .eq('day_id',…).eq('video_id',…) → même erreur de colonne → la liste
--     « Mes questions » reste toujours vide.
--   • Les @-mentions écrivent dans formation_question_mentions et
--     formation_question_notifications (~lignes 556-573), DEUX TABLES
--     TOTALEMENT ABSENTES en prod → insert silencieusement perdu
--     (fire-and-forget, aucune gestion d'erreur côté front).
--
-- Même classe de bug que formation_student_notes (table absente, corrigée le
-- 2026-06-20). On reste cohérent avec la table sœur : les identifiants de
-- structure (module/week/day/video) restent en `text` opaque — pas de FK
-- fragile vers la hiérarchie modules→weeks→days chargée dans le player.

-- 1) Colonnes de contexte manquantes.
--    Ajout NULLABLE : la table contient déjà des lignes (6 en prod) qui
--    n'ont pas ce contexte ; un NOT NULL casserait l'ALTER. Le front fournit
--    toujours day_id (submitQuestion sort tôt si !dayId) et video_id ('' au
--    pire), donc les nouvelles lignes seront renseignées.
ALTER TABLE public.formation_student_questions
  ADD COLUMN IF NOT EXISTS module_id text,
  ADD COLUMN IF NOT EXISTS week_id   text,
  ADD COLUMN IF NOT EXISTS day_id    text,
  ADD COLUMN IF NOT EXISTS video_id  text;

-- 2) « Mes questions » doit relire les questions de l'élève, Y COMPRIS privées
--    (is_public=false). La policy existante forum_public_read ne couvre que
--    is_public=true : une question privée fraîchement postée n'apparaîtrait
--    jamais dans loadMyQuestions(). On AJOUTE une policy SELECT permissive
--    « own » (OR avec forum_public_read, sans toucher l'existant).
DROP POLICY IF EXISTS forum_student_select_own ON public.formation_student_questions;
CREATE POLICY forum_student_select_own ON public.formation_student_questions
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Index pour le filtre loadMyQuestions (student_id, formation_id, day_id, video_id).
CREATE INDEX IF NOT EXISTS fsq_student_formation_day_video_idx
  ON public.formation_student_questions (student_id, formation_id, day_id, video_id);

-- 3) Mentions @membre dans une question (table absente).
CREATE TABLE IF NOT EXISTS public.formation_question_mentions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id      uuid,
  question_id       uuid NOT NULL REFERENCES public.formation_student_questions(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL,
  created_by        uuid NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.formation_question_mentions ENABLE ROW LEVEL SECURITY;

-- L'auteur de la question crée la mention ; l'auteur et le mentionné peuvent la relire.
DROP POLICY IF EXISTS fqm_insert_own ON public.formation_question_mentions;
CREATE POLICY fqm_insert_own ON public.formation_question_mentions
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS fqm_select_involved ON public.formation_question_mentions;
CREATE POLICY fqm_select_involved ON public.formation_question_mentions
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR mentioned_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS fqm_question_idx   ON public.formation_question_mentions (question_id);
CREATE INDEX IF NOT EXISTS fqm_mentioned_idx  ON public.formation_question_mentions (mentioned_user_id);

-- 4) Notifications de mention (table absente). is_read + policy UPDATE prévus
--    pour un futur centre de notifications (le front n'écrit pour l'instant que
--    recipient_id/sender_id/title/message — les autres colonnes ont un défaut).
CREATE TABLE IF NOT EXISTS public.formation_question_notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id uuid,
  question_id  uuid REFERENCES public.formation_student_questions(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  sender_id    uuid NOT NULL,
  title        text,
  message      text,
  is_read      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.formation_question_notifications ENABLE ROW LEVEL SECURITY;

-- L'émetteur crée la notif ; le destinataire la lit et la marque lue.
DROP POLICY IF EXISTS fqn_insert_sender ON public.formation_question_notifications;
CREATE POLICY fqn_insert_sender ON public.formation_question_notifications
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS fqn_select_recipient ON public.formation_question_notifications;
CREATE POLICY fqn_select_recipient ON public.formation_question_notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS fqn_update_recipient ON public.formation_question_notifications;
CREATE POLICY fqn_update_recipient ON public.formation_question_notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

CREATE INDEX IF NOT EXISTS fqn_recipient_idx
  ON public.formation_question_notifications (recipient_id, is_read, created_at DESC);

-- 5) Grants PostgREST (rôle authenticated).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_question_mentions       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_question_notifications  TO authenticated;
