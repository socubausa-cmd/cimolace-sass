-- Registre canonique des sources déposées dans Master Factory.
-- Les replays, TikTok et LIVE gardent leurs tables métiers historiques ; les
-- documents/texte/audio/vidéo importés convergent ici après extraction.

create table if not exists public.master_factory_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  source_type text not null check (source_type in ('document','texte','pdf','audio','video','url')),
  title text not null,
  content_text text not null,
  source_url text,
  mime_type text,
  duration_sec integer,
  content_hash text not null,
  status text not null default 'ready' check (status in ('extracting','ready','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint master_factory_sources_content_length check (char_length(content_text) <= 1000000)
);

create unique index if not exists master_factory_sources_tenant_hash_uidx
  on public.master_factory_sources (tenant_id, source_type, content_hash);
create index if not exists master_factory_sources_tenant_created_idx
  on public.master_factory_sources (tenant_id, created_at desc);

alter table public.master_factory_sources enable row level security;

comment on table public.master_factory_sources is
  'Sources persistées de Master Factory après extraction. Cloisonnées par tenant ; consommées par l API et le worker via service_role.';
