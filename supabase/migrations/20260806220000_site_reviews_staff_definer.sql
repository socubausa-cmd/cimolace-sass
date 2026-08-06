-- Modération des avis, 2ᵉ passe : la policy ne peut pas lire `tenants`.
--
-- La tentative précédente joignait `tenant_memberships` → `tenants` DANS la policy.
-- Piège : les sous-requêtes d'une policy s'exécutent AVEC les droits de l'appelant,
-- donc elles sont elles-mêmes filtrées par RLS. Mesuré en prod : une session
-- authentifiée voit 2 lignes de `tenant_memberships` mais **0 ligne de `tenants`**
-- → la jointure ne matche jamais → le propriétaire reste bloqué, sans erreur.
--
-- On déplace donc le test dans une fonction SECURITY DEFINER : elle s'exécute avec
-- les droits de son propriétaire, voit `tenants` et `digital_products`, et ne rend
-- qu'un BOOLÉEN calculé sur `auth.uid()`. Aucune donnée ne peut fuir par là.
--
-- ⚠️ Appliquée HORS-BANDE via psql (jamais `supabase db push` sur ce projet).

create or replace function public.is_site_reviews_staff(p_product_slug text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    -- (1) LEGACY — rôle global dans profiles. Conservé : personne ne perd l'accès.
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role, '')) in ('owner', 'admin', 'secretariat')
    )
    or
    -- (2) RÔLE TENANT — la source de vérité, scopée au tenant qui possède le produit.
    exists (
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

revoke all on function public.is_site_reviews_staff(text) from public;
grant execute on function public.is_site_reviews_staff(text) to authenticated;

drop policy if exists site_reviews_staff_manage on public.site_reviews;

create policy site_reviews_staff_manage on public.site_reviews
for all
using (public.is_site_reviews_staff(product_slug))
with check (public.is_site_reviews_staff(product_slug));
