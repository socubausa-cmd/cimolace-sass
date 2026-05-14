-- ============================================================
-- check-migrations.sql
-- Colle ce bloc dans le SQL Editor Supabase > Run
-- Liste toutes les tables attendues et dit si elles existent.
-- ============================================================

WITH expected(table_name, phase) AS (
  VALUES
  -- Phase 1 — Fondation
  ('tenants',                    'Phase 1 — Fondation'),
  ('tenant_memberships',         'Phase 1 — Fondation'),

  -- Phase 1.5 — Live payant
  ('access_passes',              'Phase 1.5 — Live payant'),
  ('live_sessions',              'Phase 1.5 — Live payant'),

  -- Phase 2 — Marketing
  ('promo_codes',                'Phase 2 — Marketing'),
  ('popups',                     'Phase 2 — Marketing'),
  ('banners',                    'Phase 2 — Marketing'),

  -- Billing
  ('tenant_subscriptions',       'Billing'),
  ('invoices',                   'Billing'),
  ('payment_methods',            'Billing'),

  -- Cimolace Catalog
  ('catalog_products',           'Cimolace Catalog'),
  ('tenant_services',            'Cimolace Catalog'),

  -- Phase 3 — Forum
  ('forum_categories',           'Phase 3 — Forum'),
  ('forum_topics',               'Phase 3 — Forum'),
  ('forum_posts',                'Phase 3 — Forum'),

  -- Phase 3 — Notifications
  ('notifications',              'Phase 3 — Notifications'),
  ('notification_preferences',   'Phase 3 — Notifications'),

  -- Phase 3 — Email Engine
  ('email_templates',            'Phase 3 — Email Engine'),
  ('email_campaigns',            'Phase 3 — Email Engine'),

  -- Phase 3 — SMS Engine
  ('sms_logs',                   'Phase 3 — SMS Engine'),
  ('whatsapp_logs',              'Phase 3 — SMS Engine'),

  -- PawaPay
  ('pawapay_deposits',           'PawaPayment'),

  -- MedOS
  ('medos_patients',             'MedOS'),
  ('medos_consultations',        'MedOS'),

  -- Booking
  ('booking_services',           'Booking'),
  ('booking_slots',              'Booking'),
  ('booking_appointments',       'Booking'),

  -- LIRI
  ('liri_conversations',         'LIRI Brain'),

  -- SmartBoard
  ('smartboard_sessions',        'SmartBoard')
),
existing AS (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
)
SELECT
  e.phase,
  e.table_name,
  CASE
    WHEN ex.table_name IS NOT NULL THEN '✅ PRESENT'
    ELSE '❌ MANQUANTE'
  END AS statut
FROM expected e
LEFT JOIN existing ex ON ex.table_name = e.table_name
ORDER BY e.phase, e.table_name;
