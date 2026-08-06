-- Boucle du report REFERMÉE côté invitations (POST /booking/invitations/respond) :
-- la réponse du demandeur doit pouvoir s'écrire dans le journal appointment_events
-- et sur le rendez-vous lui-même. Deux contraintes CHECK bloquaient ces écritures.

-- ⚠️ La contrainte `kind` de 20260806120000 est une liste FERMÉE : tout kind nouveau
-- serait rejeté en silence (les inserts d'audit sont best-effort → perte muette).
do $$
begin
  alter table public.appointment_events drop constraint if exists appointment_events_kind_check;
  alter table public.appointment_events add constraint appointment_events_kind_check
    check (kind in (
      'requested','confirmed','cancelled','reschedule_link_sent',
      'client_rescheduled','host_rescheduled','reminded','completed','no_show','note',
      -- réponse à une invitation/report : accepté (client_responded) ou refusé
      'client_responded','reschedule_declined'
    ));
exception when others then null;
end $$;

-- ⚠️ `appointments_status_check` (202603272002) ne liste ni 'requested' ni 'confirmed'
-- pourtant écrits par l'API en prod (la contrainte prod diverge des migrations —
-- migrations cimolace posées hors-bande). On recrée un SURENSEMBLE : jamais plus
-- restrictif que l'existant, sinon on casserait les inserts déjà en place.
do $$
begin
  alter table public.appointments drop constraint if exists appointments_status_check;
  alter table public.appointments add constraint appointments_status_check
    check (status in (
      'requested','scheduled','confirmed','in_progress','completed','cancelled',
      'no_show','rescheduled','live_now','report_generated',
      -- le demandeur a refusé le report proposé (visible côté /liri/rdv)
      'reschedule_declined'
    ));
exception when others then null;
end $$;
