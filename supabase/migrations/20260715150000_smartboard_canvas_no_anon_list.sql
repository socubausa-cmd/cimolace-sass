-- CLUSTER C (partiel, sûr) — bloque l'ÉNUMÉRATION anonyme du bucket smartboard-canvas.
-- La policy SELECT était TO {public} (anon) → list()/metadata cross-tenant sans compte.
-- On la restreint à authenticated (propriétaire). Le RENDU des slides passe par getPublicUrl
-- (bucket public) et n'est PAS affecté. ⚠️ Fermeture TOTALE (pas de download anon d'une URL
-- connue) = passer le bucket en privé + migrer 7 lecteurs → passe dédiée testée (contenu non-premium).
drop policy if exists "smartboard_canvas_select_all" on storage.objects;
create policy "smartboard_canvas_select_authenticated"
  on storage.objects for select to authenticated
  using ( bucket_id = 'smartboard-canvas' );
