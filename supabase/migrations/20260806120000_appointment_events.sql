-- Journal d'audit des rendez-vous : rend le système « voyant » (historique par RDV,
-- lien de report envoyé, client a reprogrammé, confirmé, annulé…). Écrit par l'API
-- (service-role) ; lecture staff via RLS (defense-in-depth, l'API bypass en service-role).
create extension if not exists pgcrypto;

create table if not exists public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind text not null check (kind in (
    'requested','confirmed','cancelled','reschedule_link_sent',
    'client_rescheduled','host_rescheduled','reminded','completed','no_show','note'
  )),
  actor_type text not null default 'system' check (actor_type in ('system','staff','client')),
  actor_id uuid,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists appointment_events_appt_idx
  on public.appointment_events (tenant_id, appointment_id, created_at desc);

alter table public.appointment_events enable row level security;

drop policy if exists appt_events_staff_read on public.appointment_events;
create policy appt_events_staff_read on public.appointment_events
  for select using (
    exists (select 1 from public.tenant_memberships m
            where m.tenant_id = appointment_events.tenant_id
              and m.user_id = auth.uid()
              and m.role in ('owner','admin','secretariat'))
    or exists (select 1 from public.profiles p
               where p.id = auth.uid()
                 and p.role in ('owner','admin','secretariat'))
  );
