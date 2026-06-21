-- supabase/migrations/20260620170000_forum_connecte_sujets.sql
-- ============================================================================
-- Migration ADDITIVE : "Sujets" (topics) — socle "forum connecté" greffé sur la
-- messagerie EXISTANTE (Phase A). Introduit le type de conversation kind='topic'
-- sur les tables prod conversations / conversation_participants / messages.
--
-- Cible le SCHÉMA PROD RÉEL (vérifié), PAS la migration périmée
-- 20260521000033_chat_messaging.sql (qui déclare à tort conv_type/title/read_by).
-- Le schéma réel est prouvé par :
--   - l'en-tête de 20260614140000_find_or_create_conversation_rpc.sql
--     (« SCHÉMA RÉEL vérifié prod »),
--   - apps/api/src/messaging/messaging.service.ts (name/description/type/created_by,
--     recipient_id/subject/is_read/read_at),
--   - apps/app/src/hooks/useRealtimeMessaging.js (mapping recipient_id).
--
-- Schéma prod réel :
--   conversations(id, tenant_id, name, description,
--                 type CHECK('direct','group') default 'direct',
--                 created_by, created_at, updated_at)
--   conversation_participants(id, tenant_id, conversation_id, user_id, joined_at)
--                 UNIQUE(conversation_id, user_id)
--   messages(id, tenant_id, conversation_id, sender_id, recipient_id, subject,
--            content, is_read, read_at, created_at)
--
-- 100% ADDITIF & IDEMPOTENT : aucun DROP de table/colonne, aucune perte de donnée.
-- Ne touche PAS formation_student_questions (le forum live garde son propre
-- realtime Supabase + sa policy forum_public_read ; convergence notée Phase A.2).
-- NB : le trigger conversations_updated_at (set_updated_at) existe déjà
-- (20260521000033) — rien à recréer ici.
-- ============================================================================

BEGIN;

-- ── 1) Colonnes additives sur conversations ────────────────────────────────
-- On NE touche PAS à la colonne `type` existante ('direct'/'group') pour éviter
-- tout conflit de CHECK en prod. On ajoute une dimension ORTHOGONALE `kind`
-- ('direct'|'group'|'topic') qui porte la sémantique Sujet. Les lignes existantes
-- prennent le défaut 'direct' (inoffensif : le code DM ignore `kind`).
--
--   kind         : direct|group|topic ('topic' = Sujet de forum connecté)
--   subject      : titre/intitulé du Sujet (NULL pour les DM)
--   status       : open|closed (Sujet ouvert ou clos)
--   visibility   : public|private|context
--                    public  = visible par tout membre actif du tenant
--                    private = visible par les seuls participants
--                    context = visible via le contexte rattaché (participants)
--   context_type : video|live|class quand le Sujet est ancré à une ressource
--   context_id   : id de la ressource de contexte (vidéo/live/classe)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS kind         text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS subject      text,
  ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS visibility   text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS context_type text,
  ADD COLUMN IF NOT EXISTS context_id   uuid;

-- ── 2) Contraintes CHECK (bornage des valeurs) ─────────────────────────────
-- Ajoutées en NOT VALID puis VALIDATE : ne scanne/bloque pas les lignes
-- existantes au moment de l'ALTER, et le garde pg_constraint rend l'opération
-- idempotente (ne ré-échoue pas si la contrainte existe déjà).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_kind_chk') THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_kind_chk
      CHECK (kind IN ('direct','group','topic')) NOT VALID;
    ALTER TABLE public.conversations VALIDATE CONSTRAINT conversations_kind_chk;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_status_chk') THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_status_chk
      CHECK (status IN ('open','closed')) NOT VALID;
    ALTER TABLE public.conversations VALIDATE CONSTRAINT conversations_status_chk;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_visibility_chk') THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_visibility_chk
      CHECK (visibility IN ('public','private','context')) NOT VALID;
    ALTER TABLE public.conversations VALIDATE CONSTRAINT conversations_visibility_chk;
  END IF;

  -- context_type libre mais borné quand renseigné (NULL autorisé).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_context_type_chk') THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_context_type_chk
      CHECK (context_type IS NULL OR context_type IN ('video','live','class')) NOT VALID;
    ALTER TABLE public.conversations VALIDATE CONSTRAINT conversations_context_type_chk;
  END IF;
END$$;

COMMENT ON COLUMN public.conversations.kind IS
  'direct|group|topic. ''topic'' = Sujet de forum connecté (socle additif Phase A). Dimension orthogonale à la colonne `type` historique (''direct''/''group'') qui reste intacte pour les DM/groupes.';
COMMENT ON COLUMN public.conversations.subject IS
  'Intitulé du Sujet (kind=''topic''). NULL pour les DM/groupes classiques.';
COMMENT ON COLUMN public.conversations.status IS
  'open|closed — état d''un Sujet (kind=''topic'').';
COMMENT ON COLUMN public.conversations.visibility IS
  'public|private|context — portée de lecture d''un Sujet : public=membre actif du tenant, private=participant, context=via la ressource rattachée (participant).';
COMMENT ON COLUMN public.conversations.context_type IS
  'video|live|class — type de ressource à laquelle un Sujet contextuel est ancré (NULL si aucun).';
COMMENT ON COLUMN public.conversations.context_id IS
  'Id de la ressource de contexte (vidéo/live/classe) pour un Sujet ancré.';

-- ── 3) Index pour les requêtes "Sujets" ────────────────────────────────────
-- Liste des Sujets d'un tenant, triés par activité (updated_at desc).
CREATE INDEX IF NOT EXISTS idx_conversations_topics
  ON public.conversations (tenant_id, updated_at DESC)
  WHERE kind = 'topic';

-- Résolution d'un Sujet par sa ressource de contexte (onglet « Sujets » d'une
-- vidéo/live/classe).
CREATE INDEX IF NOT EXISTS idx_conversations_topic_context
  ON public.conversations (tenant_id, context_type, context_id)
  WHERE kind = 'topic' AND context_id IS NOT NULL;

-- ── 4) RLS — LECTURE des Sujets (kind='topic') ─────────────────────────────
-- RLS de `messages` en prod = service_role pur : la LECTURE des Sujets passe par
-- l'API NestJS (sous-module messaging/topics, service_role) comme la messagerie
-- actuelle. Les policies ci-dessous ouvrent une lecture authenticated CIBLÉE aux
-- conversations kind='topic' uniquement (les DM/groupes gardent leurs policies
-- existantes inchangées) :
--   - public                       → tout membre ACTIF du tenant
--   - private + context            → participant de la conversation
-- Aucune policy d'écriture ici (création/réponse = API service_role). RLS déjà
-- activée sur conversations (20260521000033) ; ENABLE répété est idempotent.
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Sujet PUBLIC : lisible par tout membre actif du tenant.
DROP POLICY IF EXISTS "topic_public_read_members" ON public.conversations;
CREATE POLICY "topic_public_read_members" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    kind = 'topic'
    AND visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = conversations.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- Sujet PRIVÉ ou CONTEXTUEL : lisible par les participants de la conversation.
DROP POLICY IF EXISTS "topic_participant_read" ON public.conversations;
CREATE POLICY "topic_participant_read" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    kind = 'topic'
    AND visibility IN ('private','context')
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.user_id = auth.uid()
    )
  );

COMMIT;
