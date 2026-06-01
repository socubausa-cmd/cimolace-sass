-- Live recordings: Supabase Storage bucket + RLS policies
-- Bucket path convention expected by frontend:
--   live-recordings/<auth.uid()>/<timestamp>-<recipient>.webm

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'live-recordings',
  'live-recordings',
  false,
  5368709120,
  array['video/webm', 'video/mp4']
where not exists (
  select 1 from storage.buckets where id = 'live-recordings'
);

drop policy if exists "live_recordings_insert_own" on storage.objects;
drop policy if exists "live_recordings_select_own" on storage.objects;
drop policy if exists "live_recordings_update_own" on storage.objects;
drop policy if exists "live_recordings_delete_own" on storage.objects;

create policy "live_recordings_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'live-recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "live_recordings_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'live-recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "live_recordings_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'live-recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'live-recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "live_recordings_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'live-recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
);
