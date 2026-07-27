-- ─────────────────────────────────────────────────────────────────────────────
-- EXTRAITS COURTS DE LA VIDÉOTHÈQUE — colonnes d'idempotence sur zoom_recordings
--
-- POURQUOI CE FICHIER
-- Le générateur d'extraits (apps/worker/src/jobs/short-generator.js) sait traiter
-- deux sources : les directs LiveKit (`live_recordings`) et les replays de la
-- Vidéothèque (`zoom_recordings`). Le premier chemin est idempotent depuis
-- toujours grâce à `live_recordings.shorts_status` ; le second n'avait AUCUNE
-- marque de traitement — il sélectionnait `status='downloaded'` et ne notait rien.
-- Branché tel quel, il aurait repris les mêmes replays à chaque cycle, en
-- retéléchargeant des fichiers de plusieurs Go et en refacturant la transcription
-- indéfiniment. Ces colonnes donnent au chemin Vidéothèque le même contrat que son
-- jumeau, en un peu plus strict (compteur d'essais, motif d'échec, reprise des
-- travaux orphelins).
--
-- POURQUOI UNE COLONNE À PART, ET PAS `status`
-- `zoom_recordings.status` est la machine à états du TRANSFERT et de la
-- PUBLICATION (pending → downloading → downloaded → published), lue par l'API
-- (zoom-engine.service.ts) et par le transfert Zoom→R2. L'ancien générateur y
-- écrivait 'analyzed' en cas de succès et 'error' en cas d'échec, en écrasant au
-- passage `error_message` : un replay parfaitement importé pouvait ainsi sortir de
-- 'downloaded' et changer d'état affiché à cause d'un incident de découpage. Les
-- extraits ont désormais leurs propres colonnes ; les deux cycles de vie ne se
-- marchent plus dessus.
--
-- CONTRAT (le worker et l'API partagent EXACTEMENT ces valeurs)
--   NULL         → jamais demandé. Le poller ne le prend pas. C'est la garde de
--                  dépense : les 61 replays déjà en base ne partent pas tout seuls.
--   'requested'  → demandé explicitement par le créateur ('queued' = synonyme admis).
--   'processing' → pris par un worker (posé avant le travail).
--   'done'       → terminé, extraits visibles dans `short_clips`.
--   'error'      → échoué ; motif dans `shorts_error`, essais dans `shorts_attempts`.
--
-- ⚠️ Ce dépôt applique ses migrations par psql HORS-BANDE (jamais `supabase db
-- push`). Fichier idempotent : le rejouer ne fait rien. Réversible : le bloc de
-- retour arrière est donné en commentaire à la fin.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.zoom_recordings
  ADD COLUMN IF NOT EXISTS shorts_status       TEXT,
  ADD COLUMN IF NOT EXISTS shorts_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shorts_started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shorts_attempts     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shorts_error        TEXT;

COMMENT ON COLUMN public.zoom_recordings.shorts_status IS
  'Cycle de vie des EXTRAITS COURTS de ce replay, indépendant de `status` (qui, lui, '
  'suit le transfert et la publication). NULL = jamais demandé, et le poller '
  'pollShortGeneration ne prend QUE les demandes explicites : '
  'NULL → requested (clic du créateur) → processing → done | error.';

COMMENT ON COLUMN public.zoom_recordings.shorts_requested_at IS
  'Horodatage de la demande du créateur. Sert à servir la file dans l''ordre d''arrivée '
  'et à afficher « demandé il y a X » sans le deviner.';

COMMENT ON COLUMN public.zoom_recordings.shorts_started_at IS
  'Horodatage de la prise en charge par un worker. Au-delà de 2 h en ''processing'', le '
  'poller considère le travail orphelin (conteneur redéployé en plein découpage) et le '
  'remet en file — sans quoi la ligne resterait verrouillée à vie.';

COMMENT ON COLUMN public.zoom_recordings.shorts_attempts IS
  'Nombre de prises en charge cumulées. Au-delà de 3, le poller renonce EN L''ÉCRIVANT '
  '(statut ''error'' + motif) plutôt que de retenter en silence. Une nouvelle demande '
  'du créateur remet ce compteur à zéro.';

COMMENT ON COLUMN public.zoom_recordings.shorts_error IS
  'Motif lisible du dernier échec de génération d''extraits. Volontairement distinct de '
  '`error_message`, réservé aux incidents de transfert Zoom → R2 : une panne de '
  'découpage ne doit pas maquiller l''état d''un replay correctement importé.';

-- File d'attente : index PARTIEL — il n'indexe que les lignes réellement en jeu
-- (quelques-unes), pas les 61 replays au repos dont `shorts_status` est NULL.
CREATE INDEX IF NOT EXISTS idx_zoom_recordings_shorts_queue
  ON public.zoom_recordings (shorts_status, shorts_requested_at)
  WHERE shorts_status IS NOT NULL;

-- ── Jumeau LiveKit : on DÉCLARE la colonne existante ─────────────────────────
-- `live_recordings.shorts_status` avait été ajoutée hors-bande en production et
-- aucune migration ne la portait : sur une base neuve, le chemin LiveKit échouait
-- en 42703 / PGRST204. On la déclare ici pour que les deux jumeaux soient décrits
-- au même endroit. Sur la prod, où elle existe déjà, cette ligne ne fait rien.
ALTER TABLE public.live_recordings
  ADD COLUMN IF NOT EXISTS shorts_status TEXT;

COMMENT ON COLUMN public.live_recordings.shorts_status IS
  'Cycle de vie des extraits courts d''un replay LiveKit : NULL = à traiter '
  '(le poller pollLiveReplayShorts prend automatiquement les directs terminés), '
  'processing → done | error. ⚠️ Sémantique du NULL INVERSE de celle de '
  'zoom_recordings : un direct est court et vient d''être produit, alors qu''un replay '
  'de la Vidéothèque dure des heures et n''est découpé que sur demande.';

-- ── Retour arrière (à jouer à la main si besoin) ─────────────────────────────
-- ALTER TABLE public.zoom_recordings
--   DROP COLUMN IF EXISTS shorts_status,
--   DROP COLUMN IF EXISTS shorts_requested_at,
--   DROP COLUMN IF EXISTS shorts_started_at,
--   DROP COLUMN IF EXISTS shorts_attempts,
--   DROP COLUMN IF EXISTS shorts_error;
-- DROP INDEX IF EXISTS public.idx_zoom_recordings_shorts_queue;
-- (on NE supprime PAS live_recordings.shorts_status : elle préexiste à ce fichier
--  et le chemin LiveKit s'en sert en production.)
