-- ════════════════════════════════════════════════════════════════════════════
-- 20260715130000_rls_scope_formation_chain_tenant.sql
-- CLUSTER A1 — Ferme la fuite CROSS-TENANT du catalogue pédagogique.
--
-- AVANT : modules / formation_weeks / formation_days / formation_day_contents
-- avaient tous `SELECT ... USING (TRUE)` → TOUT compte authentifié (même un
-- signup gratuit d'un autre tenant, sans inscription) lisait `data.storagePath`
-- de TOUS les cours de TOUS les tenants → moisson des chemins → signature vidéo.
--
-- APRÈS : lecture réservée aux MEMBRES ACTIFS du tenant PROPRIÉTAIRE du cours,
-- via la chaîne days→weeks→modules→courses.tenant_id (même chaîne que les
-- policies *_manage_staff déjà présentes, mais sans restreindre au rôle staff :
-- tout membre actif du tenant lit, staff inclus).
--
-- Le gate PALIER intra-tenant (forfait/inscription) reste assuré par l'API
-- signCourseVideoUrl (service_role) + la révocation de videos_select (cluster A2,
-- APRÈS migration des lecteurs front). Ici on ferme uniquement le cross-tenant.
--
-- Le contenu STANDALONE (formation_day_contents.day_id IS NULL — cartes
-- neuro_recall / versions post-prod) reste lisible par authentifié (surface
-- réduite, à durcir en V2). Les policies *_manage_staff (écriture) inchangées.
--
-- À APPLIQUER : psql "$DATABASE_URL" -f <ce fichier>. Idempotent.
-- RÉVERSIBLE : recréer les policies avec USING (TRUE) restaure l'état antérieur.
-- ════════════════════════════════════════════════════════════════════════════

-- modules : modules.formation_id → courses.tenant_id
drop policy if exists modules_select_authenticated on public.modules;
create policy modules_select_authenticated on public.modules
  for select to authenticated
  using (
    exists (
      select 1
      from public.tenant_memberships tm
      join public.courses c on c.id = public.modules.formation_id
      where tm.user_id = auth.uid()
        and tm.tenant_id = c.tenant_id
        and tm.status = 'active'
    )
  );

-- formation_weeks : week.module_id → modules.formation_id → courses.tenant_id
drop policy if exists formation_weeks_select_authenticated on public.formation_weeks;
create policy formation_weeks_select_authenticated on public.formation_weeks
  for select to authenticated
  using (
    exists (
      select 1
      from public.tenant_memberships tm
      join public.modules m on m.id = public.formation_weeks.module_id
      join public.courses c on c.id = m.formation_id
      where tm.user_id = auth.uid()
        and tm.tenant_id = c.tenant_id
        and tm.status = 'active'
    )
  );

-- formation_days : day.week_id → weeks → modules → courses.tenant_id
drop policy if exists formation_days_select_authenticated on public.formation_days;
create policy formation_days_select_authenticated on public.formation_days
  for select to authenticated
  using (
    exists (
      select 1
      from public.tenant_memberships tm
      join public.formation_weeks fw on fw.id = public.formation_days.week_id
      join public.modules m on m.id = fw.module_id
      join public.courses c on c.id = m.formation_id
      where tm.user_id = auth.uid()
        and tm.tenant_id = c.tenant_id
        and tm.status = 'active'
    )
  );

-- formation_day_contents : content.day_id → days → weeks → modules → courses.tenant_id
--   (+ standalone day_id IS NULL : inchangé pour ne rien casser, durci en V2)
drop policy if exists formation_day_contents_select_authenticated on public.formation_day_contents;
create policy formation_day_contents_select_authenticated on public.formation_day_contents
  for select to authenticated
  using (
    public.formation_day_contents.day_id is null
    or exists (
      select 1
      from public.tenant_memberships tm
      join public.formation_days fd on fd.id = public.formation_day_contents.day_id
      join public.formation_weeks fw on fw.id = fd.week_id
      join public.modules m on m.id = fw.module_id
      join public.courses c on c.id = m.formation_id
      where tm.user_id = auth.uid()
        and tm.tenant_id = c.tenant_id
        and tm.status = 'active'
    )
  );
