-- ═══════════════════════════════════════════════════════════════════════════
-- MASTER FACTORY — extension des pivots vers Liri Live / SmartBoard / Replay.
-- Date : 2026-07-28
--
-- Additif : élargit les CHECK constraints existantes de `course_pivots`.
-- Aucune donnée supprimée, aucun schéma élève modifié.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.course_pivots
  drop constraint if exists course_pivots_source_type_check;

alter table public.course_pivots
  add constraint course_pivots_source_type_check check (
    source_type in (
      'replay',
      'live',
      'tiktok',
      'document',
      'texte',
      'pdf',
      'audio',
      'video',
      'url'
    )
  );

alter table public.course_pivots
  drop constraint if exists course_pivots_kind_check;

alter table public.course_pivots
  add constraint course_pivots_kind_check check (
    kind in (
      'comprehension',
      'ecrit',
      'joue',
      'master_script',
      'smartboard_timeline',
      'live_scenario',
      'replay_postprod'
    )
  );

comment on table public.course_pivots is
  'Master Factory : pivots de connaissance. Niveau 1 comprehension ; formes ecrit/joue/master_script/smartboard_timeline/live_scenario/replay_postprod ; rendus sans régénérer le fond.';

comment on column public.course_generation_jobs.targets is
  'Rendus demandés : parcours | pdf | masterclass | precepteur | smartboard | live | master_script | video_semaine | quiz | forum | faq | manuel.';
