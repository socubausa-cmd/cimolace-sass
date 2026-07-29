-- `live_script_sections.session_id` est un TEXT legacy, donc aucune FK ne le
-- relie à live_sessions contrairement aux blueprints/scènes. Nettoyage additif :
-- une suppression de session ne doit pas laisser son prompteur orphelin.
create or replace function public.cleanup_live_script_sections_on_session_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.live_script_sections where session_id = old.id::text;
  return old;
end;
$$;

drop trigger if exists trg_cleanup_live_script_sections on public.live_sessions;
create trigger trg_cleanup_live_script_sections
  after delete on public.live_sessions
  for each row execute function public.cleanup_live_script_sections_on_session_delete();
