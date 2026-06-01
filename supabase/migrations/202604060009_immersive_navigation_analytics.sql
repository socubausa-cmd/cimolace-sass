-- Immersive Navigation Engine analytics

create table if not exists public.immersive_navigation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  session_id text,
  event_type text not null check (event_type in ('exposure', 'click', 'close')),
  top_action_id text,
  action_id text,
  action_score int,
  intent text,
  scene_id text,
  current_path text,
  recent_paths text[] not null default '{}'::text[],
  runtime_context jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_immersive_navigation_events_created on public.immersive_navigation_events(created_at desc);
create index if not exists idx_immersive_navigation_events_user on public.immersive_navigation_events(user_id, created_at desc);
create index if not exists idx_immersive_navigation_events_type on public.immersive_navigation_events(event_type, created_at desc);
