-- ════════════════════════════════════════════════════════════════════════════
-- 20260727180000_tenant_glossary.sql
-- LE GLOSSAIRE DE NOMS PROPRES D'UNE ÉCOLE — la matière qui manquait à la
-- relecture des sous-titres.
--
-- ── POURQUOI CETTE TABLE EXISTE (mesuré, pas supposé) ───────────────────────
-- Les extraits courts affichent désormais la PAROLE en 110 px : le sous-titre
-- n'est plus un ornement, il EST le contenu du clip. Une faute sur un nom propre
-- y est donc lue par tout le monde. Sur le replay de référence, Whisper écrit
-- « Je suis Shao cinquième Manikongo piste Vita Kimba » là où l'orateur dit
-- « Je suis Cheo, cinquième Manikongo, fils de Kimpa Vita ».
--
-- On fait relire ces lignes par un modèle (apps/worker/src/jobs/short-sous-titres.js).
-- Ça marche — par intermittence. MESURÉ, deux tours à la suite sur le MÊME
-- corpus de 9 lignes : tour 1 → 3 lignes corrigées ; tour 2 → 1 seule, et pas
-- celle du clip phare. Zéro invention aux deux tours : les garde-fous serveur
-- tiennent, le modèle est seulement TROP TIMIDE. Il recopie au lieu de corriger.
--
-- Et une partie du problème n'est soluble par AUCUN modèle : « Cheo » est le nom
-- de l'orateur lui-même. Il n'est ni célèbre, ni déductible du contexte — rien
-- dans les sons « Shao » ne conduit à cette graphie-là. L'information existe
-- pourtant : elle est ÉCRITE SUR LA DIAPO PARTAGÉE de la séance
-- (« JE SUIS CHEO 5ieme manikongo… »). Elle n'était juste jamais donnée au
-- correcteur. Cette table la lui donne.
--
-- ── POURQUOI UNE TABLE, ET PAS `tenants.metadata` ──────────────────────────
-- Le glossaire N'EST PAS UN SECRET : ces noms sont prononcés à voix haute en
-- cours et imprimés sur les diapos. L'argument n'est donc pas la confidentialité,
-- il est en quatre points concrets :
--
--   1. CONCURRENCE D'ÉCRITURE. `tenants.metadata` est un JSONB modifié en
--      lecture-modification-écriture par d'autres services — notamment
--      `SocialOAuthService.saveConfig()` (apps/api/src/social-publisher/
--      social-oauth.service.ts), qui fait `metadata.social_apps[platform] = …`
--      puis `update`. Un owner qui ajoute un nom au glossaire pendant qu'un
--      autre connecte TikTok en perdrait un des deux, en silence. Une table
--      donne une ligne par terme : les deux écritures ne se croisent plus.
--   2. CONTRAINTES ET INDEX. Dans un blob, rien n'empêche d'entrer deux fois
--      « Kimpa Vita », rien n'ordonne, rien ne filtre les entrées désactivées.
--      Ici : unicité par (tenant, terme normalisé), index partiel sur les
--      entrées actives, lecture du worker en une requête indexée.
--   3. DROITS SÉPARÉS. `metadata` se lit et s'écrit d'un bloc ; on ne peut pas y
--      donner au glossaire des droits différents du reste. Une table porte ses
--      propres policies : lecture par les membres, écriture par owner/admin.
--   4. EXPOSITION. `GET /tenants/current` renvoie `metadata` à TOUT membre actif
--      du tenant, élève compris, à chaque chargement de page (c'est par là qu'un
--      Client Secret a fuité : le correctif `sanitizeTenantMetadata` retire
--      `social_apps`, et son propre commentaire conclut « sortir social_apps de
--      tenants.metadata reste à faire »). Y verser 300 noms les enverrait sur ce
--      chemin chaud sans raison. Le sens de la marche est de SORTIR de `metadata`.
--
-- ── CE QU'IL Y A DEDANS, ET CE QUE LE MOTEUR EN FAIT ───────────────────────
--   · `term`     : l'orthographe qui fait autorité. Elle part au modèle comme
--                  VOCABULAIRE, avec la consigne d'oser corriger ces noms-là.
--                  Elle sert AUSSI de preuve d'ancrage au garde-fou serveur —
--                  sans quoi le garde-fou refuserait la correction qu'il vient
--                  de demander (« Je suis Shao » → « Je suis Cheo » : 1 mot
--                  porteur ancré sur 2, sous le seuil de 0,60).
--   · `variants` : les graphies fautives DÉJÀ CONSTATÉES. Elles sont remplacées
--                  mot entier, SANS MODÈLE, avant tout appel : c'est la seule
--                  partie du dispositif qui soit reproductible par construction,
--                  et elle marche même sans clé IA.
--
-- ⚠️ LE MOTEUR NE CONNAÎT AUCUN DE CES NOMS. Cimolace est un SaaS multi-tenant :
-- « Cheo » appartient à UNE école. Le code worker est vide par défaut ; tout le
-- vocabulaire est ici, scellé par `tenant_id`.
--
-- À APPLIQUER (hors-bande, comme toutes les migrations Cimolace — jamais
-- `supabase db push`) :
--   psql "$DATABASE_URL" -f supabase/migrations/20260727180000_tenant_glossary.sql
-- Idempotent : ré-exécutable sans risque.
-- RÉVERSIBLE : `drop table public.tenant_glossary;`
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.tenant_glossary (
  id          uuid primary key default gen_random_uuid(),
  -- Scellé au tenant. Pas de ligne « globale » possible : un nom propre sans
  -- école est exactement le hard-coding que cette table sert à empêcher.
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  term        text not null,
  -- Graphies fautives constatées. Remplacées mot entier, sans modèle.
  -- ⚠️ Une variante peut être une LOCUTION (« Vita Kimba » → « Kimpa Vita ») :
  -- le moteur essaie les plus longues d'abord, sans quoi une variante d'un seul
  -- mot en consommerait la moitié.
  variants    text[] not null default '{}',
  -- Libre, mais utile : la catégorie part au modèle avec le terme et lève des
  -- ambiguïtés réelles (« Kongo » lieu ≠ « Kongo » peuple).
  category    text,
  -- Pour l'humain qui relira le glossaire dans six mois : « entendu Shao dans le
  -- replay du 12/03 ». Le moteur ne le lit pas.
  note        text,
  -- Désactiver plutôt que supprimer : une entrée qui a produit une mauvaise
  -- substitution doit pouvoir être coupée sans perdre la trace de son existence.
  active      boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.tenant_glossary is
  'Glossaire des noms propres d''une école : orthographe faisant autorité pour la '
  'relecture des sous-titres des extraits courts (apps/worker/src/jobs/short-sous-titres.js). '
  'PAS un secret (ces noms sont dits en cours et écrits sur les diapos) : la table est '
  'lisible par les membres du tenant. Le moteur worker ne contient AUCUN nom propre — '
  'tout le vocabulaire vit ici, scellé par tenant_id.';

comment on column public.tenant_glossary.term is
  'Orthographe EXACTE, celle qui sera affichée en 110 px. Sert deux fois : envoyée au '
  'modèle comme vocabulaire faisant autorité, et utilisée par le garde-fou serveur comme '
  'preuve d''ancrage (un mot du glossaire est ancré au même titre qu''un mot de la '
  'transcription d''origine — sinon le garde-fou annulerait la correction qu''on vient '
  'de demander).';

comment on column public.tenant_glossary.variants is
  'Graphies fautives DÉJÀ CONSTATÉES dans les transcriptions. Remplacées mot entier, '
  'insensible à la casse, AVANT tout appel de modèle : reproductible par construction, '
  'et opérant même sans clé IA. ⚠️ N''y mettre que du CONSTATÉ : une variante est un '
  'remplacement aveugle sur toute la transcription de l''école. Les variantes de moins '
  'de 4 caractères sont ignorées par le moteur (« sao », « chao » sont des syllabes, '
  'pas des noms).';

comment on column public.tenant_glossary.active is
  'false = l''entrée reste consultable mais ne part plus au moteur. C''est le bouton '
  'd''arrêt d''une substitution qui se serait révélée mauvaise.';

-- Unicité sur le terme NORMALISÉ : sans quoi « Kimpa Vita » et « kimpa vita »
-- coexisteraient et partiraient tous deux au modèle, qui ne saurait plus lequel
-- fait autorité.
create unique index if not exists uq_tenant_glossary_term
  on public.tenant_glossary (tenant_id, lower(btrim(term)));

-- Index PARTIEL : le worker ne lit QUE les entrées actives, et une école qui
-- désactive la moitié de son glossaire ne doit pas le faire payer à la lecture.
create index if not exists idx_tenant_glossary_actif
  on public.tenant_glossary (tenant_id, term)
  where active;

alter table public.tenant_glossary enable row level security;

-- LECTURE : tout membre du tenant. Ce sont les noms de son école, dits à voix
-- haute en cours ; les cacher à l'élève n'aurait aucun sens et empêcherait un
-- futur écran « ce nom est mal orthographié dans les sous-titres » côté classe.
drop policy if exists tenant_glossary_read_members on public.tenant_glossary;
create policy tenant_glossary_read_members on public.tenant_glossary
  for select to authenticated
  using (exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenant_glossary.tenant_id
      and m.user_id = auth.uid()
  ));

-- ÉCRITURE : owner/admin seulement. Une entrée de glossaire pilote un
-- remplacement automatique dans TOUS les sous-titres publiés de l'école — c'est
-- un acte éditorial, pas une contribution.
drop policy if exists tenant_glossary_write_admins on public.tenant_glossary;
create policy tenant_glossary_write_admins on public.tenant_glossary
  for all to authenticated
  using (exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenant_glossary.tenant_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenant_glossary.tenant_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  ));

-- `updated_at` : la fonction existe déjà (ad_creator_tables), on ne la
-- redéfinit pas — on s'y accroche si elle est là.
do $$
begin
  if to_regprocedure('public.touch_updated_at()') is not null then
    drop trigger if exists trg_tenant_glossary_touch on public.tenant_glossary;
    create trigger trg_tenant_glossary_touch before update on public.tenant_glossary
      for each row execute function public.touch_updated_at();
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- AMORCE — tenant « isna » (PRORASCIENCE) UNIQUEMENT
--
-- ⚠️ C'est le SEUL endroit de tout le dépôt où ces noms sont écrits, et c'est
-- voulu : ils appartiennent à cette école. Le `where exists` fait de ce bloc un
-- non-événement sur une base où le tenant n'existe pas (base neuve, autre
-- installation) — il n'échoue pas, il n'insère rien.
--
-- ⚠️ LES `variants` NE SONT QUE DU CONSTATÉ. « Shao » et « Vita Kimba » ont été
-- LUS dans la transcription Whisper du replay de référence. On n'en devine
-- aucun autre : une variante inventée serait un remplacement aveugle appliqué à
-- toutes les séances de l'école. Les graphies fautives non encore vues sont le
-- travail du modèle, à qui le `term` est donné comme vocabulaire faisant
-- autorité ; l'école ajoutera les variantes au fur et à mesure qu'elle les
-- constatera.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.tenant_glossary (tenant_id, term, variants, category, note)
select t.id, v.term, v.variants, v.category, v.note
from public.tenants t
cross join (values
  ('Cheo',
   array['Shao'],
   'personne',
   'Nom de l''orateur. Constaté « Shao » dans la transcription Whisper du replay de référence ; la graphie exacte est écrite sur sa diapo (« JE SUIS CHEO 5ieme manikongo »). Aucun modèle ne peut la deviner : c''est l''entrée qui justifie à elle seule cette table.'),
  ('Manikongo',
   array['Mandibo'],
   'titre',
   'Titre du souverain du royaume Kongo. « Mandibo » constaté cue 20 du replay 2df85889. MESURÉ : le modèle seul ne rétablit PAS celui-là (0 fois sur 4 tours) — les sons sont trop éloignés. C''est exactement le cas d''usage de la variante déclarée.'),
  ('Kimpa Vita',
   array['Vita Kimba'],
   'personne',
   'Prophétesse du royaume Kongo. Constaté « piste Vita Kimba » : les deux mots sont dans le désordre ET mal entendus, d''où la variante en locution. ⚠️ ARBITRAGE DE L''ÉCOLE À CONFIRMER : la diapo de la séance écrit « fils de vita kimpa » (ordre inverse) ; on retient ici la forme historique « Kimpa Vita ». Si l''école préfère l''autre ordre, c''est ce champ qu''elle change — pas le code.'),
  ('Simon Kimbangu',
   array['ciment qui margut'],
   'personne',
   'Prophète kongo. « ciment qui margut » constaté cue 25 du replay 2df85889 — c''est la ligne qui suit immédiatement le clip phare. MESURÉ : 0 rétablissement sur 4 tours par le modèle seul, même avec « Simon Kimbangu » au vocabulaire ; 4 sur 4 avec cette variante. Sans elle, l''extrait affiche « ciment qui margut » en 110 px.'),
  ('Kimbangu',
   array[]::text[],
   'personne',
   'Employé seul dans la séance ; entrée distincte de « Simon Kimbangu » pour ancrer le nom quand le prénom n''est pas prononcé.'),
  ('Kongo',
   array[]::text[],
   'peuple',
   'Le royaume et le peuple. ⚠️ à ne pas confondre avec les États actuels « Congo » : c''est précisément le genre d''arbitrage que le glossaire tranche.'),
  ('Prorascience',
   array[]::text[],
   'ecole',
   'Nom public de l''école (prorascience.org).'),
  ('ISNA',
   array[]::text[],
   'ecole',
   'Institut Supérieur de Nutrition Alimentaire — le sigle est prononcé, donc transcrit en sons.')
) as v(term, variants, category, note)
where t.slug = 'isna'
on conflict do nothing;

-- ── Vérification (à lancer après application) ───────────────────────────────
-- select t.slug, g.term, g.variants, g.category
--   from public.tenant_glossary g join public.tenants t on t.id = g.tenant_id
--  order by t.slug, g.term;
