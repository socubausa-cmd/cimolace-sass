import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { coursesApi } from '@/lib/api-v2';
import { BG, INK, STYLE, TERRA } from '@/lib/agent/immersiveTheme';
import { SceneStage } from '@/pages/CimolaceCreationAgent';

/**
 * « Mes formations » RENDU PAR L'OS CIMOLACE.
 *
 * L'OS n'est qu'un moteur de rendu immersif générique : ici on le branche
 * UNIQUEMENT sur les données du moteur de cours (coursesApi) et il en fait le
 * rendu (scènes `cards` → `timeline`). Aucune knowledge Prorascience / Cimolace,
 * aucun marketing, aucun VNP : seulement le contenu des formations.
 */
export default function StudentFormationsOsPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [focusCourse, setFocusCourse] = useState(null); // { course, modules } | null
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    coursesApi.list()
      .then((list) => { if (alive) { setCourses(Array.isArray(list) ? list : []); setLoading(false); } })
      .catch(() => { if (alive) { setCourses([]); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  // relance l'animation d'entrée à chaque changement de scène
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 90);
    return () => clearTimeout(t);
  }, [focusCourse, loading]);

  const modulesOf = (course) => {
    const meta = course?.meta && typeof course.meta === 'object' ? course.meta : {};
    if (Array.isArray(course?.modules)) return course.modules;
    if (Array.isArray(meta.modules)) return meta.modules;
    if (meta.structure && Array.isArray(meta.structure.modules)) return meta.structure.modules;
    return [];
  };

  const openCourse = async (course) => {
    setVisible(false);
    let full = course;
    try {
      const detail = await coursesApi.get(course.id);
      if (detail) full = detail;
    } catch { /* liste suffit si get échoue */ }
    setFocusCourse({ course: full, modules: modulesOf(full) });
  };

  const scene = useMemo(() => {
    if (loading) return null;

    // Niveau 2 — une formation ouverte : frise verticale de ses modules.
    if (focusCourse) {
      const { course, modules } = focusCourse;
      const steps = (modules || []).map((m, i) => {
        const days = (m.weeks || []).reduce((a, w) => a + (w.days || []).length, 0);
        return {
          marker: i + 1,
          kicker: `Module ${i + 1}`,
          title: m.title || `Module ${i + 1}`,
          detail: m.description || (days ? `${days} jour${days > 1 ? 's' : ''}` : ''),
          ref: `open:${course.id}`,
        };
      });
      return {
        type: 'timeline',
        title: course.title || 'Formation',
        steps: steps.length ? steps : [{ marker: 1, kicker: 'Programme', title: 'Ouvrir la formation', detail: 'Accéder au lecteur immersif', ref: `open:${course.id}`, accent: 'terra' }],
      };
    }

    // Niveau 1 — la liste des formations en cartes.
    if (!courses.length) {
      return { type: 'cards', title: 'Mes formations', cards: [{ icon: 'book', title: 'Aucune formation pour l’instant', note: 'Tes formations apparaîtront ici dès qu’elles seront disponibles.' }] };
    }
    return {
      type: 'cards',
      title: 'Mes formations',
      cards: courses.map((c) => ({
        icon: 'grad',
        title: c.title || 'Formation',
        note: c.description || c.cycle || '',
        badge: String(c.status || '').toLowerCase() === 'published' ? undefined : 'Bientôt',
        ref: `course:${c.id}`,
      })),
    };
  }, [loading, focusCourse, courses]);

  const onFocus = (ref) => {
    if (!ref) return;
    if (ref.startsWith('course:')) {
      const id = ref.slice(7);
      const course = courses.find((c) => c.id === id);
      if (course) openCourse(course);
    } else if (ref.startsWith('open:')) {
      navigate(`/formation/${ref.slice(5)}/learn`);
    }
  };

  const back = () => { setVisible(false); setTimeout(() => setFocusCourse(null), 200); };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 'calc(100vh - 120px)', background: BG, color: INK, overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{STYLE}</style>

      {/* particules ambiantes — le vide « respire » */}
      <span className="cca-amb" style={{ width: 5, height: 5, top: '30%', left: '28%', opacity: 0.16, animation: 'ccaDriftA 11s ease-in-out infinite' }} />
      <span className="cca-amb" style={{ width: 4, height: 4, top: '62%', left: '68%', opacity: 0.13, background: '#e6cc92', animation: 'ccaDriftB 14s ease-in-out infinite' }} />
      <span className="cca-amb" style={{ width: 3, height: 3, top: '46%', left: '72%', opacity: 0.12, animation: 'ccaDriftC 9s ease-in-out infinite' }} />

      {focusCourse && (
        <button
          type="button"
          onClick={back}
          style={{ position: 'absolute', top: 18, left: 20, zIndex: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(245,244,238,0.14)', background: 'rgba(38,38,36,.72)', backdropFilter: 'blur(6px)', color: INK, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500 }}
        >
          <ArrowLeft size={14} /> Mes formations
        </button>
      )}

      {loading ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(245,244,238,.5)', fontSize: 14 }}>
          Chargement de vos formations…
        </div>
      ) : (
        scene && (
          <SceneStage
            scene={scene}
            visible={visible}
            onFocus={onFocus}
            onNode={() => {}}
            onAct={() => {}}
            onSuggest={() => {}}
            onCta={() => {}}
            onHook={() => {}}
            suggest={[]}
            acts={[]}
            hooks={[]}
            glossary={{}}
            onTerm={() => {}}
          />
        )
      )}
    </div>
  );
}
