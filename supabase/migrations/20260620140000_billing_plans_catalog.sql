-- Catalogue de services tenant-scopé : étend billing_plans pour devenir la source de vérité
-- gérable depuis le back-office (un service = une ligne, prix + contenu + catégorie).
-- Non-destructif : on AJOUTE des colonnes, on ne touche pas aux existantes (prix inchangés).

ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS category text,                               -- cycle | temple | consultation | mentorat | custom | saas
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tagline text,                                -- accroche courte affichée sur la fiche
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb; -- libre : icône, cta_href, image…

-- Catalogue lu par tenant + catégorie + ordre.
CREATE INDEX IF NOT EXISTS billing_plans_tenant_category_idx
  ON public.billing_plans (tenant_id, category, sort_order);

-- ── Rangement des offres ISNA existantes (tenant isna = 4f6faaa8-43a0-46d6-b98a-99ea1154f9ea) ──

-- Les 4 cycles d'initiation
UPDATE public.billing_plans
SET tenant_id = '4f6faaa8-43a0-46d6-b98a-99ea1154f9ea',
    category  = 'cycle',
    sort_order = CASE key
      WHEN 'autonome-monthly'   THEN 1
      WHEN 'academique-monthly' THEN 2
      WHEN 'prive-monthly'      THEN 3
      WHEN 'privilegie-monthly' THEN 4
      ELSE sort_order END,
    tagline = CASE key
      WHEN 'autonome-monthly'   THEN 'Apprenez à votre rythme.'
      WHEN 'academique-monthly' THEN 'Vous n''apprenez plus seul.'
      WHEN 'prive-monthly'      THEN 'Une guidance directe et personnelle.'
      WHEN 'privilegie-monthly' THEN 'Ne plus recevoir. Transmettre.'
      ELSE tagline END
WHERE key IN ('autonome-monthly','academique-monthly','prive-monthly','privilegie-monthly');

-- Consultation 90 min + ouverture recouvrement (univers Ngowazulu / accompagnement)
UPDATE public.billing_plans
SET tenant_id = '4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', category = 'consultation'
WHERE key IN ('ngowazulu-consultation-90min','ngowazulu-ouverture-recouvrement');

-- Paliers mentorat
UPDATE public.billing_plans
SET tenant_id = '4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', category = 'mentorat'
WHERE key LIKE 'ngowazulu-mentorat-%';
