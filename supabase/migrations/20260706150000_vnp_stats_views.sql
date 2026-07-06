-- Vues de DÉPOUILLEMENT du VNP « vibe-surfing » (spec §6) : lire analytics_events pour piloter
-- la Cartographie par la donnée. STAFF/service_role uniquement (revoke anon/authenticated →
-- jamais exposées via PostgREST). Additif, non destructif, idempotent.

-- Lieux les plus demandés (node_opened) → quels sujets promouvoir / remonter en priorite_tour.
create or replace view public.vnp_top_nodes as
  select tenant_slug,
         payload->>'nodeId' as node_id,
         count(*) as ouvertures,
         count(*) filter (where (payload->>'tour')::boolean is true) as via_tour,
         max(created_at) as derniere
  from public.analytics_events
  where type = 'node_opened' and payload->>'nodeId' is not null
  group by tenant_slug, payload->>'nodeId';

-- Questions SANS réponse (onTopic=false / repli) = TROUS de Cartographie à combler (créer un Lieu).
create or replace view public.vnp_unanswered as
  select tenant_slug, count(*) as nb, max(created_at) as derniere
  from public.analytics_events
  where type = 'unanswered_question'
  group by tenant_slug;

-- Entonnoir de conversion : comptes par type d'événement (node_opened → vnp_chat → action → contact/tenant).
create or replace view public.vnp_funnel as
  select tenant_slug, type, count(*) as nb, max(created_at) as derniere
  from public.analytics_events
  group by tenant_slug, type;

-- Actions métier déclenchées (conversion) : contacter / reserver / acheter / rejoindre …
create or replace view public.vnp_actions as
  select tenant_slug, payload->>'action' as action, count(*) as nb
  from public.analytics_events
  where type = 'action_triggered' and payload->>'action' is not null
  group by tenant_slug, payload->>'action';

-- Sécurité : ces vues agrègent du comportement visiteur → réservées au service_role/staff.
revoke all on public.vnp_top_nodes, public.vnp_unanswered, public.vnp_funnel, public.vnp_actions from anon, authenticated;
