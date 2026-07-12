-- 20260711140000_vnp_stats_rpc.sql
-- Lecteur des stats VNP (§6) pour le back-office secrétariat. Les 4 vues (vnp_top_nodes/funnel/
-- actions/unanswered) sont grantées service_role uniquement → le front staff ne peut pas les lire
-- directement. On expose une RPC SECURITY DEFINER GATÉE STAFF (même modèle que vnp_set_*_status) :
-- elle ne renvoie que les stats des tenants dont l'appelant est membre staff actif.

create or replace function public.vnp_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slugs text[];
  result  json;
begin
  -- Tenants où l'appelant est staff actif (gate identique aux RPC de statut existantes).
  select array_agg(distinct t.slug) into v_slugs
  from public.tenant_memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = auth.uid()
    and m.status = 'active'
    and m.role in ('owner', 'admin', 'teacher', 'secretariat');

  if v_slugs is null then
    raise exception 'accès refusé' using errcode = '42501';
  end if;

  select json_build_object(
    'top_nodes', coalesce((select json_agg(row_to_json(x)) from (
        select node_id, ouvertures, via_tour, derniere
        from public.vnp_top_nodes where tenant_slug = any(v_slugs)
        order by ouvertures desc limit 20) x), '[]'::json),
    'funnel', coalesce((select json_agg(row_to_json(x)) from (
        select type, nb, derniere
        from public.vnp_funnel where tenant_slug = any(v_slugs)
        order by nb desc) x), '[]'::json),
    'actions', coalesce((select json_agg(row_to_json(x)) from (
        select action, nb
        from public.vnp_actions where tenant_slug = any(v_slugs)
        order by nb desc) x), '[]'::json),
    'unanswered', coalesce((select json_agg(row_to_json(x)) from (
        select tenant_slug, nb, derniere
        from public.vnp_unanswered where tenant_slug = any(v_slugs)) x), '[]'::json)
  ) into result;

  return result;
end;
$$;

revoke all on function public.vnp_stats() from public, anon;
grant execute on function public.vnp_stats() to authenticated;
