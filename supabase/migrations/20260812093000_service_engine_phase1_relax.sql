-- LIRI Service Engine — PHASE 1 (suite) : rendre `services` réellement créable.
--
-- Constaté en tentant la première insertion : la table impose encore la forme
-- de son usage d'origine (catalogue bilingue figé de Prorascience). Sont NOT
-- NULL et sans défaut : nameEn, descriptionFr, descriptionEn, featuresFr,
-- featuresEn, durationDays, updatedAt — et `id` (text) n'a aucun défaut.
--
-- Conséquence concrète : un tenant ne peut pas créer « Coiffure femme » sans
-- écrire une description ANGLAISE et une durée EN JOURS pour une prestation
-- d'une heure. Le §27 demande une création sans développeur ; en l'état c'est
-- impossible. On assouplit donc, sans rien perdre : les 2 lignes existantes
-- gardent leurs valeurs.
--
-- ⚠️ Appliquée HORS-BANDE via psql (jamais `supabase db push` sur ce projet).

-- `id` en text sans défaut : l'appelant devait le fabriquer. On lui en donne un.
alter table public.services alter column id set default gen_random_uuid()::text;

-- Le bilingue devient facultatif : `nameFr` reste le seul nom obligatoire.
alter table public.services alter column "nameEn" drop not null;
alter table public.services alter column "descriptionFr" drop not null;
alter table public.services alter column "descriptionEn" drop not null;

alter table public.services alter column "featuresFr" set default '[]'::jsonb;
alter table public.services alter column "featuresEn" set default '[]'::jsonb;
alter table public.services alter column "featuresFr" drop not null;
alter table public.services alter column "featuresEn" drop not null;

-- La durée utile d'une prestation est en MINUTES (`durationMinutes`).
-- `durationDays` ne concerne que les programmes longs — il redevient facultatif.
alter table public.services alter column "durationDays" drop not null;

-- Horodatage : défaut + trigger. La colonne existe bien (vérifié), donc le
-- trigger ne peut pas reproduire la panne de `masterclasses`, où le trigger
-- écrivait dans une colonne absente et bloquait TOUTE modification.
alter table public.services alter column "updatedAt" set default now();

create or replace function public.touch_services_updated_at()
returns trigger language plpgsql as $$
begin new."updatedAt" = now(); return new; end $$;

drop trigger if exists trg_services_touch on public.services;
create trigger trg_services_touch
before update on public.services
for each row execute function public.touch_services_updated_at();

-- Un prix nul est légitime (§27 : « gratuit » est une option de tarification).
alter table public.services alter column "priceEUR" set default 0;
