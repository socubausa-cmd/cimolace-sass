-- Table "announcements" (manquante) — annonces officielles affichées dans
-- l'onglet "Annonces" de la Vie Scolaire (espace élève).
-- L'UI existait déjà (apps/app/src/components/school-life/SchoolLifeComponents.jsx)
-- mais interrogeait une table inexistante → onglet vide.

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  summary text,
  category text NOT NULL DEFAULT 'info',
  priority text NOT NULL DEFAULT 'normal',
  audience text NOT NULL DEFAULT 'students_all',
  status text NOT NULL DEFAULT 'published',
  extras_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Lecture : tout membre ACTIF du tenant voit les annonces PUBLIÉES de son tenant.
DROP POLICY IF EXISTS announcements_select_tenant ON public.announcements;
CREATE POLICY announcements_select_tenant ON public.announcements
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );

-- Gestion : le staff (admin/owner/creator/teacher/secretariat) du tenant gère tout.
DROP POLICY IF EXISTS announcements_manage_staff ON public.announcements;
CREATE POLICY announcements_manage_staff ON public.announcements
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

CREATE INDEX IF NOT EXISTS announcements_tenant_status_idx
  ON public.announcements (tenant_id, status, published_at DESC);
