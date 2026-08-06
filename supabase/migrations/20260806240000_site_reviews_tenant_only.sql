-- Modération des avis : SEULE l'appartenance réelle au tenant compte désormais.
--
-- Décision du fondateur (2026-08-06) : « sur isna prorascience le seul propriétaire
-- c'est socubausa@gmail.com ». On retire donc le chemin hérité `profiles.role`, qui
-- accordait la modération sur la foi d'un rôle GLOBAL sans lien avec le tenant.
--
-- Ce que ce chemin laissait passer, mesuré avant fermeture :
--   · test@example.com                  → owner global, AUCUNE appartenance (compte supprimé depuis)
--   · cimolace-admin@prorascience.local → admin global, AUCUNE appartenance
--   · cimolace@gmail.com                → owner global, mais simple ÉLÈVE d'isna
--
-- Après cette migration, la modération des avis d'un produit revient exclusivement
-- aux owner/admin/secretariat ACTIFS du tenant qui possède ce produit.
-- Pour rouvrir l'accès à quelqu'un : lui donner une vraie appartenance au tenant
-- (`tenant_memberships`), pas un rôle global.
--
-- ⚠️ Appliquée HORS-BANDE via psql (jamais `supabase db push` sur ce projet).

create or replace function public.is_site_reviews_staff(p_product_slug text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.user_id = auth.uid()
      and lower(coalesce(tm.role, '')) in ('owner', 'admin', 'secretariat')
      and coalesce(tm.status, 'active') = 'active'
      and t.slug = coalesce(
        (select dp.tenant_slug from public.digital_products dp
          where dp.slug = p_product_slug),
        'isna')
  );
$$;
