-- CLUSTER C — FERMETURE TOTALE du bucket `smartboard-canvas`.
--
-- Suite de 20260715150000 (qui ne bloquait que l'ÉNUMÉRATION anonyme). Ici on rend le
-- bucket PRIVÉ : les URLs `.../storage/v1/object/public/smartboard-canvas/...` renvoient
-- désormais 403 — plus aucun download anonyme, même avec une URL connue.
--
-- Côté front, on ne réutilise JAMAIS l'URL publique stockée (asset_url) : elle est re-signée
-- à la lecture depuis le storagePath via `createSignedUrl` (helper
-- apps/app/src/lib/smartboardCanvasUrl.js + composant components/media/SmartboardCanvasImage.jsx).
-- La policy SELECT réservée aux comptes `authenticated` (ci-dessous, idempotente) autorise
-- cette signature côté client. Contenu non-premium (images de tableau blanc).

update storage.buckets set public = false where id = 'smartboard-canvas';

-- Lecture réservée aux comptes authentifiés (nécessaire pour createSignedUrl). Idempotent :
-- on retombe sur la policy déjà posée par 20260715150000 si elle existe, sinon on la crée.
drop policy if exists "smartboard_canvas_select_all" on storage.objects;
drop policy if exists "smartboard_canvas_select_authenticated" on storage.objects;
create policy "smartboard_canvas_select_authenticated"
  on storage.objects for select to authenticated
  using ( bucket_id = 'smartboard-canvas' );
