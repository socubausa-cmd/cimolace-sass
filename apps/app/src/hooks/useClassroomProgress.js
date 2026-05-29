import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { generateClassroomData } from '@/lib/mockClassroomData';

const pickVideoUrl = (data = {}) =>
  data.url ||
  data.videoUrl ||
  data.video_url ||
  data.publicUrl ||
  data.storageUrl ||
  data.file_url ||
  '';

const pickThumbnail = (data = {}) =>
  data.thumbnail ||
  data.thumbnailUrl ||
  data.poster ||
  data.image_url ||
  '';

const toQuiz = (quizData = {}) => {
  const questions = Array.isArray(quizData.questions) ? quizData.questions : [];
  const normalizedQuestions = questions.map((q, i) => ({
    id: q.id ?? i + 1,
    type: q.type || 'single',
    text: q.text || `Question ${i + 1}`,
    options: Array.isArray(q.options) && q.options.length > 1 ? q.options : ['Option A', 'Option B'],
    correctAnswer: Number(q.correctAnswer ?? 0),
    explanation: q.explanation || '',
  }));
  if (normalizedQuestions.length === 0) {
    normalizedQuestions.push({
      id: 1,
      type: 'single',
      text: 'Ce quiz sera bientôt disponible.',
      options: ['OK', 'Plus tard'],
      correctAnswer: 0,
      explanation: '',
    });
  }
  return {
    id: quizData.id || 'quiz-auto',
    minScore: Number(quizData.minScore || 1),
    questions: normalizedQuestions,
  };
};

const emptyContent = {
  summary: 'Le contenu pédagogique de cette journée sera disponible après publication.',
  keyPoints: ['Objectifs du jour', 'Concepts clés', 'Exercice pratique'],
  definitions: [],
};

const toClassroomWeek = (weekRow, weekIdx, todayIsoDate) => {
  const daysSorted = (weekRow?.formation_days || [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const days = daysSorted.map((d, dIdx) => {
    const contents = (d.formation_day_contents || [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const videos = contents.filter((c) => c.type === 'video');
    const quizContent = contents.find((c) => c.type === 'quiz');

    const firstVideoData = videos[0]?.data || {};
    const dateIso = firstVideoData.date || firstVideoData.scheduledAt || new Date().toISOString();
    const dayIso = new Date(dateIso).toISOString().slice(0, 10);
    const status = dayIso === todayIsoDate ? 'current' : dayIso < todayIsoDate ? 'completed' : 'locked';

    return {
      id: d.id,
      title: d.title || `Jour ${dIdx + 1}`,
      date: dateIso,
      status,
      video: {
        id: videos[0]?.id || `video-${d.id}`,
        title: firstVideoData.title || d.title || `Leçon ${dIdx + 1}`,
        description: firstVideoData.description || 'Vidéo de cours',
        duration: firstVideoData.duration || '—',
        url: pickVideoUrl(firstVideoData),
        thumbnail: pickThumbnail(firstVideoData),
        completed: status === 'completed',
      },
      content: {
        summary: firstVideoData.summary || firstVideoData.summary_text || emptyContent.summary,
        keyPoints: Array.isArray(firstVideoData.keyPoints || firstVideoData.key_points_json)
          ? (firstVideoData.keyPoints || firstVideoData.key_points_json)
          : emptyContent.keyPoints,
        definitions: Array.isArray(firstVideoData.definitions) ? firstVideoData.definitions : emptyContent.definitions,
      },
      notebook: {
        question: 'Qu\'as-tu retenu de ce cours et comment peux-tu l\'appliquer ?',
        minLength: 50,
        savedContent: '',
      },
      quiz: toQuiz(quizContent?.data || {}),
    };
  });

  const openingVideo = days[0]?.video || {};
  const closingVideo = days[days.length - 1]?.video || openingVideo;
  const weekDate = days[0]?.date || new Date().toISOString();
  const closingDate = days[days.length - 1]?.date || weekDate;

  return {
    id: weekRow?.id || `week-${weekIdx + 1}`,
    weekNumber: weekIdx + 1,
    title: weekRow?.title || `Semaine ${weekIdx + 1}`,
    description: 'Objectifs de la semaine : progression pédagogique structurée.',
    status: weekIdx === 0 ? 'active' : 'locked',
    openingLive: {
      id: `live-open-${weekRow?.id || weekIdx + 1}`,
      title: `Live d'ouverture - ${weekRow?.title || `Semaine ${weekIdx + 1}`}`,
      instructor: 'Équipe pédagogique',
      date: weekDate,
      duration: openingVideo.duration || '45 min',
      status: openingVideo.url ? (new Date(weekDate) < new Date() ? 'replay' : 'upcoming') : 'upcoming',
      thumbnail: openingVideo.thumbnail || '',
      replayUrl: openingVideo.url || '',
    },
    closingLive: {
      id: `live-close-${weekRow?.id || weekIdx + 1}`,
      title: `Live de synthèse - ${weekRow?.title || `Semaine ${weekIdx + 1}`}`,
      instructor: 'Équipe pédagogique',
      date: closingDate,
      duration: closingVideo.duration || '60 min',
      status: closingVideo.url ? (new Date(closingDate) < new Date() ? 'replay' : 'upcoming') : 'upcoming',
      thumbnail: closingVideo.thumbnail || '',
      replayUrl: closingVideo.url || '',
    },
    days,
    requirements: {
      videosWatched: 0,
      notebooksFilled: 0,
      quizzesPassed: 0,
      liveAttended: false,
    },
    validated: false,
  };
};

export const useClassroomProgress = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(null);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        // 1) Pick one enrolled formation (prefer active enrollment)
        let formationId = null;
        if (user?.id) {
          const { data: enrollments } = await supabase
            .from('student_progress')
            .select('course_id,status,created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          const list = Array.isArray(enrollments) ? enrollments : [];
          const activeEnrollment = list.find((e) => String(e.status || '').toLowerCase() === 'active');
          formationId = activeEnrollment?.course_id || list[0]?.course_id || null;
        }

        // 2) Fallback: manually selected formation in localStorage
        if (!formationId) {
          try {
            const fromStorage = localStorage.getItem('current_formation_id');
            if (fromStorage) formationId = fromStorage;
          } catch {
            // ignore
          }
        }

        if (!formationId) {
          const mock = generateClassroomData();
          if (!mounted) return;
          setData(mock);
          const active = mock.weeks.find((w) => w.status === 'active') || mock.weeks[0];
          setCurrentWeek(active);
          const todayIndex = active.days.findIndex((d) => d.status === 'current');
          setCurrentDayIndex(todayIndex !== -1 ? todayIndex : 0);
          setLoading(false);
          return;
        }

        // 3) Load modules/weeks/days/contents from DB
        const { data: modulesRows, error } = await supabase
          .from('modules')
          .select(`
            id, title, sort_order,
            formation_weeks (
              id, title, sort_order,
              formation_days (
                id, title, sort_order,
                formation_day_contents (id, type, sort_order, data)
              )
            )
          `)
          .eq('formation_id', formationId)
          .order('sort_order', { ascending: true })
          .order('sort_order', { foreignTable: 'formation_weeks', ascending: true })
          .order('sort_order', { foreignTable: 'formation_weeks.formation_days', ascending: true })
          .order('sort_order', { foreignTable: 'formation_weeks.formation_days.formation_day_contents', ascending: true });

        if (error || !Array.isArray(modulesRows) || modulesRows.length === 0) {
          const mock = generateClassroomData();
          if (!mounted) return;
          setData(mock);
          const active = mock.weeks.find((w) => w.status === 'active') || mock.weeks[0];
          setCurrentWeek(active);
          const todayIndex = active.days.findIndex((d) => d.status === 'current');
          setCurrentDayIndex(todayIndex !== -1 ? todayIndex : 0);
          setLoading(false);
          return;
        }

        const firstModule = modulesRows[0];
        const weeksRows = (firstModule.formation_weeks || [])
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        const todayIsoDate = new Date().toISOString().slice(0, 10);
        const weeks = weeksRows.map((w, idx) => toClassroomWeek(w, idx, todayIsoDate));

        const classroomData = { weeks, currentWeekId: weeks[0]?.id || null };
        if (!mounted) return;
        setData(classroomData);

        const active = weeks.find((w) => w.status === 'active') || weeks[0];
        setCurrentWeek(active);
        const todayIndex = (active?.days || []).findIndex((d) => d.status === 'current');
        setCurrentDayIndex(todayIndex !== -1 ? todayIndex : 0);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const goToNextDay = () => {
    if (currentWeek && currentDayIndex < currentWeek.days.length - 1) {
       // Check if current day is completed (logic can be stricter)
       setCurrentDayIndex(prev => prev + 1);
    }
  };

  const goToPrevDay = () => {
    if (currentDayIndex > 0) {
       setCurrentDayIndex(prev => prev - 1);
    }
  };

  // ── Clé locale pour persister l'avancement ───────────────────────────────
  const _progressKey = (userId, formationId) =>
    `liri:classroom:progress:${userId ?? 'anon'}:${formationId ?? 'demo'}`;

  const _loadLocalProgress = () => {
    try {
      const key = _progressKey(user?.id, data?.formationId);
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  };

  const _saveLocalProgress = (patch) => {
    try {
      const key = _progressKey(user?.id, data?.formationId);
      const prev = _loadLocalProgress();
      localStorage.setItem(key, JSON.stringify({ ...prev, ...patch }));
    } catch {}
  };

  /** Persiste le cahier de notes d'un jour — localStorage + Supabase */
  const updateNotebook = async (dayId, content) => {
    _saveLocalProgress({ [`notebook_${dayId}`]: content });
    setCurrentWeek(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map(d =>
          d.id === dayId
            ? { ...d, notebook: { ...d.notebook, savedContent: content } }
            : d
        ),
      };
    });
    if (!user?.id || !dayId) return;
    try {
      await supabase.from('student_evaluations').insert({
        student_id:   user.id,
        formation_id: data?.formationId ?? null,
        title:        `Cahier — Jour ${dayId}`,
        score:        1,
        max_score:    1,
        comment:      content.slice(0, 2000),
        evaluated_at: new Date().toISOString(),
      });
    } catch {}
  };

  /** Enregistre le score d'un quiz et déverrouille le jour suivant */
  const submitQuiz = async (dayId, score) => {
    _saveLocalProgress({ [`quiz_${dayId}`]: score });
    // Débloquer le jour suivant dans l'état local
    let dayIdx = -1;
    setCurrentWeek(prev => {
      if (!prev) return prev;
      const idx = prev.days.findIndex(d => d.id === dayId);
      dayIdx = idx;
      if (idx === -1) return prev;
      const days = prev.days.map((d, i) => {
        if (d.id === dayId) return { ...d, video: { ...d.video, completed: true }, status: 'completed' };
        if (i === idx + 1 && d.status === 'locked') return { ...d, status: 'current' };
        return d;
      });
      return { ...prev, days };
    });
    if (dayIdx !== -1 && currentDayIndex < (currentWeek?.days?.length ?? 0) - 1) {
      setCurrentDayIndex(prev => prev + 1);
    }
    if (!user?.id) return;
    try {
      await supabase.from('student_evaluations').insert({
        student_id:   user.id,
        formation_id: data?.formationId ?? null,
        title:        `Quiz — Jour ${dayId}`,
        score:        score,
        max_score:    100,
        evaluated_at: new Date().toISOString(),
      });
    } catch {}
  };

  /**
   * Marque la semaine comme terminée :
   * 1. État local + localStorage
   * 2. UPDATE annual_program_weeks SET status='completed' (recherche par date d'aujourd'hui)
   */
  const validateWeek = async (annualWeekId) => {
    if (!currentWeek) return;
    // Mise à jour état local
    setCurrentWeek(prev => prev ? { ...prev, validated: true, status: 'validated' } : prev);
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        weeks: prev.weeks.map(w =>
          w.id === currentWeek.id ? { ...w, validated: true, status: 'validated' } : w
        ),
      };
    });
    _saveLocalProgress({ [`week_validated_${currentWeek.id}`]: true });

    // Mise à jour Supabase : annual_program_weeks
    try {
      const today = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from('annual_program_weeks')
        .update({ status: 'completed', updated_at: new Date().toISOString() });

      if (annualWeekId) {
        query = query.eq('id', annualWeekId);
      } else {
        // Fallback : trouver la semaine par plage de dates
        query = query.lte('week_start', today).gte('week_end', today);
      }
      await query;
    } catch {}
  };

  return {
    loading,
    weeks: data?.weeks || [],
    currentWeek,
    currentDay: currentWeek?.days[currentDayIndex],
    currentDayIndex,
    goToNextDay,
    goToPrevDay,
    updateNotebook,
    submitQuiz,
    validateWeek,
    setCurrentWeekById: (id) => {
       const week = data?.weeks.find(w => w.id === id);
       if (week) {
          setCurrentWeek(week);
          setCurrentDayIndex(0);
       }
    }
  };
};