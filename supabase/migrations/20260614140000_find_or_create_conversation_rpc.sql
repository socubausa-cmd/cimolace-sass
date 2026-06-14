-- ============================================================================
-- Migration: RPC public.find_or_create_conversation(p_tenant_id, p_user1, p_user2)
-- Date: 2026-06-14
--
-- PROBLÈME : POST /messaging/send (apps/api/src/messaging/messaging.service.ts:12)
-- appelle this.supabase.client.rpc('find_or_create_conversation',
--   { p_tenant_id, p_user1, p_user2 }) puis lit conv.conversation_id — mais cette
-- RPC N'EXISTAIT PAS en prod (pg_proc = 0) → tout envoi de message échouait.
-- (La messagerie élève côté lecture est corrigée par fix/eleve-p4-rt ; il manquait
-- ce volet backend pour l'envoi.)
--
-- CONTRAT (vérifié dans le service) : params (uuid p_tenant_id, p_user1, p_user2),
-- retour lu en `.conversation_id` côté supabase-js → on renvoie un OBJET via jsonb
-- (RETURNS uuid scalaire donnerait data=uuid, .conversation_id serait undefined).
--
-- SCHÉMA RÉEL (vérifié prod) : conversations {id, tenant_id, name, description,
-- type CHECK('direct','group') default 'direct', created_by nullable, …} ;
-- conversation_participants {id, tenant_id, conversation_id, user_id, joined_at}
-- avec UNIQUE(conversation_id, user_id).
--
-- SÉCURITÉ : appelée uniquement par le service NestJS (service_role, qui bypass la
-- RLS). On n'expose PAS la fonction à anon/authenticated (un client pourrait sinon
-- forger des conversations entre tiers arbitraires).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.find_or_create_conversation(
  p_tenant_id uuid,
  p_user1 uuid,
  p_user2 uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv uuid;
BEGIN
  IF p_tenant_id IS NULL OR p_user1 IS NULL OR p_user2 IS NULL THEN
    RAISE EXCEPTION 'find_or_create_conversation: tenant et deux participants requis'
      USING ERRCODE = '22023';
  END IF;

  -- Conversation DIRECTE déjà existante entre p_user1 et p_user2 dans ce tenant
  -- (type='direct', exactement 2 participants = la paire).
  SELECT cp1.conversation_id INTO v_conv
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2
    ON cp2.conversation_id = cp1.conversation_id
   AND cp2.tenant_id = cp1.tenant_id
  JOIN public.conversations c
    ON c.id = cp1.conversation_id
  WHERE cp1.tenant_id = p_tenant_id
    AND cp1.user_id = p_user1
    AND cp2.user_id = p_user2
    AND c.type = 'direct'
    AND (SELECT count(*) FROM public.conversation_participants cp
         WHERE cp.conversation_id = cp1.conversation_id) = 2
  LIMIT 1;

  -- Sinon, créer la conversation directe + ses 2 participants.
  IF v_conv IS NULL THEN
    INSERT INTO public.conversations (tenant_id, type, created_by)
    VALUES (p_tenant_id, 'direct', p_user1)
    RETURNING id INTO v_conv;

    INSERT INTO public.conversation_participants (tenant_id, conversation_id, user_id)
    VALUES (p_tenant_id, v_conv, p_user1),
           (p_tenant_id, v_conv, p_user2)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('conversation_id', v_conv);
END;
$$;

-- Réservée au service NestJS (service_role). Personne d'autre.
REVOKE ALL ON FUNCTION public.find_or_create_conversation(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_or_create_conversation(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.find_or_create_conversation(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_conversation(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.find_or_create_conversation(uuid, uuid, uuid) IS
  'Trouve ou crée une conversation directe entre 2 users d''un tenant. Appelée par POST /messaging/send (service_role). Retourne jsonb {conversation_id}.';

COMMIT;
