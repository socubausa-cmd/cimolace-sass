-- Seed d'événements d'agenda (school_events) pour le tenant ISNA.
-- Alimente l'onglet "Agenda" de l'espace élève (apps/app/.../StudentAgendaPage.jsx).
-- Dates ancrées sur le début de journée + offset jours/heure → toujours "à venir"
-- lors de l'application. La table school_events existe déjà
-- (migration 20260528140002_school_events_calendar.sql).

delete from public.school_events where tenant_id = '4f6faaa8-43a0-46d6-b98a-99ea1154f9ea';

insert into public.school_events (tenant_id, title, description, start_at, end_at, location, target_role)
select '4f6faaa8-43a0-46d6-b98a-99ea1154f9ea'::uuid,
       r.title, r.description,
       date_trunc('day', now()) + (r.offset_days || ' days')::interval + (r.hour || ' hours')::interval,
       date_trunc('day', now()) + (r.offset_days || ' days')::interval + (r.hour || ' hours')::interval + (r.dur_min || ' minutes')::interval,
       r.location, coalesce(r.target_role, 'student')
from json_to_recordset($json$[
 {"title":"Cours en direct — Tajwîd : les règles de la Madd","description":"Séance live avec le formateur, questions en direct.","offset_days":0,"hour":19,"dur_min":60,"location":"Visioconférence","target_role":"student"},
 {"title":"Atelier de mémorisation du Coran (en ligne)","description":"Techniques et révision collective en visio.","offset_days":1,"hour":9,"dur_min":90,"location":"Visioconférence","target_role":"student"},
 {"title":"Contrôle de Tajwîd — Niveau 1","description":"Évaluation des règles de la Noûn Sâkinah et du Tanwîn.","offset_days":3,"hour":13,"dur_min":60,"location":"Salle 2","target_role":"student"},
 {"title":"Conférence : Introduction aux sciences du Coran","description":"Ouverte à tous les élèves de l'institut.","offset_days":5,"hour":17,"dur_min":120,"location":"Amphi A","target_role":"all"},
 {"title":"Cours en direct — Grammaire arabe : la phrase nominale","description":"Séance live, niveau 1.","offset_days":7,"hour":17,"dur_min":60,"location":"Visioconférence","target_role":"student"},
 {"title":"Réunion parents – professeurs","description":"Bilan du trimestre et échanges individuels.","offset_days":9,"hour":16,"dur_min":120,"location":"Campus ISNA","target_role":"all"},
 {"title":"Évaluation de mémorisation — Juz' 'Amma","description":"Récitation individuelle devant le formateur.","offset_days":12,"hour":8,"dur_min":90,"location":"Salle 1","target_role":"student"},
 {"title":"Cours en direct — Fiqh des adorations","description":"Les conditions et piliers de la prière.","offset_days":14,"hour":17,"dur_min":60,"location":"Visioconférence","target_role":"student"},
 {"title":"Journée portes ouvertes ISNA","description":"Présentation des formations et rencontres.","offset_days":16,"hour":8,"dur_min":480,"location":"Campus ISNA","target_role":"all"},
 {"title":"Atelier de calligraphie arabe","description":"Initiation au style Naskh.","offset_days":19,"hour":13,"dur_min":120,"location":"Atelier B","target_role":"student"},
 {"title":"Examen final — Langue arabe Niveau 1","description":"Épreuve écrite et orale.","offset_days":26,"hour":8,"dur_min":120,"location":"Salle 1","target_role":"student"},
 {"title":"Séminaire intensif de Tajwîd","description":"Journée complète de perfectionnement.","offset_days":33,"hour":8,"dur_min":360,"location":"Amphi A","target_role":"all"}
]$json$) as r(title text, description text, offset_days int, hour int, dur_min int, location text, target_role text);
