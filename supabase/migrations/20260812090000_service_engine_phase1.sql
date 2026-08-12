-- LIRI Service Engine — PHASE 1 : catalogue de services PAR TENANT + catégories.
--
-- Décisions actées après l'audit Phase 0 (docs/LIRI_SERVICE_ENGINE_PHASE0_AUDIT.md) :
--   · on ÉTEND `services` au lieu de créer une table jumelle (§22 : pas de
--     second système quand un moteur existant peut porter le besoin) ;
--   · on modélise la marketplace dès maintenant (`is_public`, slug unique PAR
--     tenant) sans construire les pages : le rétro-fitter coûterait une reprise ;
--   · les commandes iront dans `orders`/`order_items` (vides aujourd'hui), pas
--     dans un cinquième silo — traité en phase 3.
--
-- SÛRETÉ VÉRIFIÉE AVANT ÉCRITURE : la table `services` n'a AUCUN lecteur.
-- Ni l'API (`grep .from('services')` → rien), ni le front (ServiceCatalogManager
-- lit `billingCatalogApi`, c'est-à-dire le catalogue Cimolace, pas cette table),
-- ni un ORM (pas de Prisma, pas d'entité TypeORM). Elle contient 2 lignes mortes
-- (offres Vitalis de Prorascience). On peut donc la remodeler sans régression.
--
-- ⚠️ Appliquée HORS-BANDE via psql (jamais `supabase db push` sur ce projet).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CATÉGORIES
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.service_categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  parent_id   uuid references public.service_categories(id) on delete set null,
  name        text not null,
  slug        text not null,
  description text,
  icon        text,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index if not exists idx_service_categories_tenant
  on public.service_categories(tenant_id, is_active, sort_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SERVICES — cloisonnement puis champs du §5
-- ─────────────────────────────────────────────────────────────────────────────

-- Cloisonnement. Nullable d'abord : on remplit, PUIS on contraint. Poser
-- `not null` avant le remplissage ferait échouer la migration sur les 2 lignes.
alter table public.services add column if not exists tenant_id uuid
  references public.tenants(id) on delete cascade;

update public.services
   set tenant_id = (select id from public.tenants where slug = 'isna')
 where tenant_id is null;

alter table public.services alter column tenant_id set not null;

-- Rattachement et visibilité
alter table public.services add column if not exists category_id uuid
  references public.service_categories(id) on delete set null;
alter table public.services add column if not exists is_public boolean not null default false;

-- §6 — modes de délivrance. Tableau : un service peut être hybride.
alter table public.services add column if not exists delivery_modes text[] not null default '{}';
alter table public.services add column if not exists liri_environment text;

-- §5 — capacité et rythme
alter table public.services add column if not exists is_group boolean not null default false;
alter table public.services add column if not exists capacity integer;
alter table public.services add column if not exists prep_minutes integer not null default 0;
alter table public.services add column if not exists buffer_minutes integer not null default 0;

-- §5 — règles commerciales
alter table public.services add column if not exists requires_booking boolean not null default true;
alter table public.services add column if not exists requires_payment boolean not null default true;
alter table public.services add column if not exists deposit_enabled boolean not null default false;
alter table public.services add column if not exists deposit_cents integer;
alter table public.services add column if not exists deposit_percent integer;
alter table public.services add column if not exists is_quote_only boolean not null default false;
alter table public.services add column if not exists cancellation_hours integer;
alter table public.services add column if not exists refund_policy text;
alter table public.services add column if not exists terms text;

-- §5 — préalables et pièces
alter table public.services add column if not exists questionnaire jsonb not null default '[]'::jsonb;
alter table public.services add column if not exists required_documents jsonb not null default '[]'::jsonb;

-- §5 — prix complémentaires (le champ historique "priceEUR" reste la référence EUR)
alter table public.services add column if not exists price_xaf integer;
alter table public.services add column if not exists tax_percent numeric;

-- §9 — prestation à domicile
alter table public.services add column if not exists travel_enabled boolean not null default false;
alter table public.services add column if not exists travel_fee_cents integer;
alter table public.services add column if not exists travel_radius_km integer;

-- §7 — bornes de réservation
alter table public.services add column if not exists min_notice_hours integer;
alter table public.services add column if not exists max_advance_days integer;

alter table public.services add column if not exists created_by uuid references public.profiles(id) on delete set null;

-- Modes de délivrance admis (§6). Contrainte posée APRÈS les colonnes.
alter table public.services drop constraint if exists services_delivery_modes_check;
alter table public.services add constraint services_delivery_modes_check
  check (delivery_modes <@ array['liri','on_site','home','event']::text[]);

-- Le slug devient unique PAR TENANT (il était global). Prépare la marketplace :
-- deux tenants peuvent avoir chacun leur service « coiffure ».
drop index if exists services_slug_key;
alter table public.services drop constraint if exists services_slug_key;
create unique index if not exists uq_services_tenant_slug
  on public.services(tenant_id, slug);

create index if not exists idx_services_tenant_active
  on public.services(tenant_id, "isActive", "sortOrder");
create index if not exists idx_services_public
  on public.services(is_public, "isActive") where is_public = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS — cloisonnement par APPARTENANCE au tenant
-- ─────────────────────────────────────────────────────────────────────────────

-- Fonction SECURITY DEFINER : une policy exécute ses sous-requêtes avec les
-- droits de l'APPELANT, donc elles sont elles-mêmes filtrées par RLS. Joindre
-- `tenants` dans une policy ne marche pas (une session authentifiée y voit 0
-- ligne) — piège constaté le 6 août sur site_reviews. On sort donc le test.
create or replace function public.is_tenant_staff(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.tenant_id = p_tenant_id
      and lower(coalesce(tm.role, '')) in ('owner', 'admin', 'secretariat', 'manager')
      and coalesce(tm.status, 'active') = 'active'
  );
$$;

revoke all on function public.is_tenant_staff(uuid) from public;
grant execute on function public.is_tenant_staff(uuid) to authenticated;

alter table public.services enable row level security;
alter table public.service_categories enable row level security;

-- Lecture publique : uniquement ce que le tenant a explicitement publié.
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services
for select using (is_public = true and "isActive" = true);

drop policy if exists services_staff_manage on public.services;
create policy services_staff_manage on public.services
for all using (public.is_tenant_staff(tenant_id))
with check (public.is_tenant_staff(tenant_id));

drop policy if exists service_categories_public_read on public.service_categories;
create policy service_categories_public_read on public.service_categories
for select using (is_active = true);

drop policy if exists service_categories_staff_manage on public.service_categories;
create policy service_categories_staff_manage on public.service_categories
for all using (public.is_tenant_staff(tenant_id))
with check (public.is_tenant_staff(tenant_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. HORODATAGE
-- ─────────────────────────────────────────────────────────────────────────────

-- ⚠️ Ne PAS poser de trigger `updated_at` sans vérifier que la colonne existe :
-- `masterclasses` portait un tel trigger sur une table SANS la colonne, ce qui
-- rendait toute modification impossible (« record "new" has no field ... »).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_service_categories_touch on public.service_categories;
create trigger trg_service_categories_touch
before update on public.service_categories
for each row execute function public.touch_updated_at();
