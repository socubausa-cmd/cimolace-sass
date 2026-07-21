-- CRM de gestion des TENANTS-CLIENTS dans le tenant CIMOLACE.
-- Chaque tenant-client (slug != 'cimolace') est reflété dans le CRM du tenant Cimolace :
--   société (le client) + contact (son owner) + deal (le client dans le pipeline).
-- Permet à Cimolace (le SaaS) de gérer ses clients comme un pipeline commercial.
-- Exception-safe : ne casse JAMAIS une écriture sur `tenants`. Appliqué hors-bande via psql.

create or replace function public.crm_sync_tenant_to_cimolace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cim uuid := '16ec05e1-f0e1-45fc-96d9-3a49ac84eed8'; -- tenant Cimolace
  v_email text;
  v_name  text;
  v_first text;
  v_last  text;
  v_company uuid;
  v_contact uuid;
  v_pipeline uuid;
  v_stage uuid;
begin
  if coalesce(NEW.slug, '') = 'cimolace' then return NEW; end if; -- ne pas se gérer soi-même

  -- 1) SOCIÉTÉ = le tenant-client (find-or-create par nom dans le CRM Cimolace).
  select id into v_company from public.crm_companies
    where tenant_id = v_cim and lower(name) = lower(NEW.name) limit 1;
  if v_company is null then
    insert into public.crm_companies (tenant_id, name, website, industry, description)
    values (v_cim, NEW.name, NEW.primary_domain, NEW.platform_type, 'Tenant Cimolace · ' || NEW.slug)
    returning id into v_company;
  else
    update public.crm_companies
      set website = coalesce(website, NEW.primary_domain), industry = coalesce(industry, NEW.platform_type)
      where id = v_company;
  end if;

  -- 2) CONTACT = l'owner du tenant (résolu via profiles).
  if NEW.owner_user_id is not null then
    select nullif(btrim(lower(coalesce(email, ''))), ''), coalesce(full_name, name)
      into v_email, v_name from public.profiles where id = NEW.owner_user_id;
    if v_email is not null then
      select id into v_contact from public.crm_contacts
        where tenant_id = v_cim and lower(email) = v_email limit 1;
      if v_contact is null then
        v_first := nullif(split_part(coalesce(v_name, ''), ' ', 1), '');
        v_last  := nullif(btrim(substr(coalesce(v_name, ''), length(split_part(coalesce(v_name, ''), ' ', 1)) + 1)), '');
        insert into public.crm_contacts (tenant_id, company_id, user_id, first_name, last_name, email, source, status)
        values (v_cim, v_company, NEW.owner_user_id, v_first, v_last, v_email, 'tenant', 'active')
        on conflict do nothing
        returning id into v_contact;
        if v_contact is null then
          select id into v_contact from public.crm_contacts where tenant_id = v_cim and lower(email) = v_email limit 1;
        end if;
      else
        update public.crm_contacts
          set company_id = coalesce(company_id, v_company), user_id = coalesce(user_id, NEW.owner_user_id)
          where id = v_contact;
      end if;
    end if;
  end if;

  -- 3) DEAL = le client dans le pipeline (find-or-create par société). Statut dérivé du tenant.
  select id into v_pipeline from public.crm_pipelines
    where tenant_id = v_cim order by is_default desc, position asc limit 1;
  if v_pipeline is not null
     and not exists (select 1 from public.crm_deals where tenant_id = v_cim and company_id = v_company) then
    if NEW.status = 'active' then
      select id into v_stage from public.crm_stages
        where tenant_id = v_cim and pipeline_id = v_pipeline and is_won = true order by position asc limit 1;
    else
      select id into v_stage from public.crm_stages
        where tenant_id = v_cim and pipeline_id = v_pipeline order by position asc limit 1;
    end if;
    insert into public.crm_deals (tenant_id, pipeline_id, stage_id, company_id, contact_id, title, amount, currency, status, closed_at)
    values (v_cim, v_pipeline, v_stage, v_company, v_contact, NEW.name, 0, 'EUR',
            case when NEW.status = 'active' then 'won' else 'open' end,
            case when NEW.status = 'active' then now() else null end);
  end if;

  return NEW;
exception when others then
  return NEW; -- un trigger CRM ne doit jamais échouer une opération sur tenants
end;
$$;

drop trigger if exists trg_crm_sync_tenant on public.tenants;
create trigger trg_crm_sync_tenant
  after insert or update of name, status, owner_user_id, primary_domain on public.tenants
  for each row execute function public.crm_sync_tenant_to_cimolace();
