-- Fix : isoler les cours publiés par tenant
-- La policy public_read_published_courses exposait les cours de TOUS les tenants
-- à n'importe quel utilisateur authentifié. On restreint au tenant courant.

BEGIN;

-- Supprimer l'ancienne policy trop permissive
DROP POLICY IF EXISTS public_read_published_courses ON courses;

-- Nouvelle policy : cours publiés visibles uniquement aux membres du tenant
-- OU si l'utilisateur passe le bon X-Tenant-Slug (résolu via current_setting)
CREATE POLICY tenant_member_read_published_courses ON courses
  FOR SELECT
  USING (
    status = 'published'
    AND (
      -- Membre actif du tenant
      EXISTS (
        SELECT 1 FROM tenant_memberships tm
        WHERE tm.tenant_id = courses.tenant_id
          AND tm.user_id = auth.uid()
          AND tm.status = 'active'
      )
      -- OU accès via access_pass (étudiant ayant acheté un cours)
      OR EXISTS (
        SELECT 1 FROM access_passes ap
        WHERE ap.resource_type = 'course'
          AND ap.resource_id = courses.id::text
          AND ap.user_id = auth.uid()
          AND ap.status = 'active'
      )
      -- OU staff Cimolace (service_role bypass déjà géré au niveau RLS)
    )
  );

-- Policy pour les cours gratuits (is_free = true) — visibles à tous les membres du tenant
-- sans nécessiter un access_pass
CREATE POLICY tenant_member_read_free_courses ON courses
  FOR SELECT
  USING (
    status = 'published'
    AND COALESCE((metadata->>'is_free')::boolean, price_cents IS NULL OR price_cents = 0)
    AND EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = courses.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- Table access_passes : s'assurer qu'elle couvre aussi les cours
-- (elle couvrait déjà live_session, on ajoute course)
-- La table existe déjà, la vérification se fait dans la policy ci-dessus.

COMMIT;
