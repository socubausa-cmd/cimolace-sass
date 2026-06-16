-- ════════════════════════════════════════════════════════════════════════════
-- SÉCURITÉ [CRITIQUE] — Bloque l'auto-élévation de privilège via profiles.
-- Contexte : la policy `profiles_update_self` (FOR UPDATE, WITH CHECK id=auth.uid())
-- ne protège AUCUNE colonne → un utilisateur authentifié peut faire
--   supabase.from('profiles').update({ role:'owner', metadata:{cimolace_staff:true} })
-- sur sa propre ligne et devenir owner / staff Cimolace (source de vérité lue par
-- le front, les edge functions et CimolaceStaffGuard).
--
-- Correctif : un trigger BEFORE UPDATE qui, pour toute session NON service_role,
-- gèle `role` et `metadata.cimolace_staff` à leurs valeurs précédentes. Les écritures
-- légitimes (API NestJS / admin) passent par la clé service_role et restent permises.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.profiles_freeze_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Les écritures serveur (clé service_role) ne sont pas restreintes.
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Session utilisateur (authenticated/anon) : on gèle le rôle applicatif…
  NEW.role := OLD.role;

  -- …et le flag staff Cimolace dans metadata (préserve l'ancienne valeur, ou la retire).
  IF OLD.metadata ? 'cimolace_staff' THEN
    NEW.metadata := jsonb_set(coalesce(NEW.metadata, '{}'::jsonb),
                              '{cimolace_staff}', OLD.metadata -> 'cimolace_staff', true);
  ELSE
    NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb) - 'cimolace_staff';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_freeze_privileges ON public.profiles;
CREATE TRIGGER trg_profiles_freeze_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_freeze_privileges();

-- Vérif rapide (à exécuter en session utilisateur, doit rester au rôle d'origine) :
--   UPDATE profiles SET role='owner' WHERE id = auth.uid();  -- ne change rien
