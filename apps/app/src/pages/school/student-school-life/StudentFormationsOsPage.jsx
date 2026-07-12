import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUp } from 'lucide-react';
import { coursesApi } from '@/lib/api-v2';
import { BG, INK, STYLE, TERRA, SERIF } from '@/lib/agent/immersiveTheme';
import { SceneStage } from '@/pages/CimolaceCreationAgent';
import FormationOsDayView from './FormationOsDayView';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * « Mes formations » RENDU PAR L'OS CIMOLACE.
 *
 * L'OS n'est qu'un moteur de rendu immersif générique : ici on le branche
 * UNIQUEMENT sur les données du moteur de cours (coursesApi) et il en fait le
 * rendu (scènes `cards` → `timeline`). Aucune knowledge Prorascience / Cimolace,
 * aucun marketing, aucun VNP : seulement le contenu des formations.
 */
export default function StudentFormationsOsPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [focusCourse, setFocusCourse] = useState(null); // { course, modules } | null — niveau 2 (frise modules)
  const [focusModule, setFocusModule] = useState(null); // { course, module, mIdx } | null — niveau 3 (jours)
  const [openDay, setOpenDay] = useState(null); // { day, moduleTitle } | null — niveau 4 (jour rendu NATIVEMENT par l'OS)
  const [visible, setVisible] = useState(false);
  const [chat, setChat] = useState('');
  const [reply, setReply] = useState(null); // réponse « voix » de l'OS

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
  }, [focusCourse, focusModule, loading]);

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

  // Aplatit les jours d'un module (semaines → jours) avec un libellé lisible.
  const daysOfModule = (module) => {
    const out = [];
    (module?.weeks || []).forEach((w, wi) => {
      (w.days || []).forEach((d, di) => {
        out.push({ day: d, weekIdx: wi, dayIdx: di, weekTitle: w.title || `Semaine ${wi + 1}` });
      });
    });
    return out;
  };

  const scene = useMemo(() => {
    if (loading) return null;

    // Niveau 3 — un module ouvert : cartes de ses jours (vidéo / support / quiz).
    if (focusModule) {
      const { course, module } = focusModule;
      const list = daysOfModule(module);
      return {
        type: 'cards',
        title: module.title || 'Module',
        cards: list.length ? list.map((it, i) => {
          const d = it.day || {};
          const bits = [];
          if ((Array.isArray(d.videos) ? d.videos.length : (d.video ? 1 : 0))) bits.push('Vidéo');
          if (d.powerpoint || d.reader) bits.push('Support');
          if (d.quiz) bits.push('Quiz');
          if (d.mindmap || d.videos?.some?.((v) => v.mindmap)) bits.push('Mindmap');
          return {
            icon: 'book',
            title: d.title || `Jour ${i + 1}`,
            note: [it.weekTitle, bits.join(' · ')].filter(Boolean).join(' — '),
            ref: `day:${i}`,
          };
        }) : [{ icon: 'book', title: 'Aucun jour', note: 'Le contenu de ce module arrive bientôt.' }],
      };
    }

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
          ref: `module:${i}`,
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
  }, [loading, focusCourse, focusModule, courses]);

  const onFocus = (ref) => {
    if (!ref) return;
    if (ref.startsWith('course:')) {
      const id = ref.slice(7);
      const course = courses.find((c) => c.id === id);
      if (course) openCourse(course);
    } else if (ref.startsWith('module:')) {
      const mIdx = Number(ref.slice(7));
      const module = focusCourse?.modules?.[mIdx];
      if (module) { setVisible(false); setTimeout(() => setFocusModule({ course: focusCourse.course, module, mIdx }), 200); }
    } else if (ref.startsWith('day:')) {
      const dIdx = Number(ref.slice(4));
      const entry = focusModule ? daysOfModule(focusModule.module)[dIdx] : null;
      if (entry?.day) setOpenDay({ day: entry.day, moduleTitle: focusModule?.module?.title || 'Programme' });
    }
  };

  // Retour hiérarchique : jours → modules → liste.
  const back = () => {
    setVisible(false);
    setTimeout(() => {
      if (focusModule) setFocusModule(null);
      else setFocusCourse(null);
    }, 200);
  };
  const backLabel = focusModule ? (focusCourse?.course?.title || 'Formation') : 'Mes formations';

  // Conversation OS — l'élève parle à l'OS ; intents locaux scopés aux cours (navigation intelligente).
  const onAsk = (e) => {
    if (e) e.preventDefault();
    const raw = chat.trim();
    if (!raw) return;
    const t = norm(raw);
    setChat('');

    if (/(retour|accueil|mes formations|ma liste|liste des|toutes les)/.test(t)) {
      setOpenDay(null); setFocusModule(null); setFocusCourse(null);
      setReply('Voici toutes tes formations.');
      return;
    }
    const jm = t.match(/jour\s*(\d+)/);
    if (jm && focusModule) {
      const entry = daysOfModule(focusModule.module)[Number(jm[1]) - 1];
      if (entry?.day) { setOpenDay({ day: entry.day, moduleTitle: focusModule.module.title }); setReply(`J'ouvre : ${entry.day.title || 'Jour ' + jm[1]}.`); return; }
    }
    const mm = t.match(/module\s*(\d+)/);
    if (mm && focusCourse) {
      const i = Number(mm[1]) - 1;
      const module = focusCourse.modules?.[i];
      if (module) { setOpenDay(null); setVisible(false); setTimeout(() => setFocusModule({ course: focusCourse.course, module, mIdx: i }), 150); setReply(`Module ${i + 1} — ${module.title}.`); return; }
    }
    const cm = courses.find((c) => {
      const ct = norm(c.title);
      return ct && (ct.includes(t) || t.split(' ').some((w) => w.length > 3 && ct.includes(w)));
    });
    if (cm) { openCourse(cm); setReply(`J'ouvre la formation « ${cm.title} ».`); return; }

    if (/(quiz|video|mindmap|carte mentale|support)/.test(t)) {
      setReply(openDay ? 'Choisis le bloc avec les pastilles en haut du jour.' : 'Ouvre d\'abord un jour, puis choisis Vidéo · Support · Quiz · Mindmap.');
      return;
    }
    setReply('Dis-moi une formation par son nom, ou « ouvre le module 2 », « montre le jour 1 » — je t\'y emmène.');
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 'calc(100vh - 120px)', background: BG, color: INK, overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{STYLE}</style>

      {/* Niveau 4 — le JOUR rendu NATIVEMENT par l'OS (vidéo bord-à-bord, support en scène reader, quiz natif) : aucune carte */}
      {openDay && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: BG }}>
          <FormationOsDayView day={openDay.day} backLabel={openDay.moduleTitle} onBack={() => setOpenDay(null)} />
        </div>
      )}

      {/* particules ambiantes — le vide « respire » */}
      <span className="cca-amb" style={{ width: 5, height: 5, top: '30%', left: '28%', opacity: 0.16, animation: 'ccaDriftA 11s ease-in-out infinite' }} />
      <span className="cca-amb" style={{ width: 4, height: 4, top: '62%', left: '68%', opacity: 0.13, background: '#e6cc92', animation: 'ccaDriftB 14s ease-in-out infinite' }} />
      <span className="cca-amb" style={{ width: 3, height: 3, top: '46%', left: '72%', opacity: 0.12, animation: 'ccaDriftC 9s ease-in-out infinite' }} />

      {(focusCourse || focusModule) && (
        <button
          type="button"
          onClick={back}
          style={{ position: 'absolute', top: 18, left: 20, zIndex: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(245,244,238,0.14)', background: 'rgba(38,38,36,.72)', backdropFilter: 'blur(6px)', color: INK, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          <ArrowLeft size={14} /> {backLabel}
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

      {/* Conversation OS — présence + champ de saisie pour parler à l'OS (masqué quand un jour est ouvert) */}
      {!openDay && !loading && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 clamp(16px,6vw,90px) 22px', zIndex: 12, pointerEvents: 'none' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', pointerEvents: 'auto' }}>
            {reply && (
              <div style={{ marginBottom: 12, fontFamily: SERIF, fontSize: 16, color: 'rgba(245,244,238,.85)', textAlign: 'center', lineHeight: 1.4 }}>{reply}</div>
            )}
            <form onSubmit={onAsk} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 7px 7px 16px', borderRadius: 999, border: '1px solid rgba(245,244,238,.12)', background: 'rgba(31,30,28,.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 12px 44px rgba(0,0,0,.42)' }}>
              <span style={{ position: 'relative', width: 9, height: 9, flexShrink: 0 }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: TERRA }} />
                <span style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '1.5px solid rgba(217,119,87,.4)', animation: 'ccaPing 1.9s ease-out infinite' }} />
              </span>
              <input
                value={chat}
                onChange={(e) => setChat(e.target.value)}
                placeholder="Parle à l'OS : « ouvre le module 2 », « montre le jour 1 »…"
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: INK, fontFamily: 'inherit', fontSize: 14.5 }}
                aria-label="Parler à l'OS"
              />
              <button type="submit" disabled={!chat.trim()} aria-label="Envoyer"
                style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', border: 'none', background: chat.trim() ? TERRA : 'rgba(245,244,238,.08)', color: chat.trim() ? '#231208' : 'rgba(245,244,238,.4)', cursor: chat.trim() ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all .18s ease' }}>
                <ArrowUp size={17} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
