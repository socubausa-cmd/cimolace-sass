-- Répare le panneau de modération des avis (OwnerDashboard / SecretariatDashboard).
--
-- `SiteReviewsModerationPanel.jsx` sélectionne `is_spam_suspected` et `spam_reason`
-- et affiche un badge « Spam suspecté » — mais les deux colonnes n'ont JAMAIS existé
-- dans `site_reviews`. Résultat : la requête part en erreur, la liste reste vide, et
-- le fondateur n'a aucun moyen d'approuver un témoignage. Le bogue était invisible
-- tant que personne n'avait déposé d'avis.
--
-- ⚠️ Appliquée HORS-BANDE via psql (jamais `supabase db push` sur ce projet).

alter table public.site_reviews
  add column if not exists is_spam_suspected boolean not null default false;

alter table public.site_reviews
  add column if not exists spam_reason text;

-- Les avis suspects doivent remonter EN PREMIER dans la file d'attente : c'est
-- ce qu'on veut voir avant d'approuver quoi que ce soit.
create index if not exists idx_site_reviews_spam_pending
  on public.site_reviews(status, is_spam_suspected, submitted_at desc);
