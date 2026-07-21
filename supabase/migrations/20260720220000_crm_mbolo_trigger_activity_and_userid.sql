-- #16 : le trigger mbolo→contact pose désormais user_id (quand connu), utilise ON CONFLICT
-- (unicité de #4) et JOURNALISE l'activité (un contact né d'une commande apparaît dans la
-- timeline, comme via l'API). Recrée uniquement la fonction (le trigger la référence par nom).

create or replace function public.crm_upsert_contact_from_mbolo_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(btrim(coalesce(NEW.customer_email, '')), ''));
  v_name  text := nullif(btrim(coalesce(NEW.customer_name, '')), '');
  v_phone text := nullif(btrim(coalesce(NEW.customer_phone, '')), '');
  v_uid   uuid := NEW.user_id;
  v_first text;
  v_last  text;
  v_id    uuid;
begin
  if v_email is null and v_uid is not null then
    select nullif(btrim(lower(coalesce(email, ''))), '') into v_email from public.profiles where id = v_uid;
  end if;
  if v_email is null and v_uid is null then return NEW; end if;

  if exists (
    select 1 from public.crm_contacts
    where tenant_id = NEW.tenant_id
      and ((v_uid is not null and user_id = v_uid) or (v_email is not null and lower(email) = v_email))
  ) then
    update public.crm_contacts set user_id = coalesce(user_id, v_uid)
    where tenant_id = NEW.tenant_id and user_id is null and v_email is not null and lower(email) = v_email;
    return NEW;
  end if;

  if v_name is not null then
    v_first := split_part(v_name, ' ', 1);
    v_last  := nullif(btrim(substr(v_name, length(split_part(v_name, ' ', 1)) + 1)), '');
  end if;

  insert into public.crm_contacts (tenant_id, user_id, first_name, last_name, email, phone, source, status)
  values (NEW.tenant_id, v_uid, v_first, v_last, v_email, v_phone, 'mbolo', 'active')
  on conflict do nothing
  returning id into v_id;

  if v_id is not null then
    insert into public.crm_activities (tenant_id, entity_type, entity_id, type, title)
    values (NEW.tenant_id, 'contact', v_id, 'contact_created', 'Contact créé depuis une commande mbolo');
  end if;

  return NEW;
exception when others then
  return NEW;
end;
$$;
