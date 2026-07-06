-- Couche stats du VNP « vibe-surfing » (spec §6) : journal d'événements de la conversation.
-- Écriture UNIQUEMENT par l'edge `vnp-log` (service_role) — le VNP est pré-signup/anonyme, donc
-- AUCUN insert client direct. RLS activé SANS policy = seul le service_role (edge) écrit/lit
-- (dépouillement staff via SQL/outils service_role). Additif, non destructif.
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  tenant_slug text,
  user_session text,
  source text not null default 'vnp',
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_type_created_idx
  on public.analytics_events (type, created_at desc);
create index if not exists analytics_events_tenant_created_idx
  on public.analytics_events (tenant_slug, created_at desc);

alter table public.analytics_events enable row level security;

-- Types canoniques (doc §6) : node_opened, vnp_chat, action_triggered, contact_submitted,
-- tenant_created, unanswered_question, phase_transition, shortcut_click, edge_chat, edge_agent_brain.
