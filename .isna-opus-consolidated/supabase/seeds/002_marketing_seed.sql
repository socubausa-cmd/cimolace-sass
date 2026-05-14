INSERT INTO promo_codes (tenant_id, code, discount_type, discount_value, max_uses, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'PROMO10', 'percent', 10, 100, true),
  ('00000000-0000-0000-0000-000000000001', 'BIENVENUE20', 'percent', 20, 50, true);

INSERT INTO popups (tenant_id, title, content, trigger_type, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Avant de partir...',
  'Profite de -10% sur ta première formation avec le code PROMO10 !',
  'exit_intent',
  true
);

INSERT INTO banners (tenant_id, text, cta_url, cta_label, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '🎓 Nouvelle formation disponible — places limitées !',
  '/formations',
  'Découvrir',
  true
);
