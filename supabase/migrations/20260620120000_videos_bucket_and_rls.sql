-- ════════════════════════════════════════════════════════════════════════════
-- 20260620120000_videos_bucket_and_rls.sql
-- Bucket Storage `videos` (vidéos de cours) + RLS.
--
-- POURQUOI : le bucket `videos` n'existe pas en prod → aucune vidéo de cours
-- uploadable/jouable, et le panneau mindmap élève reste verrouillé (gated
-- derrière la lecture d'une vidéo *uploadée*). Le constructeur uploade vers
-- `uploads/{ts}-{nom}` (VideoUploadModal, avec le JWT de l'utilisateur) ; le
-- lecteur lit via createSignedUrl (VideoPlayer) → bucket PRIVÉ + URL signées.
--
-- À APPLIQUER (l'un OU l'autre) :
--   psql "$DATABASE_URL" -f supabase/migrations/20260620120000_videos_bucket_and_rls.sql
--   — ou — copier-coller dans le SQL Editor du dashboard Supabase (projet cimolace).
-- Idempotent : ré-exécutable sans risque.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Bucket privé (5 Go, types vidéo) ────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos', 'videos', false, 5368709120,  -- 5 Go
  array['video/mp4','video/webm','video/quicktime','video/ogg','video/x-matroska','video/x-msvideo']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) RLS storage.objects pour le bucket `videos` ─────────────────────────────
--    Lecture  : tout utilisateur authentifié (pour générer l'URL signée et
--               visionner). Défense en profondeur : il lui faut le storagePath,
--               qui provient de formation_day_contents (déjà protégé par les RLS
--               du cours) — un élève ne « devine » pas le chemin d'une vidéo.
--    Écriture : staff du tenant (owner/admin/creator/teacher), aligné sur la
--               policy public.formation_day_contents_manage_staff. L'upload
--               envoie le JWT du formateur → auth.uid() = ce formateur.

drop policy if exists "videos_select_authenticated" on storage.objects;
create policy "videos_select_authenticated"
  on storage.objects for select to authenticated
  using ( bucket_id = 'videos' );

drop policy if exists "videos_insert_staff" on storage.objects;
create policy "videos_insert_staff"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'videos'
    and exists (
      select 1 from public.tenant_memberships tm
      where tm.user_id = auth.uid()
        and tm.status  = 'active'
        and tm.role in ('owner','admin','creator','teacher')
    )
  );

drop policy if exists "videos_update_staff" on storage.objects;
create policy "videos_update_staff"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'videos'
    and exists (
      select 1 from public.tenant_memberships tm
      where tm.user_id = auth.uid() and tm.status = 'active'
        and tm.role in ('owner','admin','creator','teacher')
    )
  )
  with check (
    bucket_id = 'videos'
    and exists (
      select 1 from public.tenant_memberships tm
      where tm.user_id = auth.uid() and tm.status = 'active'
        and tm.role in ('owner','admin','creator','teacher')
    )
  );

drop policy if exists "videos_delete_staff" on storage.objects;
create policy "videos_delete_staff"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'videos'
    and exists (
      select 1 from public.tenant_memberships tm
      where tm.user_id = auth.uid() and tm.status = 'active'
        and tm.role in ('owner','admin','creator','teacher')
    )
  );

-- 3) Vérification (optionnel) ────────────────────────────────────────────────
-- select id, public, file_size_limit from storage.buckets where id = 'videos';
-- select policyname, cmd from pg_policies
--   where schemaname='storage' and tablename='objects' and policyname like 'videos\_%';
