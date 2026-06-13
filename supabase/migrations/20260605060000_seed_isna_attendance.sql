delete from public.attendance_records where student_id = (select id from auth.users where email = 'eleve.test@isna.fr');

insert into public.attendance_records (student_id, status, attendance_date, note)
select (select id from auth.users where email = 'eleve.test@isna.fr'),
       r.status, (current_date - r.days_ago), r.note
from json_to_recordset($json$[
 {"status":"excused","days_ago":18,"note":"Certificat médical"},
 {"status":"late","days_ago":12,"note":"Retard de transport"},
 {"status":"absent","days_ago":9,"note":null},
 {"status":"excused","days_ago":5,"note":"Rendez-vous administratif"},
 {"status":"late","days_ago":2,"note":null}
]$json$) as r(status text, days_ago int, note text);

select status, count(*) from public.attendance_records
 where student_id = (select id from auth.users where email='eleve.test@isna.fr') group by status order by status;
