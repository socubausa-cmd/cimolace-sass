-- Modération des avis : reconnaître les rôles TENANT, pas seulement `profiles.role`.
--
-- La policy `site_reviews_staff_manage` n'interrogeait que `profiles.role`, l'ancien
-- rôle GLOBAL. Les rôles réels de la plateforme vivent dans `tenant_memberships`,
-- par tenant. Conséquence mesurée en prod le 2026-08-06 :
--   · jkalonji06@gmail.com  → owner d'isna   / profiles.role = practitioner → BLOQUÉ
--   · socubausa@gmail.com   → owner d'isna   / profiles.role = visitor      → BLOQUÉ
--   · cimolace@gmail.com    → élève d'isna   / profiles.role = owner        → AUTORISÉ
-- Les deux propriétaires réels ne pouvaient pas modérer leurs propres témoignages,
-- et l'onglet « Avis & Témoignages » leur renvoyait une liste vide SANS erreur —
-- le pire des symptômes, parce qu'il ressemble à « il n'y a rien à modérer ».
--
-- On AJOUTE le chemin par appartenance au tenant sans retirer l'ancien : personne
-- ne perd l'accès qu'il avait. Le tenant retenu est celui du produit concerné
-- (`digital_products.tenant_slug`), avec repli sur 'isna' pour les avis historiques
-- qui n'ont pas de `product_slug`.
--
-- ⚠️ RESTE À TRANCHER PAR LE FONDATEUR : l'ancien chemin `profiles.role` laisse
-- encore un compte qui n'est qu'ÉLÈVE d'isna modérer les avis d'isna. Le retirer
-- se fait en supprimant le premier bloc `exists` ci-dessous — mais il faut d'abord
-- s'assurer qu'aucun membre du secrétariat ne dépend QUE de `profiles.role`.
--
-- ⚠️ Appliquée HORS-BANDE via psql (jamais `supabase db push` sur ce projet).

drop policy if exists site_reviews_staff_manage on public.site_reviews;

create policy site_reviews_staff_manage on public.site_reviews
for all
using (
  -- (1) LEGACY — rôle global dans profiles. Conservé pour ne bloquer personne.
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) in ('owner', 'admin', 'secretariat')
  )
  or
  -- (2) RÔLE TENANT — la source de vérité réelle, portée par l'appartenance.
  exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.user_id = auth.uid()
      and lower(coalesce(tm.role, '')) in ('owner', 'admin', 'secretariat')
      and coalesce(tm.status, 'active') = 'active'
      and t.slug = coalesce(
        (select dp.tenant_slug from public.digital_products dp
          where dp.slug = site_reviews.product_slug),
        'isna')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) in ('owner', 'admin', 'secretariat')
  )
  or
  exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.user_id = auth.uid()
      and lower(coalesce(tm.role, '')) in ('owner', 'admin', 'secretariat')
      and coalesce(tm.status, 'active') = 'active'
      and t.slug = coalesce(
        (select dp.tenant_slug from public.digital_products dp
          where dp.slug = site_reviews.product_slug),
        'isna')
  )
);
