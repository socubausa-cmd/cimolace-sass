-- `masterclasses` : toute modification échouait depuis toujours.
--
-- Le trigger `set_updated_at_masterclasses` appelle `update_updated_at_column()`,
-- qui affecte `NEW.updated_at` — mais la table n'a PAS cette colonne. Chaque UPDATE
-- part donc en erreur :
--     ERROR: record "new" has no field "updated_at"
-- C'est-à-dire qu'aucune masterclass ne peut être éditée, ni depuis l'application,
-- ni par script. Découvert en réattribuant du contenu (2026-08-06).
--
-- On AJOUTE la colonne que le trigger attend plutôt que de retirer le trigger :
-- c'est la convention suivie par le reste du schéma, et ça rend l'horodatage
-- opérationnel au lieu de simplement faire taire l'erreur.
--
-- ⚠️ Appliquée HORS-BANDE via psql (jamais `supabase db push` sur ce projet).

alter table public.masterclasses
  add column if not exists updated_at timestamptz not null default now();

-- Les lignes existantes prennent leur date de création comme point de départ,
-- pour ne pas faire croire qu'elles ont toutes été modifiées aujourd'hui.
update public.masterclasses
   set updated_at = created_at
 where created_at is not null;
