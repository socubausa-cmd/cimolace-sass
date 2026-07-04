import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Vie scolaire de l'accueil élève LIRI — une seule source de vérité pour :
 *   • `items`  → le fil « À venir » priorisé (annonces urgentes + événements ≤14j
 *                + examens + prochains lives), borné à 5.
 *   • `agenda` → tous les items datés à venir (events + examens calendrier), pour le
 *                mini-agenda du jour de la carte horloge.
 *
 * Accès direct Supabase (même client que SchoolLifeComponents / useLiriMobileAgendaMerged) :
 * la RLS scope déjà au tenant du membre. Filtres serveur limités à ceux prouvés supportés
 * (`.eq`, `.gte`, `.in`, `.order`, `.limit`). Fail-closed : erreur → tout vide.
 *
 * ⚠️ Les EXAMENS ISNA sont des `school_events` au titre « Contrôle/Évaluation/Examen »
 *    (pas des `school_calendar` type=exam) → on classe l'examen par TITRE, comme le fait
 *    useLiriMobileAgendaMerged, et on garde `school_calendar` type=exam en source bonus.
 */
const URGENT_RE = /urgent|high|haute|critical|critique|important/i;
const EXAM_RE = /exam|évaluation|evaluation|contr[oô]le|quiz|épreuve|epreuve|partiel/i;
const DAY = 864e5;

export function useUpcomingSchoolFeed(upcomingLives = [], userId = null) {
  const [rows, setRows] = useState({ ann: [], events: [], exams: [], courses: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
        const todayIso = startOfToday.toISOString();
        const todayDate = todayIso.slice(0, 10);
        const [ann, events, exams, prog] = await Promise.all([
          supabase.from('announcements')
            .select('id,title,summary,priority,published_at,status')
            .eq('status', 'published')
            .order('published_at', { ascending: false })
            .limit(12),
          supabase.from('school_events')
            .select('id,title,description,start_at,location,target_role')
            .gte('start_at', todayIso)
            .in('target_role', ['student', 'all'])
            .order('start_at', { ascending: true })
            .limit(40),
          supabase.from('school_calendar')
            .select('id,title,type,start_date')
            .eq('type', 'exam')
            .gte('start_date', todayDate)
            .order('start_date', { ascending: true })
            .limit(20),
          // Progression élève (inscriptions) → « Reprendre » + « Activité récente ».
          userId
            ? supabase.from('student_progress')
              .select('id,status,created_at,completed_at,courses(id,title,image_url)')
              .eq('user_id', userId)
              .in('status', ['active', 'in_progress', 'completed'])
              .order('created_at', { ascending: false })
              .limit(10)
            : Promise.resolve({ data: [] }),
        ]);
        if (!alive) return;
        setRows({
          ann: Array.isArray(ann?.data) ? ann.data : [],
          events: Array.isArray(events?.data) ? events.data : [],
          exams: Array.isArray(exams?.data) ? exams.data : [],
          courses: Array.isArray(prog?.data) ? prog.data : [],
        });
      } catch {
        if (alive) setRows({ ann: [], events: [], exams: [], courses: [] });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  // Inscriptions de l'élève, normalisées et triées (récent d'abord) → « Reprendre » + activité.
  const courses = useMemo(() => (rows.courses || [])
    .filter((e) => e.courses)
    .map((e) => ({
      id: e.courses.id,
      title: e.courses.title || 'Formation',
      thumbnail: e.courses.image_url || '',
      status: e.status === 'completed' ? 'completed' : 'in_progress',
      whenIso: e.completed_at || e.created_at || null,
    }))
    .sort((a, b) => +new Date(b.whenIso || 0) - +new Date(a.whenIso || 0)), [rows.courses]);

  // Tous les items datés à venir (events + examens calendrier), normalisés et triés.
  const agenda = useMemo(() => {
    const evs = rows.events
      .filter((e) => e.start_at)
      .map((e) => ({
        id: `ev-${e.id}`,
        title: e.title || 'Événement',
        location: e.location || null,
        when: new Date(e.start_at),
        isExam: EXAM_RE.test(`${e.title || ''} ${e.description || ''}`),
      }));
    const cal = rows.exams
      .filter((x) => x.start_date)
      .map((x) => ({
        id: `ex-${x.id}`,
        title: x.title || 'Examen',
        location: null,
        when: new Date(`${x.start_date}T09:00:00`),
        isExam: true,
      }));
    return [...evs, ...cal].sort((a, b) => +a.when - +b.when);
  }, [rows]);

  // Fil « À venir » priorisé : annonces urgentes en tête, puis items datés (≤14j) + lives.
  const items = useMemo(() => {
    const now = new Date();
    const in14 = new Date(+now + 14 * DAY);

    // Annonces : urgentes en tête, complétées par les plus récentes (normales) — toujours
    // présentes si l'école en a publié (rows.ann est déjà trié published_at desc). Max 2.
    const isUrg = (a) => URGENT_RE.test(String(a.priority || ''));
    const annItems = [...rows.ann.filter(isUrg), ...rows.ann.filter((a) => !isUrg(a))]
      .slice(0, 2)
      .map((a) => ({
        id: `ann-${a.id}`, kind: 'announcement', urgent: isUrg(a),
        title: a.title || 'Annonce', sub: a.summary || 'Annonce officielle',
        when: null, to: '/liri/vie-scolaire',
      }));

    const dated = [
      ...agenda
        .filter((it) => it.when >= now && it.when <= in14)
        .map((it) => ({
          id: it.id, kind: it.isExam ? 'exam' : 'event', urgent: false,
          title: it.title, sub: it.isExam ? 'Examen à venir' : (it.location || 'Vie scolaire'),
          when: it.when, to: '/liri/agenda',
        })),
      ...(Array.isArray(upcomingLives) ? upcomingLives : [])
        .filter((l) => l?.scheduled_at && new Date(l.scheduled_at) >= now)
        .map((l) => ({
          id: `live-${l.id}`, kind: 'live', urgent: false,
          title: l.title || 'Session live', sub: 'Live programmé',
          when: new Date(l.scheduled_at), to: '/lives',
        })),
    ].sort((a, b) => +a.when - +b.when);

    return [...annItems, ...dated].slice(0, 5);
  }, [rows.ann, agenda, upcomingLives]);

  return { items, agenda, courses, loading };
}

export default useUpcomingSchoolFeed;
