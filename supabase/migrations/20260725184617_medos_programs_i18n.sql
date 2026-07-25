-- MEDOS programmes — contenu multilingue (i18n) ADDITIF.
--
-- Objectif : servir un même programme dans la langue du pays du membre.
-- Approche non destructive : on AJOUTE des colonnes JSONB nullable
-- {"fr": "...", "en": "..."} ; les colonnes TEXT existantes (title,
-- description, content_md) restent la valeur par défaut / fallback (rétro-
-- compat + programmes mono-langue). Colonnes nullable → ajout instantané,
-- sans réécriture ni verrou de table. RLS inchangée (les policies couvrent
-- déjà les lignes ; aucune nouvelle policy requise).

ALTER TABLE med_programs
  ADD COLUMN IF NOT EXISTS title_i18n JSONB,
  ADD COLUMN IF NOT EXISTS description_i18n JSONB;

ALTER TABLE med_program_steps
  ADD COLUMN IF NOT EXISTS title_i18n JSONB,
  ADD COLUMN IF NOT EXISTS description_i18n JSONB,
  ADD COLUMN IF NOT EXISTS content_md_i18n JSONB;

COMMENT ON COLUMN med_programs.title_i18n IS 'Traductions du titre par locale, ex. {"fr":"…","en":"…"}. Fallback = colonne title.';
COMMENT ON COLUMN med_program_steps.content_md_i18n IS 'Traductions du contenu markdown par locale. Fallback = colonne content_md.';
