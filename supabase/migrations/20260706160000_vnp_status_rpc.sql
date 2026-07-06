-- VNP — RPC de changement de statut (back-office secrétariat / admin).
-- Les tables `vnp_booking_requests` (demandes de RDV publiques) et `contact_requests`
-- (leads du formulaire de contact) n'ont AUCUNE policy UPDATE côté client : seul le
-- service_role (l'edge) écrit, et les membres actifs du tenant LISENT (policies existantes).
-- Pour que le secrétariat fasse AVANCER une demande sans exposer de secret ni ouvrir une
-- edge publique mutante, on passe par des RPC SECURITY DEFINER gatées sur l'appartenance
-- au tenant — en réutilisant EXACTEMENT le contrôle des policies de lecture de chaque table.
-- `auth.uid()` = l'appelant authentifié (session Supabase du membre).

BEGIN;

-- ── 1. Demandes de RDV publiques (VNP) : requested → confirmed | cancelled | completed ──
-- Gate = MÊME que la policy de lecture `vnp_booking_read_members` (tout membre actif).
CREATE OR REPLACE FUNCTION public.vnp_set_booking_request_status(
  p_id uuid,
  p_status text
) RETURNS public.vnp_booking_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.vnp_booking_requests;
BEGIN
  IF p_status NOT IN ('requested', 'confirmed', 'cancelled', 'completed') THEN
    RAISE EXCEPTION 'statut invalide: %', p_status USING errcode = '22023';
  END IF;

  UPDATE public.vnp_booking_requests b
     SET status = p_status,
         updated_at = now()
   WHERE b.id = p_id
     AND EXISTS (
       SELECT 1 FROM public.tenant_memberships m
        WHERE m.tenant_id = b.tenant_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
     )
  RETURNING b.* INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'demande introuvable ou accès refusé' USING errcode = '42501';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.vnp_set_booking_request_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vnp_set_booking_request_status(uuid, text) TO authenticated;

-- ── 2. Messages de contact (formulaire vitrine / VNP) : new → read | replied | archived ──
-- Gate = MÊME que la policy de lecture `cr_staff_read` (membre actif AVEC rôle staff).
CREATE OR REPLACE FUNCTION public.vnp_set_contact_request_status(
  p_id uuid,
  p_status text
) RETURNS public.contact_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.contact_requests;
BEGIN
  IF p_status NOT IN ('new', 'read', 'replied', 'archived') THEN
    RAISE EXCEPTION 'statut invalide: %', p_status USING errcode = '22023';
  END IF;

  UPDATE public.contact_requests c
     SET status = p_status
   WHERE c.id = p_id
     AND EXISTS (
       SELECT 1 FROM public.tenant_memberships m
        WHERE m.tenant_id = c.tenant_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
          AND m.role IN ('owner', 'admin', 'teacher', 'secretariat')
     )
  RETURNING c.* INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'message introuvable ou accès refusé' USING errcode = '42501';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.vnp_set_contact_request_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vnp_set_contact_request_status(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.vnp_set_booking_request_status(uuid, text) IS
  'Secrétariat/admin : change le statut d''une demande de RDV VNP (gate = membre actif du tenant).';
COMMENT ON FUNCTION public.vnp_set_contact_request_status(uuid, text) IS
  'Secrétariat/admin : change le statut d''un message de contact (gate = staff actif du tenant).';

COMMIT;
