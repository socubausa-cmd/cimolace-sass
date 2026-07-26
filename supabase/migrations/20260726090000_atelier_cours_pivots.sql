-- ═══════════════════════════════════════════════════════════════════════════
-- ATELIER DE COURS UNIFIÉ — LOT 1 : le socle
-- Spéc : docs/ATELIER_COURS_UNIFIE_SPEC.md
--
-- Principe : séparer le FOND de la FORME. Le coûteux (comprendre une source)
-- est extrait UNE fois dans un « pivot niveau 1 » ; les mises en forme (cours
-- écrit / cours joué) et les rendus (PDF, parcours, masterclass, précepteur)
-- en découlent SANS rappeler le modèle.
--
-- ⚠️ 100 % ADDITIF. Aucune colonne supprimée, aucun défaut modifié, aucune
-- contrainte durcie → les jobs EN VOL continuent de fonctionner à l'identique.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1) Les pivots ──────────────────────────────────────────────────────────
create table if not exists public.course_pivots (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,

  -- D'où vient le contenu. `source_id` est TEXTE (pas uuid) : les sources ne
  -- sont pas toutes des lignes Postgres (un id TikTok externe, un hash de
  -- document collé…). Aucune FK ici, volontairement : le pivot doit survivre
  -- à la disparition de sa source, sinon on perd un travail IA déjà payé.
  source_type text not null check (source_type in ('replay','tiktok','document','texte')),
  source_id   text not null,

  -- comprehension = niveau 1 (le FOND, invariant)
  -- ecrit / joue  = niveau 2 (la FORME), rattachés au niveau 1 par parent_id
  kind        text not null check (kind in ('comprehension','ecrit','joue')),
  parent_id   uuid references public.course_pivots(id) on delete cascade,

  payload     jsonb not null,
  model       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Un seul pivot par (source, forme, parent). `parent_id` étant NULL pour le
-- niveau 1, un index UNIQUE ordinaire ne suffirait pas (NULL ≠ NULL en SQL) :
-- il faut DEUX index partiels.
create unique index if not exists course_pivots_uniq_root
  on public.course_pivots (tenant_id, source_type, source_id, kind)
  where parent_id is null;

create unique index if not exists course_pivots_uniq_child
  on public.course_pivots (tenant_id, source_type, source_id, kind, parent_id)
  where parent_id is not null;

create index if not exists course_pivots_source_idx
  on public.course_pivots (tenant_id, source_type, source_id);
create index if not exists course_pivots_parent_idx
  on public.course_pivots (parent_id) where parent_id is not null;

-- RLS : même posture que `course_generation_jobs` — activée SANS politique,
-- donc accessible au seul `service_role` (l'API et le worker). Fail-closed :
-- aucun client ne lit directement les pivots, ils passent par l'API.
alter table public.course_pivots enable row level security;

comment on table public.course_pivots is
  'Atelier de cours unifié : représentation pivot. kind=comprehension (fond, extrait 1×) → kind=ecrit|joue (formes) via parent_id. Les rendus (PDF, parcours, masterclass, précepteur) lisent ces pivots sans rappeler le modèle.';

-- ─── 2) La file de travaux accueille toutes les sources ─────────────────────
-- Elle ne connaissait que les replays (`video_id` NOT NULL + FK vers
-- published_videos). Une source TikTok n'a pas de ligne là-bas.
alter table public.course_generation_jobs
  add column if not exists source_type text not null default 'replay',
  add column if not exists source_id   text,
  add column if not exists targets     text[] not null default '{parcours}',
  add column if not exists pivot_id    uuid references public.course_pivots(id) on delete set null;

-- `video_id` devient facultatif — la FK existante autorise déjà NULL, donc
-- rien à toucher de ce côté. Les lignes actuelles gardent leur valeur.
alter table public.course_generation_jobs alter column video_id drop not null;

-- Cohérence : un job replay DOIT porter un video_id ; les autres sources
-- portent un source_id. Contrainte NOT VALID → les lignes existantes ne sont
-- pas revalidées (elles sont conformes de toute façon), aucun verrou long.
alter table public.course_generation_jobs
  drop constraint if exists course_generation_jobs_source_coherence;
alter table public.course_generation_jobs
  add constraint course_generation_jobs_source_coherence check (
    (source_type = 'replay' and video_id is not null)
    or (source_type <> 'replay' and source_id is not null)
  ) not valid;

-- Rattrapage : les lignes déjà en base sont toutes des replays.
update public.course_generation_jobs
   set source_id = video_id::text
 where source_id is null and video_id is not null;

create index if not exists course_generation_jobs_source_idx
  on public.course_generation_jobs (tenant_id, source_type, source_id);

comment on column public.course_generation_jobs.targets is
  'Rendus demandés pour ce job : parcours | pdf | masterclass | precepteur | smartboard.';
