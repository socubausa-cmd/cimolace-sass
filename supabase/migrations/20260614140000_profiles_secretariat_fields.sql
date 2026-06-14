-- Champs secrétariat sur profiles (porté d'ISNA v1) pour le moteur de matching.
-- Idempotent. Éligibilité = rôle dans tenant_memberships ; ces champs affinent
-- le scoring (région, en ligne/SLA, disponibilités).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS secretariat_region TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_secretariat_active BOOLEAN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_secretariat_online BOOLEAN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS secretariat_last_seen_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS secretariat_sla_ms INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability_start_hour INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability_end_hour INTEGER;
