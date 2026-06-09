-- Table "resources" — centre de ressources pédagogiques de l'espace élève
-- (onglet "Ressources" → apps/app/src/pages/LibraryPage.jsx). L'UI existait mais
-- affichait des données mockées hors-sujet ; cette table fournit le vrai contenu,
-- scopé par tenant et filtré par RLS (même motif que public.announcements).

CREATE TABLE IF NOT EXISTS public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'documents',
  resource_type text NOT NULL DEFAULT 'pdf'
    CHECK (resource_type IN ('video','pdf','audio','article','link')),
  url text,
  thumbnail_url text,
  duration_label text,
  size_label text,
  access_level text NOT NULL DEFAULT 'tous'
    CHECK (access_level IN ('tous','academique_plus')),
  course_id uuid,
  is_published boolean NOT NULL DEFAULT true,
  order_index int NOT NULL DEFAULT 0,
  published_at timestamptz DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Lecture : tout membre ACTIF du tenant voit les ressources PUBLIÉES de son tenant.
DROP POLICY IF EXISTS resources_select_tenant ON public.resources;
CREATE POLICY resources_select_tenant ON public.resources
  FOR SELECT TO authenticated
  USING (
    is_published = true
    AND tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );

-- Gestion : le staff (admin/owner/creator/teacher/secretariat) du tenant gère tout.
DROP POLICY IF EXISTS resources_manage_staff ON public.resources;
CREATE POLICY resources_manage_staff ON public.resources
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
        AND tm.role IN ('admin','owner','creator','teacher','secretariat')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
        AND tm.role IN ('admin','owner','creator','teacher','secretariat')
    )
  );

CREATE INDEX IF NOT EXISTS resources_tenant_cat_idx
  ON public.resources (tenant_id, category, order_index);
