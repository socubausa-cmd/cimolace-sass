-- Colonne "notify_sms" manquante sur public.profiles.
-- L'écran "Mon Profil" (StudentProfilePage.jsx) la SELECT (hydratation) et la
-- met à jour (préférences "Rappels SMS"). Sans elle, le SELECT échouait et la
-- sauvegarde des préférences renvoyait "column does not exist".
alter table public.profiles add column if not exists notify_sms boolean not null default false;
