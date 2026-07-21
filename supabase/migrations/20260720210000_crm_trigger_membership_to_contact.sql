-- #6 : reliure ENTRANTE centrale — toute nouvelle appartenance tenant (signup, invitation,
-- provisioning) crée un contact CRM. Calqué sur le trigger mbolo (exception-safe, tenant-scopé).
-- ⚠️ DENYLIST de rôles : on NE crée PAS de contact pour le staff (owner/admin/teacher/…) ni
-- pour les patients MEDOS (séparation données santé — décision fondateur si à élargir).
-- Les rôles clients (student + custom) remontent au CRM. Idempotent (user_id OU email).

create or replace function public.crm_upsert_contact_from_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_name  text;
  v_first text;
  v_last  text;
  v_id    uuid;
  v_deny  text[] := array['owner','admin','teacher','secretariat','receptionist','practitioner','staff','patient'];
begin
  if coalesce(NEW.status,'') <> 'active' then return NEW; end if;
  if NEW.role = any(v_deny) then return NEW; end if;  -- staff / patient → pas de contact sales

  select nullif(btrim(lower(coalesce(email,''))),''), coalesce(full_name, name)
    into v_email, v_name
    from public.profiles where id = NEW.user_id;

  -- Déjà un contact (par identité OU email) ? → enrichir le user_id manquant, ne pas dupliquer.
  if exists (
    select 1 from public.crm_contacts
    where tenant_id = NEW.tenant_id
      and (user_id = NEW.user_id or (v_email is not null and lower(email) = v_email))
  ) then
    update public.crm_contacts set user_id = NEW.user_id
    where tenant_id = NEW.tenant_id and user_id is null
      and v_email is not null and lower(email) = v_email;
    return NEW;
  end if;

  if v_name is not null then
    v_first := split_part(v_name, ' ', 1);
    v_last  := nullif(btrim(substr(v_name, length(split_part(v_name, ' ', 1)) + 1)), '');
  end if;

  insert into public.crm_contacts (tenant_id, user_id, first_name, last_name, email, source, status)
  values (NEW.tenant_id, NEW.user_id, v_first, v_last, v_email, 'signup', 'active')
  on conflict do nothing
  returning id into v_id;

  if v_id is not null then
    insert into public.crm_activities (tenant_id, entity_type, entity_id, type, title)
    values (NEW.tenant_id, 'contact', v_id, 'contact_created', 'Contact créé depuis une inscription');
  end if;

  return NEW;
exception when others then
  return NEW;  -- un trigger CRM ne doit JAMAIS échouer un signup/une invitation
end;
$$;

drop trigger if exists trg_crm_contact_from_membership on public.tenant_memberships;
create trigger trg_crm_contact_from_membership
  after insert or update of status, role on public.tenant_memberships
  for each row execute function public.crm_upsert_contact_from_membership();
