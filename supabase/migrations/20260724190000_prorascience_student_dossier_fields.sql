-- ============================================================================
-- Prorascience / LIRI — dossier élève post-paiement
-- Date: 2026-07-24
--
-- Objectif:
-- - permettre au tunnel de vente d'activer un espace élève après paiement;
-- - permettre à l'élève de compléter son dossier administratif obligatoire:
--   pièce d'identité, preuve de résidence, demi-carte/photo et signature;
-- - permettre au back-office de vérifier la complétude du dossier sans erreur
--   de colonne manquante.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legal_full_name TEXT,
  ADD COLUMN IF NOT EXISTS identity_document_url TEXT,
  ADD COLUMN IF NOT EXISTS residence_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS headshot_url TEXT,
  ADD COLUMN IF NOT EXISTS consent_signature TEXT,
  ADD COLUMN IF NOT EXISTS consent_signed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_student_dossier_completed
  ON public.profiles(student_profile_completed, student_profile_completed_at);

COMMENT ON COLUMN public.profiles.legal_full_name IS
  'Nom complet légal de l’élève pour certification et dossier administratif.';
COMMENT ON COLUMN public.profiles.identity_document_url IS
  'URL Storage de la pièce d’identité fournie par l’élève.';
COMMENT ON COLUMN public.profiles.residence_proof_url IS
  'URL Storage de la preuve de résidence fournie par l’élève.';
COMMENT ON COLUMN public.profiles.headshot_url IS
  'URL Storage de la demi-carte/photo élève.';
COMMENT ON COLUMN public.profiles.consent_signature IS
  'Signature numérique du consentement dossier élève.';
COMMENT ON COLUMN public.profiles.consent_signed_at IS
  'Date de signature numérique du consentement dossier élève.';
