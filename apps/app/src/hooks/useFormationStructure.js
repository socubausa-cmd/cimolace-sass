import { useCallback, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Unifie les clés vidéo (DB / studio / meta) pour CoursePlayer + VideoPlayer.
 */
export function normalizeFormationVideoPayload(d = {}) {
  const storagePath =
    d.storagePath ||
    d.storage_path ||
    d.video_storage_path ||
    d.path ||
    null;
  const url = String(d.url || d.video_url || d.src || '').trim();
  let type = d.type ? String(d.type).toLowerCase() : '';
  if (!type && storagePath) type = 'upload';
  if (!type && url) {
    if (/youtu\.be|youtube\.com/i.test(url)) type = 'youtube';
    else if (/vimeo\.com/i.test(url)) type = 'vimeo';
    else type = 'custom_url';
  }
  return {
    ...d,
    id: d.id,
    storagePath: storagePath || undefined,
    url,
    ...(type ? { type } : {}),
  };
}

const toUiStructure = (modulesRows) => {
  return (modulesRows || []).map((m) => ({
    id: m.id,
    title: m.title,
    weeks: (m.formation_weeks || []).map((w) => ({
      id: w.id,
      title: w.title,
      days: (w.formation_days || []).map((d) => {
        const contents = (d.formation_day_contents || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        const videos = contents
          .filter((c) => c.type === 'video')
          .map((c) => normalizeFormationVideoPayload({ ...(c.data || {}), id: c.id }));

        const ppt = contents.find((c) => c.type === 'powerpoint');
        const quiz = contents.find((c) => c.type === 'quiz');

        return {
          id: d.id,
          title: d.title,
          videos,
          powerpoint: ppt ? { ...(ppt.data || {}), id: ppt.id } : null,
          quiz: quiz ? { ...(quiz.data || {}), id: quiz.id } : null,
        };
      }),
    })),
  }));
};

// Vue « plan de cours » à PLAT : modules → leçons (chaque content block = 1 leçon).
// Consommée par les pages de détail cours (TenantCourseDetailPage, route élève
// /student-school-life/cours/:id) qui affichent un cours comme une liste de
// modules + leçons, sans exposer la hiérarchie semaines/jours du studio.
const outlineNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const toOutline = (modulesRows) => {
  return (modulesRows || [])
    .slice()
    .sort((a, b) => outlineNum(a.sort_order) - outlineNum(b.sort_order))
    .map((m) => {
      const lessons = [];
      (m.formation_weeks || [])
        .slice()
        .sort((a, b) => outlineNum(a.sort_order) - outlineNum(b.sort_order))
        .forEach((w) => {
          (w.formation_days || [])
            .slice()
            .sort((a, b) => outlineNum(a.sort_order) - outlineNum(b.sort_order))
            .forEach((d) => {
              (d.formation_day_contents || [])
                .slice()
                .sort((a, b) => outlineNum(a.sort_order) - outlineNum(b.sort_order))
                .forEach((c) => {
                  const data = c.data || {};
                  lessons.push({
                    id: c.id,
                    week_id: w.id, // #44 — pour le gating de déblocage par semaine
                    title: String(
                      data.title || data.name || (c.type === 'video' ? 'Vidéo' : c.type || 'Contenu')
                    ).trim(),
                    type: c.type,
                    // sentinelle truthy : la vraie URL signée est résolue par le player.
                    video_url: c.type === 'video' ? '1' : null,
                  });
                });
            });
        });
      return { id: m.id, title: m.title, sort_order: m.sort_order, lessons };
    });
};

const buildDbInserts = ({ formationId, modules }) => {
  const modulesInsert = [];
  const weeksInsert = [];
  const daysInsert = [];
  const contentsInsert = [];

  (modules || []).forEach((m, mIdx) => {
    const moduleId = m.id;
    modulesInsert.push({
      id: moduleId,
      formation_id: formationId,
      title: m.title || `Module ${mIdx + 1}`,
      description: null,
      sort_order: mIdx,
      status: 'locked',
    });

    (m.weeks || []).forEach((w, wIdx) => {
      const weekId = w.id;
      weeksInsert.push({
        id: weekId,
        module_id: moduleId,
        title: w.title || `Semaine ${wIdx + 1}`,
        sort_order: wIdx,
      });

      (w.days || []).forEach((d, dIdx) => {
        const dayId = d.id;
        daysInsert.push({
          id: dayId,
          week_id: weekId,
          title: d.title || `Jour ${dIdx + 1}`,
          sort_order: dIdx,
        });

        let sortOrder = 0;
        (d.videos || []).forEach((v) => {
          const { id: _ignoredId, ...videoData } = v || {};
          contentsInsert.push({
            id: v.id,
            day_id: dayId,
            type: 'video',
            sort_order: sortOrder++,
            data: { ...videoData },
          });
        });

        if (d.powerpoint) {
          const { id: _ignoredId, ...pptData } = d.powerpoint || {};
          contentsInsert.push({
            id: d.powerpoint.id,
            day_id: dayId,
            type: 'powerpoint',
            sort_order: sortOrder++,
            data: { ...pptData },
          });
        }

        if (d.quiz) {
          const { id: _ignoredId, ...quizData } = d.quiz || {};
          contentsInsert.push({
            id: d.quiz.id,
            day_id: dayId,
            type: 'quiz',
            sort_order: sortOrder++,
            data: { ...quizData },
          });
        }
      });
    });
  });

  return { modulesInsert, weeksInsert, daysInsert, contentsInsert };
};

const newUuid = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const isUuid = (value) => {
  if (!value) return false;
  const s = String(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
};

const ensureId = (value) => {
  if (isUuid(value)) return String(value);
  return newUuid();
};

const normalizeUiIds = (modules) => {
  return (modules || []).map((m, mIdx) => {
    const moduleId = ensureId(m.id);
    return {
      ...m,
      id: moduleId,
      weeks: (m.weeks || []).map((w, wIdx) => {
        const weekId = ensureId(w.id);
        return {
          ...w,
          id: weekId,
          days: (w.days || []).map((d, dIdx) => {
            const dayId = ensureId(d.id);
            return {
              ...d,
              id: dayId,
              videos: (d.videos || []).map((v, vIdx) => ({
                ...v,
                id: ensureId(v.id),
              })),
              powerpoint: d.powerpoint
                ? { ...d.powerpoint, id: ensureId(d.powerpoint.id) }
                : null,
              quiz: d.quiz
                ? { ...d.quiz, id: ensureId(d.quiz.id) }
                : null,
            };
          }),
        };
      }),
    };
  });
};

export const useFormationStructure = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStructure = useCallback(async (formationId) => {
    if (!formationId) return { data: [], error: null };

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('modules')
      .select(
        `id, formation_id, title, description, sort_order,
         formation_weeks (
           id, module_id, title, sort_order,
           formation_days (
             id, week_id, title, sort_order,
             formation_day_contents (id, day_id, type, sort_order, data)
           )
         )`
      )
      .eq('formation_id', formationId)
      .order('sort_order', { ascending: true })
      .order('sort_order', { foreignTable: 'formation_weeks', ascending: true })
      .order('sort_order', { foreignTable: 'formation_weeks.formation_days', ascending: true })
      .order('sort_order', { foreignTable: 'formation_weeks.formation_days.formation_day_contents', ascending: true });

    if (err) {
      const hint =
        String(err?.message || '').toLowerCase().includes('relation') &&
        String(err?.message || '').toLowerCase().includes('does not exist')
          ? new Error(
              `${err.message} — Vérifie que les tables formation_weeks, formation_days, formation_day_contents existent et que RLS/policies sont appliquées.`
            )
          : err;
      setError(hint);
      setLoading(false);
      return { data: null, error: hint };
    }

    const ui = toUiStructure(data || []);
    setLoading(false);
    return { data: ui, error: null };
  }, []);

  // Plan à plat (modules → leçons) pour les vues détail/lecture d'un cours.
  // Même source studio que fetchStructure, mais aplatie pour l'affichage liste.
  const fetchOutline = useCallback(async (formationId) => {
    if (!formationId) return { data: [], error: null };

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('modules')
      .select(
        `id, title, sort_order,
         formation_weeks (
           id, sort_order,
           formation_days (
             id, sort_order,
             formation_day_contents (id, type, sort_order, data)
           )
         )`
      )
      .eq('formation_id', formationId);

    if (err) {
      setError(err);
      setLoading(false);
      return { data: null, error: err };
    }

    setLoading(false);
    return { data: toOutline(data || []), error: null };
  }, []);

  const saveStructure = useCallback(async (formationId, modules) => {
    if (!formationId) return { error: new Error('formationId is required') };

    setLoading(true);
    setError(null);

    const normalized = normalizeUiIds(modules);

    const { error: deleteErr } = await supabase
      .from('modules')
      .delete()
      .eq('formation_id', formationId);

    if (deleteErr) {
      setError(deleteErr);
      setLoading(false);
      return { error: deleteErr };
    }

    const { modulesInsert, weeksInsert, daysInsert, contentsInsert } = buildDbInserts({
      formationId,
      modules: normalized,
    });

    if (modulesInsert.length > 0) {
      const { error: err } = await supabase.from('modules').insert(modulesInsert);
      if (err) {
        setError(err);
        setLoading(false);
        return { error: err };
      }
    }

    if (weeksInsert.length > 0) {
      const { error: err } = await supabase.from('formation_weeks').insert(weeksInsert);
      if (err) {
        const hint =
          String(err?.message || '').toLowerCase().includes('relation') &&
          String(err?.message || '').toLowerCase().includes('does not exist')
            ? new Error(
                `${err.message} — Tu dois créer la table public.formation_weeks (voir supabase/schema.sql) avant de sauvegarder la structure.`
              )
            : err;
        setError(hint);
        setLoading(false);
        return { error: hint };
      }
    }

    if (daysInsert.length > 0) {
      const { error: err } = await supabase.from('formation_days').insert(daysInsert);
      if (err) {
        const hint =
          String(err?.message || '').toLowerCase().includes('relation') &&
          String(err?.message || '').toLowerCase().includes('does not exist')
            ? new Error(
                `${err.message} — Tu dois créer la table public.formation_days (voir supabase/schema.sql) avant de sauvegarder la structure.`
              )
            : err;
        setError(hint);
        setLoading(false);
        return { error: hint };
      }
    }

    if (contentsInsert.length > 0) {
      const { error: err } = await supabase.from('formation_day_contents').insert(contentsInsert);
      if (err) {
        const hint =
          String(err?.message || '').toLowerCase().includes('relation') &&
          String(err?.message || '').toLowerCase().includes('does not exist')
            ? new Error(
                `${err.message} — Tu dois créer la table public.formation_day_contents (voir supabase/schema.sql) avant de sauvegarder la structure.`
              )
            : err;
        setError(hint);
        setLoading(false);
        return { error: hint };
      }
    }

    setLoading(false);
    return { error: null, data: normalized };
  }, []);

  return {
    loading,
    error,
    fetchStructure,
    fetchOutline,
    saveStructure,
  };
};
