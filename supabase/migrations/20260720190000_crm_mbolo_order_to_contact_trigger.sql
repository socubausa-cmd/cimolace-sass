-- Reliure mbolo -> CRM (inbound) : chaque commande mbolo crée automatiquement un contact CRM.
-- Découplé du code applicatif (aucun conflit avec mbolo.service.ts), temps réel, couvre TOUS
-- les chemins de commande (storefront invité, panier connecté, admin).
-- ⚠️ EXCEPTION-SAFE : le trigger n'échoue JAMAIS un INSERT de commande (WHEN OTHERS -> NEW).
-- Tenant-scopé (NEW.tenant_id). Find-or-create par (tenant_id, lower(email)) -> idempotent.

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
  v_first text;
  v_last  text;
begin
  -- Commande connectée : customer_email NULL -> résoudre via profiles (email = auth, minuscule).
  if v_email is null and NEW.user_id is not null then
    select lower(email) into v_email from public.profiles where id = NEW.user_id;
  end if;
  if v_email is null then
    return NEW;  -- pas d'email exploitable -> rien à rattacher
  end if;

  -- Contact déjà présent pour ce tenant + email -> ne rien faire (pas d'écrasement des édits CRM).
  if exists (
    select 1 from public.crm_contacts c
    where c.tenant_id = NEW.tenant_id and lower(c.email) = v_email
  ) then
    return NEW;
  end if;

  -- Nom "Prénom Nom" -> first/last (best-effort).
  if v_name is not null then
    v_first := split_part(v_name, ' ', 1);
    v_last  := nullif(btrim(substr(v_name, length(split_part(v_name, ' ', 1)) + 1)), '');
  end if;

  insert into public.crm_contacts (tenant_id, first_name, last_name, email, phone, source, status)
  values (NEW.tenant_id, v_first, v_last, v_email, v_phone, 'mbolo', 'active');

  return NEW;
exception when others then
  return NEW;  -- garde-fou absolu : une commande ne doit JAMAIS échouer à cause du CRM
end;
$$;

drop trigger if exists trg_crm_contact_from_mbolo_order on public.mbolo_orders;
create trigger trg_crm_contact_from_mbolo_order
  after insert on public.mbolo_orders
  for each row execute function public.crm_upsert_contact_from_mbolo_order();
