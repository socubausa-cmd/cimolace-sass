-- VNP — demandes de RDV publiques (Action Engine « réserver »). Un visiteur ANONYME choisit un
-- créneau souhaité + email → l'edge (service role) enregistre ici → le secrétariat confirme.
-- Distinct des tables RDV auth-gated (appointments/student_appointments qui exigent student_id+slot).
create table if not exists public.vnp_booking_requests (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  service      text not null default 'Consultation',
  name         text,
  email        text not null,
  preferred_at timestamptz,                 -- créneau souhaité par le visiteur
  message      text,
  status       text not null default 'requested'
               check (status in ('requested','confirmed','cancelled','completed')),
  source       text not null default 'vnp',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_vnp_booking_tenant on public.vnp_booking_requests(tenant_id);
create index if not exists idx_vnp_booking_status on public.vnp_booking_requests(status);

alter table public.vnp_booking_requests enable row level security;

-- Aucune policy anon → seul le service role (l'edge) écrit. Les membres actifs du tenant peuvent LIRE
-- (pour une future UI secrétariat), à l'image des autres tables tenant-scopées.
drop policy if exists vnp_booking_read_members on public.vnp_booking_requests;
create policy vnp_booking_read_members on public.vnp_booking_requests
  for select to authenticated
  using (exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = vnp_booking_requests.tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  ));
