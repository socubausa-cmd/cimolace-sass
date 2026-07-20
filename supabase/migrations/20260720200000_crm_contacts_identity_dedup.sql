-- #4 (dédup) + #5 (identité) : durcit crm_contacts pour les reliures entrantes de masse.
-- Appliqué hors-bande via psql (JAMAIS db push). crm_contacts est vide en prod → aucun
-- dédoublonnage préalable nécessaire ; sinon, dédoublonner avant les index UNIQUE.

-- #5 : lien d'identité plateforme (posé par les triggers entrants ; évite l'oracle email).
alter table public.crm_contacts add column if not exists user_id uuid;

-- #4 : recherche/dédup par email (miroir de idx_leads_email) + unicité par tenant.
create index if not exists idx_crm_contacts_tenant_email
  on public.crm_contacts (tenant_id, lower(email));
create unique index if not exists uq_crm_contacts_tenant_email
  on public.crm_contacts (tenant_id, lower(email))
  where email is not null and btrim(email) <> '';
create unique index if not exists uq_crm_contacts_tenant_user
  on public.crm_contacts (tenant_id, user_id)
  where user_id is not null;
create index if not exists idx_crm_contacts_owner
  on public.crm_contacts (tenant_id, owner_id)
  where owner_id is not null;
