-- Application d'avis publics (témoignages commerciaux)
-- Permet:
-- 1) dépôt d'avis depuis le site vitrine (pending)
-- 2) publication d'avis approuvés (approved)
-- 3) modération par staff (owner/admin/secretariat)

CREATE TABLE IF NOT EXISTS public.site_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'isna' CHECK (source IN ('isna', 'ngowazulu')),
  author_name text NOT NULL,
  author_role text,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_reviews_status_submitted
  ON public.site_reviews(status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_reviews_source_status
  ON public.site_reviews(source, status, submitted_at DESC);

CREATE OR REPLACE FUNCTION public.set_site_reviews_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_reviews_updated ON public.site_reviews;
CREATE TRIGGER trg_site_reviews_updated
BEFORE UPDATE ON public.site_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_site_reviews_updated_at();

ALTER TABLE public.site_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_reviews_public_select ON public.site_reviews;
CREATE POLICY site_reviews_public_select ON public.site_reviews
FOR SELECT USING (status = 'approved');

DROP POLICY IF EXISTS site_reviews_public_insert ON public.site_reviews;
CREATE POLICY site_reviews_public_insert ON public.site_reviews
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS site_reviews_staff_manage ON public.site_reviews;
CREATE POLICY site_reviews_staff_manage ON public.site_reviews
FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
);
