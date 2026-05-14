-- ============================================================================
-- Seed: 2 Tenants de test — ISNA (A) et MedOS (B)
-- Utilisé pour valider l'isolation multi-tenant
-- ============================================================================

-- ⚠️  À exécuter après toutes les migrations, sur l'environnement Staging

-- ── Tenant A : ISNA ────────────────────────────────────────────────────────
INSERT INTO tenants (id, slug, name, plan, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'isna', 'Institut ISNA', 'pro', 'active');

INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'teacher'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'student');

-- Workspace ISNA (doit être invisible pour Tenant B)
INSERT INTO liri_course_workspaces (tenant_id, owner_id, title, status)
VALUES ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Cours ISNA — Nutrition', 'draft');

-- Live ISNA
INSERT INTO live_sessions (tenant_id, host_user_id, title, scheduled_at, price_cents, livekit_room_name, status)
VALUES ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Live Nutrition ISNA', '2026-06-01T10:00:00Z', 0, 'isna_live_001', 'scheduled');

-- Projet ISNA
INSERT INTO liri_projects (tenant_id, owner_id, project_type, title, source_text)
VALUES ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'course', 'Masterclass ISNA', 'Contenu ISNA...');

-- ── Tenant B : MedOS ──────────────────────────────────────────────────────
INSERT INTO tenants (id, slug, name, plan, status) VALUES
  ('b0000000-0000-0000-0000-000000000002', 'medos', 'Clinique MedOS', 'pro', 'active');

INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'owner'),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'admin');

-- Workspace MedOS (doit être invisible pour Tenant A)
INSERT INTO liri_course_workspaces (tenant_id, owner_id, title, status)
VALUES ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'Cours MedOS — Anatomie', 'draft');

-- Live MedOS
INSERT INTO live_sessions (tenant_id, host_user_id, title, scheduled_at, price_cents, livekit_room_name, status)
VALUES ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'Live Anatomie MedOS', '2026-06-02T14:00:00Z', 0, 'medos_live_001', 'scheduled');

-- Projet MedOS
INSERT INTO liri_projects (tenant_id, owner_id, project_type, title, source_text)
VALUES ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'course', 'Masterclass MedOS', 'Contenu MedOS...');
