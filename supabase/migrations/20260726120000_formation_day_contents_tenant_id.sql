-- ════════════════════════════════════════════════════════════════════════════
-- 20260726120000_formation_day_contents_tenant_id.sql
-- Matérialise la PROPRIÉTÉ d'un contenu de formation (colonne tenant_id).
--
-- POURQUOI : `formation_day_contents` n'avait aucune colonne de propriété. L'API
-- (client service_role, RLS contournée) devait DÉDUIRE le tenant :
--   - contenu rattaché à une journée → chaîne days → weeks → modules → courses.tenant_id ;
--   - contenu STANDALONE (day_id IS NULL) → rien. La déduction retombait sur les traces
--     laissées par l'appelant lui-même (course_postprod_versions / course_render_jobs),
--     et à défaut sur « propriétaire inconnu → on laisse passer ».
-- Ce fail-soft était exploitable : un tenant B pouvait faire rendre le contenu standalone
-- d'un tenant A (encore lisible par tout authentifié, cf. 20260715130000) puis télécharger
-- le MP4 présigné par render-status, le job portant SON propre tenant_id.
-- Le code (CourseBuilderService.resolveContentTenantId) refuse désormais quand la
-- propriété est indéterminée ; cette colonne est là pour qu'elle ne le soit jamais.
--
-- À APPLIQUER (hors-bande, comme toutes les migrations Cimolace) :
--   psql "$DATABASE_URL" -f supabase/migrations/20260726120000_formation_day_contents_tenant_id.sql
-- Idempotent : ré-exécutable sans risque.
-- RÉVERSIBLE : `alter table public.formation_day_contents drop column tenant_id;`
--              + recréer la policy SELECT dans sa forme 20260715130000.
--
-- ⚠️ ORDRE DE DÉPLOIEMENT : l'API tolère l'absence de la colonne (repli sur l'ancien
-- SELECT), donc le code peut partir avant la migration. En revanche, tant que le backfill
-- n'a pas tourné, un contenu STANDALONE jamais snapshotté ni rendu se verra refuser le
-- rendu — c'est le comportement fail-closed voulu.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Colonne de propriété ────────────────────────────────────────────────────
alter table public.formation_day_contents
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null;

comment on column public.formation_day_contents.tenant_id is
  'Espace PROPRIÉTAIRE du contenu. Source de vérité de la cloison tenant en post-production '
  '(course-builder render-enqueue / render-playback). NULL = héritage non backfillé : la '
  'propriété est alors déduite de la chaîne day_id, puis des traces tenant-scopées.';

create index if not exists idx_formation_day_contents_tenant_id
  on public.formation_day_contents (tenant_id);

-- 2) Backfill A — contenus rattachés à une journée : la chaîne fait foi ──────
update public.formation_day_contents fdc
   set tenant_id = c.tenant_id
  from public.formation_days  fd
  join public.formation_weeks fw on fw.id = fd.week_id
  join public.modules         m  on m.id  = fw.module_id
  join public.courses         c  on c.id  = m.formation_id
 where fdc.day_id = fd.id
   and fdc.tenant_id is null
   and c.tenant_id is not null;

-- 3) Backfill B — contenus STANDALONE : la PREMIÈRE trace tenant-scopée fait foi.
--    Premier arrivé = propriétaire (une trace postérieure ne déposséde personne).
--    `content_id` est de type TEXT dans ces deux tables → cast explicite.
with premiere_trace as (
  select content_id, tenant_id, created_at,
         row_number() over (partition by content_id order by created_at asc) as rang
    from (
      select content_id, tenant_id, created_at from public.course_postprod_versions
      union all
      select content_id, tenant_id, created_at from public.course_render_jobs
    ) traces
   where tenant_id is not null
)
update public.formation_day_contents fdc
   set tenant_id = t.tenant_id
  from premiere_trace t
 where t.rang = 1
   and t.content_id = fdc.id::text
   and fdc.tenant_id is null;

-- 4) RLS SELECT — on referme le contenu STANDALONE sur son espace ────────────
--    AVANT : `day_id is null` = lisible par TOUT authentifié (annuaire d'ids
--    exploitable pour cibler le contenu d'un autre tenant, cf. plus haut).
--    APRÈS : lisible par les membres actifs du tenant propriétaire dès qu'il est connu.
--    RÉSIDUEL ASSUMÉ : les lignes standalone dont le backfill n'a rien pu déduire
--    (tenant_id NULL) restent lisibles — les refermer casserait des lectures
--    légitimes (cartes neuro_recall historiques). À reprendre quand la colonne
--    sera renseignée à 100 % (`select count(*) … where day_id is null and tenant_id is null`).
drop policy if exists formation_day_contents_select_authenticated on public.formation_day_contents;
create policy formation_day_contents_select_authenticated on public.formation_day_contents
  for select to authenticated
  using (
    -- contenu rattaché à une journée : membre actif du tenant porteur du cours
    exists (
      select 1
      from public.tenant_memberships tm
      join public.formation_days  fd on fd.id = public.formation_day_contents.day_id
      join public.formation_weeks fw on fw.id = fd.week_id
      join public.modules         m  on m.id  = fw.module_id
      join public.courses         c  on c.id  = m.formation_id
      where tm.user_id   = auth.uid()
        and tm.tenant_id = c.tenant_id
        and tm.status    = 'active'
    )
    -- contenu standalone dont le propriétaire est connu : membre actif de CE tenant
    or (
      public.formation_day_contents.day_id is null
      and public.formation_day_contents.tenant_id is not null
      and exists (
        select 1
        from public.tenant_memberships tm
        where tm.user_id   = auth.uid()
          and tm.tenant_id = public.formation_day_contents.tenant_id
          and tm.status    = 'active'
      )
    )
    -- résiduel : standalone non backfillé (voir commentaire ci-dessus)
    or (
      public.formation_day_contents.day_id is null
      and public.formation_day_contents.tenant_id is null
    )
  );

-- 5) Réparation du miroir `data.renderedUrl` ────────────────────────────────
--    Le worker écrivait la CLÉ R2 dans `data.renderedUrl`. Or CoursePlayerInterface
--    teste ce champ comme un DRAPEAU « ce contenu porte déjà une URL jouable » et
--    cesse alors d'injecter l'URL signée de la vidéo SOURCE : un contenu rendu perdait
--    À LA FOIS son montage (clé non jouable) et son original. Le worker ne l'écrit plus
--    et le nettoie au prochain rendu ; cette requête répare les contenus déjà rendus
--    sans attendre un nouveau rendu. On ne touche QUE les valeurs non absolues (les URLs
--    http/blob/data éventuelles restent des liens légitimes).
update public.formation_day_contents
   set data = data - 'renderedUrl'
 where data ? 'renderedUrl'
   and coalesce(data->>'renderedUrl', '') !~* '^(https?://|blob:|data:)';

-- 6) Vérifications (optionnel) ───────────────────────────────────────────────
-- select count(*) filter (where tenant_id is null) as sans_proprietaire,
--        count(*) filter (where day_id is null and tenant_id is null) as standalone_orphelins,
--        count(*) as total
--   from public.formation_day_contents;
