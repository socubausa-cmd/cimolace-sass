-- Pont RDV -> séance live (école). Rend le schéma déterministe pour
-- BookingService.startLiveFromAppointment, porté d'ISNA v1 (booking-start-immersive-live).
-- Toutes les opérations sont idempotentes (sûres à rejouer).

-- 1) Pas de CHECK bloquant sur live_sessions.session_type (validation métier côté API) :
--    autorise 'entretien' (RDV école) en plus des valeurs verticales existantes.
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_session_type_check;

-- 2) live_sessions.appointment_id : lien vers le rendez-vous d'origine.
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS appointment_id UUID;

-- 3) appointments.live_session_id : lien retour vers la séance live créée.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS live_session_id UUID;

CREATE INDEX IF NOT EXISTS idx_live_sessions_appointment ON public.live_sessions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointments_live_session ON public.appointments(live_session_id);
