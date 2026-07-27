-- ════════════════════════════════════════════════════════════════════════════
-- 20260726160000_ad_creator_tables.sql
-- Les deux tables du Créateur de publicités — elles n'ont JAMAIS existé.
--
-- CONSTAT (2026-07-26, test de bout en bout sur prod) : la génération IA du
-- créateur fonctionne parfaitement (POST /ai-utils/ad-copy/generate → 201 en
-- 2,7 s, accroche + titre + description + CTA + hashtags + 2 variantes), mais
-- AUCUN des trois boutons de sortie ne pouvait aboutir :
--   · « Sauvegarder brouillon » / « Marquer comme prête » / « Publier »
--     → StudioAdCreatorPage.saveCreative() insère dans `ad_creatives` ;
--   · l'onglet « Mes pubs » → fetchHistory() lit `ad_creatives` ;
--   · l'onglet « Canaux » → fetchChannels()/saveChannelIntegration() lisent et
--     écrivent `channel_integrations`.
-- Les deux relations étaient absentes de la base ET d'`supabase/migrations`.
-- On pouvait donc rédiger une excellente publicité et la perdre intégralement.
--
-- À APPLIQUER (hors-bande, comme toutes les migrations Cimolace) :
--   psql "$DATABASE_URL" -f supabase/migrations/20260726160000_ad_creator_tables.sql
-- Idempotent : ré-exécutable sans risque.
-- RÉVERSIBLE : `drop table public.channel_integrations, public.ad_creatives;`
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Les publicités créées ───────────────────────────────────────────────────
create table if not exists public.ad_creatives (
  id                  uuid primary key default gen_random_uuid(),
  created_by          uuid not null references auth.users(id) on delete cascade,
  -- Espace propriétaire. Le front ne le renseigne pas encore (les publicités
  -- sont personnelles, cf. la policy ci-dessous qui cloisonne sur created_by) ;
  -- la colonne existe pour pouvoir passer plus tard à un partage d'équipe sans
  -- migration de données.
  tenant_id           uuid references public.tenants(id) on delete set null,
  title               text not null default 'Publicité sans titre',
  status              text not null default 'draft'
                      check (status in ('draft', 'ready', 'published')),
  platform            text,
  format              text,
  objective           text,
  source_type         text,
  source_id           uuid,
  source_title        text,
  clip_start_seconds  numeric,
  clip_end_seconds    numeric,
  headline            text,
  description         text,
  cta                 text,
  hashtags            text[] not null default '{}',
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.ad_creatives is
  'Publicités du Créateur de publicités (studio). Cloisonnées par created_by : '
  'ce sont des créations personnelles, pas un catalogue partagé.';

create index if not exists idx_ad_creatives_created_by
  on public.ad_creatives (created_by, created_at desc);
create index if not exists idx_ad_creatives_tenant
  on public.ad_creatives (tenant_id);

alter table public.ad_creatives enable row level security;

-- Une seule policy « tout ou rien sur ses propres lignes » : c'est exactement
-- ce que fait l'écran (select .eq('created_by', user.id), insert avec
-- created_by = user.id). En écrire quatre séparées donnerait l'illusion d'un
-- contrôle plus fin sans rien ajouter.
drop policy if exists ad_creatives_owner_all on public.ad_creatives;
create policy ad_creatives_owner_all on public.ad_creatives
  for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- 2) Les canaux de diffusion connectés ───────────────────────────────────────
-- ⚠️ `config` peut contenir des JETONS d'API de réseaux sociaux : la cloison
-- doit rester STRICTEMENT propriétaire, jamais élargie à l'équipe sans chiffrer
-- ces valeurs au préalable.
create table if not exists public.channel_integrations (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  platform        text not null,
  status          text not null default 'connected'
                  check (status in ('connected', 'disconnected', 'error')),
  config          jsonb not null default '{}'::jsonb,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Indispensable : saveChannelIntegration fait un upsert
  -- `onConflict: 'owner_id,platform'`. Sans cette contrainte, l'upsert échoue.
  unique (owner_id, platform)
);

comment on table public.channel_integrations is
  'Canaux de diffusion connectés (Facebook, TikTok…) du Créateur de publicités. '
  '`config` peut porter des jetons : cloison propriétaire stricte.';

create index if not exists idx_channel_integrations_owner
  on public.channel_integrations (owner_id);

alter table public.channel_integrations enable row level security;

drop policy if exists channel_integrations_owner_all on public.channel_integrations;
create policy channel_integrations_owner_all on public.channel_integrations
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 3) `updated_at` tenu à jour ────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_ad_creatives_touch on public.ad_creatives;
create trigger trg_ad_creatives_touch before update on public.ad_creatives
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_channel_integrations_touch on public.channel_integrations;
create trigger trg_channel_integrations_touch before update on public.channel_integrations
  for each row execute function public.touch_updated_at();

-- 4) Vérification (optionnel) ────────────────────────────────────────────────
-- select to_regclass('public.ad_creatives'), to_regclass('public.channel_integrations');
