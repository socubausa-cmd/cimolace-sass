-- ============================================================================
-- #42 — Durcissement RLS du CALENDRIER ANNUEL (school_year_calendars,
-- annual_program_weeks). PAS une correction de fuite : VÉRIFIÉ qu'il n'y en a pas.
-- ----------------------------------------------------------------------------
-- Les policies syc_service / apw_service sont USING(true) + WITH CHECK(true),
-- MAIS scopées au rôle {service_role} — lequel BYPASSE déjà la RLS (rolbypassrls).
-- Elles sont donc REDONDANTES et n'ont jamais fui vers les utilisateurs
-- 'authenticated' (le front), dont l'accès reste correctement scopé tenant via
-- syc_tenant_member_read / apw_tenant_member_read (SELECT membre) et
-- syc_staff_manage / apw_staff_manage (ALL owner/admin/teacher).
--
-- PREUVE (rôle authenticated simulé) : non-membre → 0 calendriers / 0 semaines ;
-- membre → 1 / 40. Le cross-tenant est déjà bloqué.
--
-- On SUPPRIME ces policies par hygiène + défense en profondeur : si le bypassrls
-- du service_role était un jour retiré, un USING(true) résiduel deviendrait une
-- vraie fuite. NON-DESTRUCTIF : service_role garde l'accès complet via bypassrls ;
-- les membres via les policies scopées qui restent en place.
-- ============================================================================

DROP POLICY IF EXISTS syc_service ON public.school_year_calendars;
DROP POLICY IF EXISTS apw_service ON public.annual_program_weeks;
