-- ════════════════════════════════════════════════════════════════════════════
-- Horodatage FIN des transcriptions — la finesse existait, on la jetait.
--
-- CONSTAT MESURÉ (replay « L'arbre du Manikongo — 11 avril 2026 ») :
--   57 cues pour 21 minutes, soit **20 secondes de granularité moyenne**.
--   Conséquence directe sur les extraits courts produits :
--     · 5 extraits sur 5 jugés non publiables — ouverture en plein milieu d'un
--       propos (« et l'onction de… », « et après on continue… »), fermeture
--       amputée (l'extrait phare coupe à 679 s une prise de parole qui court
--       jusqu'à 682 s : « C'est un » devient « C'est ») ;
--     · 5 cartons de sous-titre sur 48 (10 %) tenus PLUS DE 6 SECONDES, jusqu'à
--       11,8 s pour « Simon Kimbangu. C'est ». Le temps n'est pas mesuré : il est
--       réparti au prorata des caractères DANS la cue, si bien que tout le
--       reliquat d'une cue se dépose sur son dernier carton.
--
-- ⭐ LA CAUSE N'EST PAS CHEZ LE FOURNISSEUR, ELLE EST DANS NOTRE CODE.
--   · `zoom-transfer.js` → `fetchCues()` parse le VTT de Zoom en cues fines
--     (`parsed`, une par prise de parole), PUIS les agglomère en paragraphes de
--     200 caractères. Seul le `t` de la première survit ; tous les autres,
--     ainsi que toutes les fins, sont perdus.
--   · `zoom-transcribe.js` → `toCues()` fait exactement la même chose avec les
--     segments de Whisper, qui portent pourtant `start` ET `end`.
--
-- On garde donc les DEUX granularités, sans rien casser :
--   · `transcript_cues`     — inchangée. Paragraphes ~20 s. ~55 consommateurs
--                             (chapitrage, cours-depuis-replay, lecteur, RAG…)
--                             continuent de la lire sans modification.
--   · `transcript_segments` — NOUVELLE. La granularité d'origine, telle que la
--                             source l'a rendue : [{ t, e, text }] en secondes.
--                             `e` (fin) est le champ qui manquait le plus : sans
--                             lui on ne sait pas distinguer une pause d'un
--                             enchaînement, et on reconstruit une fin fictive en
--                             prenant le début de la cue suivante.
--
-- NULL est un état normal et attendu : toutes les lignes déjà ingérées l'ont
-- perdue pour de bon. Le consommateur DOIT retomber sur `transcript_cues` quand
-- `transcript_segments` est nulle — un moteur qui exigerait la finesse cesserait
-- de fonctionner sur l'intégralité de l'existant.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.zoom_recordings
  ADD COLUMN IF NOT EXISTS transcript_segments jsonb;

ALTER TABLE public.published_videos
  ADD COLUMN IF NOT EXISTS transcript_segments jsonb;

COMMENT ON COLUMN public.zoom_recordings.transcript_segments IS
  'Transcription à la granularité de la SOURCE : [{t,e,text}] en secondes (t=début, e=fin). '
  'Distincte de transcript_cues, qui agglomère en paragraphes de ~20 s pour la lecture. '
  'NULL = ingérée avant 2026-07-28, la finesse est perdue → retomber sur transcript_cues.';

COMMENT ON COLUMN public.published_videos.transcript_segments IS
  'Copie de zoom_recordings.transcript_segments (même contrat). NULL = finesse indisponible.';

-- PostgREST ne voit pas une colonne ajoutée hors migration tant qu'on ne le lui
-- dit pas. Les migrations Cimolace s'appliquent en psql direct (jamais `db push`),
-- donc ce NOTIFY fait partie de la migration, il n'est pas optionnel.
NOTIFY pgrst, 'reload schema';
