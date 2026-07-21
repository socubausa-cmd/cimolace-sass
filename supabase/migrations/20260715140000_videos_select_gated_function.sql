-- ════════════════════════════════════════════════════════════════════════════
-- 20260715140000_videos_select_gated_function.sql
-- CLUSTER A2 (Option 1) — Ferme le bypass INTRA-tenant de signature vidéo AU
-- NIVEAU RLS, sans migrer aucun lecteur front.
--
-- AVANT : videos_select_authenticated USING (bucket_id='videos') → tout membre
-- authentifié pouvait createSignedUrl N'IMPORTE QUELLE vidéo de cours de son
-- tenant en direct (devtools), sans forfait ni inscription → contournait le gate
-- serveur signCourseVideoUrl.
--
-- APRÈS : la policy appelle public.can_sign_course_video(name) qui REJOUE la
-- logique de l'API (chaîne contenu→cours→tenant + mode d'accès + forfait/
-- inscription). Un élève signe en direct UNIQUEMENT ce à quoi il a droit ;
-- l'API (service_role) reste l'autorité et bypasse la RLS de toute façon.
--
-- PORTÉE STRICTE : ne gate QUE les vidéos de COURS (référencées par
-- formation_day_contents.data->>'storagePath'). Tout autre objet du bucket
-- (clip forum, capture studio, source montage…) → renvoie true = comportement
-- INCHANGÉ (aucune régression sur ces surfaces).
--
-- À APPLIQUER : psql "$DATABASE_URL" -f <ce fichier>. Idempotent.
-- RÉVERSIBLE : recréer videos_select_authenticated USING (bucket_id='videos').
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.can_sign_course_video(object_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day_id uuid;
  v_course_id uuid;
  v_tenant_id uuid;
  v_meta jsonb;
  v_price int;
  v_access text;
begin
  -- Anonyme : jamais (les URLs signées exigent une auth de toute façon).
  if v_uid is null then
    return false;
  end if;

  -- Est-ce une vidéo de COURS (référencée par un contenu de jour) ?
  select fdc.day_id into v_day_id
  from public.formation_day_contents fdc
  where fdc.data->>'storagePath' = object_name
  limit 1;

  -- Pas une vidéo de cours (clip forum, capture, montage…) → INCHANGÉ.
  if v_day_id is null then
    return true;
  end if;

  -- Remonter contenu → jour → semaine → module → cours (+ tenant/meta/prix).
  select c.id, c.tenant_id, c.meta, c.price_cents
    into v_course_id, v_tenant_id, v_meta, v_price
  from public.formation_days fd
  join public.formation_weeks fw on fw.id = fd.week_id
  join public.modules m on m.id = fw.module_id
  join public.courses c on c.id = m.formation_id
  where fd.id = v_day_id
  limit 1;

  -- Chaîne cassée / contenu orphelin → INCHANGÉ (ne pas casser).
  if v_course_id is null then
    return true;
  end if;

  -- Staff du tenant propriétaire → toujours autorisé.
  if exists (
    select 1 from public.tenant_memberships tm
    where tm.user_id = v_uid and tm.tenant_id = v_tenant_id and tm.status = 'active'
      and tm.role in ('owner','admin','creator','teacher','secretariat')
  ) then
    return true;
  end if;

  -- Toute vidéo de cours exige au minimum une membership active du tenant.
  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.user_id = v_uid and tm.tenant_id = v_tenant_id and tm.status = 'active'
  ) then
    return false;
  end if;

  -- Mode d'accès (défaut : payant si prix > 0, sinon gratuit).
  v_access := coalesce(
    v_meta->>'access_mode',
    v_meta->'access'->>'mode',
    case when coalesce(v_price, 0) > 0 then 'one_time' else 'free' end
  );

  if v_access = 'free' then
    return true; -- membre du tenant + cours gratuit
  elsif v_access = 'subscription' then
    -- Forfait MEMBRE actif (coursReplay = tout cycle), non expiré.
    return exists (
      select 1 from public.billing_subscriptions bs
      where bs.user_id = v_uid and bs.tenant_id = v_tenant_id and bs.status = 'active'
        and (bs.current_period_end is null or bs.current_period_end >= now())
        and bs.plan_id ~ '^(autonome|academique|prive|privilegie)(-|$)'
    );
  elsif v_access = 'one_time' then
    -- Inscription au cours.
    return exists (
      select 1 from public.student_progress sp
      where sp.user_id = v_uid and sp.course_id = v_course_id
        and sp.status in ('active','approved','paid')
    );
  end if;

  return false;
end;
$$;

-- Index de perf : la fonction résout la vidéo de cours via data->>'storagePath'.
create index if not exists idx_fdc_storage_path
  on public.formation_day_contents ((data->>'storagePath'));

-- La policy (évaluée comme le rôle appelant) a besoin d'EXECUTE.
grant execute on function public.can_sign_course_video(text) to authenticated;

drop policy if exists "videos_select_authenticated" on storage.objects;
create policy "videos_select_authenticated"
  on storage.objects for select to authenticated
  using ( bucket_id = 'videos' and public.can_sign_course_video(name) );
