-- Master Factory — brief de pédagogie visuelle mis en cache.
-- Additif : aucune donnée ni colonne existante n'est modifiée.

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
      'replay_postprod',
      'visual_pedagogy'
    )
  );

comment on table public.course_pivots is
  'Master Factory : fond comprehension ; formes ecrit/joue ; conducteurs et enrichissements master_script/smartboard_timeline/live_scenario/replay_postprod/visual_pedagogy.';
