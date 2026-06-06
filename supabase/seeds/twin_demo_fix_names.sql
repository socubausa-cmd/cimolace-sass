-- Fix cosmetique des 3 noms patients demo (corrompus a un collage anterieur).
-- 100% ASCII -> immune a tout probleme d'encodage. Tenant zahirwellness.
UPDATE med_patients SET last_name = 'Demo-Inflammatoire'
 WHERE tenant_id = '1896be98-0d36-4044-bf37-0f1a26f5c363' AND first_name = 'Amina'  AND date_of_birth = '1979-04-12';
UPDATE med_patients SET last_name = 'Demo-Metabolique'
 WHERE tenant_id = '1896be98-0d36-4044-bf37-0f1a26f5c363' AND first_name = 'Karim'  AND date_of_birth = '1972-09-03';
UPDATE med_patients SET last_name = 'Demo-Thyroide'
 WHERE tenant_id = '1896be98-0d36-4044-bf37-0f1a26f5c363' AND first_name = 'Sophie' AND date_of_birth = '1986-02-21';
