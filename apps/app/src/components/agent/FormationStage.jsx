import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { GraduationCap } from 'lucide-react';
import { STYLE, BG, INK, GOLD, TERRA, SERIF } from '@/lib/agent/immersiveTheme';
import Presence from '@/components/agent/Presence';
import useImmersiveVoice from '@/lib/agent/useImmersiveVoice';
import SketchRenderer from '@/components/school/course-builder/SketchRenderer';
import { resolveAtelierVerdict } from '@/lib/precepteur/judgeAtelier';
import { conformCourseSync } from '@/lib/precepteur/conformCourse';
import { supabase } from '@/lib/supabaseCompat';

/**
 * FormationStage — le SECTEUR « formation » du cerveau immersif Cimolace : Cimolace JOUE un cours
 * dans SA propre coque (présence + voix serif + croquis tracé + rail des concepts), en appelant
 * Le Précepteur pour le contenu. AUCUNE interface propre au Précepteur, AUCUN bouton, AUCUN menu :
 * ça coule tout seul et on parle à la présence.
 *
 * - leçon / transition / amorce → la présence NARRE (voix serif typewriter).
 * - surlignage → mot-clé surligné dans la voix ; encadré → énoncé encadré ; résumé → liste.
 * - croquis → SketchRenderer tracé (traits colorés sur la coque sombre).
 * - atelier → CONVERSATION : la présence interpelle, l'élève répond (parler à la présence), révélation.
 * - « parler à la présence » (type-anywhere) → question bornée au cours (edge precepteur-brain).
 *
 * Le cours (conformCourse) = la matière garantie ; le rendu = celui de Cimolace.
 */
function sceneSpeech(sc) {
  if (!sc) return '';
  switch (sc.type) {
    case 'lecon': return String(sc.board_text || sc.narration || '');
    case 'surlignage': return String(sc.text || sc.narration || '');
    case 'encadre': return String(sc.text || sc.narration || '');
    case 'resume_encadre': return String(sc.narration || 'Ce qu’il faut retenir.');
    case 'image_analogie': return String(sc.analogie || sc.narration || '');
    default: return String(sc.narration || sc.board_text || '');
  }
}

// Surligne le terme dans le texte narré (mot-clé Sherpas), sans dépendance externe.
function withHighlight(text, term) {
  const t = String(text || '');
  const k = String(term || '').trim();
  if (!k) return t;
  const i = t.toLowerCase().indexOf(k.toLowerCase());
  if (i < 0) return t;
  return (
    <>
      {t.slice(0, i)}
      <span style={{ color: '#2a140c', background: GOLD, borderRadius: 4, padding: '0 5px', fontWeight: 700 }}>{t.slice(i, i + k.length)}</span>
      {t.slice(i + k.length)}
    </>
  );
}

export default function FormationStage({ course }) {
  const conformed = useMemo(() => (course ? conformCourseSync(course).course : null), [course]);
  const concepts = conformed?.concepts || [];
  const scenes = useMemo(() => (
    concepts.flatMap((c, ci) => (c.scenes || []).map((s) => ({ ...s, conceptIdx: ci })))
  ), [concepts]);
  const knowledge = useMemo(() => ({
    title: conformed?.title || 'Cours',
    concepts: concepts.map((c) => {
      const l = (c.scenes || []).find((s) => s && s.type === 'lecon');
      return { title: c.title || '', lesson: String(l?.board_text || l?.narration || '').slice(0, 700) };
    }),
  }), [conformed, concepts]);

  const { presence, setPresence, message, speak, think, muted, setMuted, sPop, sChime } = useImmersiveVoice();

  const [name, setName] = useState('');
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [idx, setIdx] = useState(0);
  const [activeConcept, setActiveConcept] = useState(0);
  const [awaitingAnswer, setAwaitingAnswer] = useState(false);

  const [inputOpen, setInputOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const advancedRef = useRef(false);
  const capRef = useRef(null);
  const postRef = useRef(null);
  const askGen = useRef(0);

  const sc = scenes[idx] || null;

  const openInput = useCallback((prefill = '') => {
    setInputOpen(true); setValue(prefill);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);
  const closeInput = useCallback(() => { setInputOpen(false); setValue(''); }, []);

  const advance = useCallback(() => {
    setIdx((i) => {
      const next = i + 1;
      if (next >= scenes.length) { setDone(true); return i; }
      return next;
    });
  }, [scenes.length]);

  // Éveil : la présence salue puis LANCE le cours toute seule (ça coule, zéro bouton, zéro saisie).
  useEffect(() => {
    const t = setTimeout(() => {
      speak(`${knowledge.title}. Installe-toi — on commence.`, () => {
        setTimeout(() => { setStarted(true); setIdx(0); }, 900);
      });
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lecture d'une scène : narration + visuel + avance (sauf atelier, qui attend une réponse).
  useEffect(() => {
    if (!started || done || !sc) return undefined;
    advancedRef.current = false;
    setActiveConcept(sc.conceptIdx || 0);
    const go = () => { if (advancedRef.current) return; advancedRef.current = true; clearTimeout(capRef.current); clearTimeout(postRef.current); advance(); };

    if (sc.type === 'atelier') {
      setAwaitingAnswer(true);
      setPresence('attente');
      const q = String(sc.question || '').replace('{{student_name}}', name || '').trim() || 'Que retiens-tu de tout ça ?';
      speak((name ? name + '. ' : '') + q, () => openInput());
      return () => { advancedRef.current = true; };
    }
    setAwaitingAnswer(false);

    if (sc.type === 'croquis') {
      setPresence('reflexion');
      const cap = sc.sketch?.caption || sc.narration || '';
      if (cap) speak(cap);
      const n = sc.sketch?.elements?.length || 3;
      postRef.current = setTimeout(go, n * 900 + 2800);
      return () => { advancedRef.current = true; clearTimeout(postRef.current); };
    }

    const text = sceneSpeech(sc);
    if (text) speak(text, () => { postRef.current = setTimeout(go, 1100); });
    else { setPresence('attente'); postRef.current = setTimeout(go, 900); }
    capRef.current = setTimeout(go, Math.max(text.length * 55, 2000) + 8000);
    return () => { advancedRef.current = true; clearTimeout(capRef.current); clearTimeout(postRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, started, done]);

  useEffect(() => { if (done) { setPresence('pret'); sChime?.(); } }, [done, setPresence, sChime]);

  // Répondre à l'atelier (juge local heuristique — public, sans auth).
  const answerAtelier = useCallback((a) => {
    if (!sc || sc.type !== 'atelier') return;
    setAwaitingAnswer(false);
    sPop?.();
    const { ack } = resolveAtelierVerdict(sc, a, null);
    speak(ack || 'Voyons cela ensemble.', () => {
      postRef.current = setTimeout(() => {
        speak(String(sc.reveal_narration || 'Voilà l’essentiel de ce qu’on vient de voir.'), () => {
          postRef.current = setTimeout(() => { advancedRef.current = false; advance(); }, 1100);
        });
      }, 700);
    });
  }, [sc, speak, sPop, advance]);

  // Question libre bornée au cours (edge precepteur-brain). Ne bloque pas le cours.
  const ask = useCallback(async (q) => {
    const gen = ++askGen.current;
    setPresence('reflexion');
    try {
      const { data, error } = await supabase.functions.invoke('precepteur-brain', {
        body: { question: q, course: knowledge, concept: concepts[activeConcept]?.title || null },
      });
      if (askGen.current !== gen) return;
      if (error) throw error;
      speak(String(data?.reply || 'Restons sur le cours — reformule ta question ?'));
    } catch {
      if (askGen.current !== gen) return;
      speak('Je reste sur le cours — je n’ai pas pu répondre à l’instant.');
    }
  }, [knowledge, concepts, activeConcept, speak, setPresence]);

  const submit = useCallback(() => {
    const v = value.trim();
    closeInput();
    if (!v) return;
    if (awaitingAnswer) { answerAtelier(v); return; }
    ask(v);
  }, [value, awaitingAnswer, closeInput, answerAtelier, ask]);

  // Type-anywhere : taper une lettre matérialise le champ.
  useEffect(() => {
    const onKey = (e) => {
      if (inputOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key && e.key.length === 1) openInput(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputOpen, openInput]);

  if (!conformed) return null;

  const showResume = sc?.type === 'resume_encadre' && Array.isArray(sc.points) && sc.points.length;
  const framed = sc?.type === 'encadre';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !inputOpen) openInput(); }}
      style={{
        position: 'relative', minHeight: '100vh', overflow: 'hidden',
        background: `radial-gradient(1200px 720px at 50% -6%, #2c2b28, ${BG})`,
        fontFamily: "'Inter', system-ui, sans-serif", cursor: inputOpen ? 'default' : 'text',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 22px',
      }}
    >
      <style>{STYLE}</style>
      <span className="cca-amb" style={{ width: 5, height: 5, top: '28%', left: '30%', opacity: 0.14, animation: 'ccaDriftA 11s ease-in-out infinite' }} />
      <span className="cca-amb" style={{ width: 4, height: 4, top: '64%', left: '68%', opacity: 0.12, background: GOLD, animation: 'ccaDriftB 14s ease-in-out infinite' }} />

      {/* Identité (le secteur courant du cerveau) */}
      <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 7, opacity: 0.8 }}>
        <GraduationCap size={15} color={GOLD} />
        <span style={{ fontSize: 10.5, letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700, color: GOLD }}>Cimolace · mode formation</span>
      </div>

      {/* Rail des concepts (le fil + le score de couverture) */}
      {started && concepts.length > 1 && (
        <div className="cca-in" style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 150 }}>
          <span style={{ fontSize: 9, color: 'rgba(244,239,230,.3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Le fil du cours</span>
          {concepts.map((c, ci) => (
            <span key={ci} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: ci === activeConcept ? INK : ci < activeConcept ? GOLD : 'rgba(244,239,230,.38)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: ci === activeConcept ? TERRA : ci < activeConcept ? GOLD : 'rgba(244,239,230,.22)' }} />
              {c.title || `Concept ${ci + 1}`}
            </span>
          ))}
        </div>
      )}

      {/* La présence (le professeur) */}
      <div style={{ pointerEvents: 'none' }}><Presence state={presence} /></div>

      {/* Le croquis, tracé dans la coque */}
      {sc?.type === 'croquis' && sc.sketch?.elements?.length ? (
        <div key={idx} className="cca-in" style={{ width: 'min(560px, 82vw)', height: 300, marginTop: 4 }}>
          <SketchRenderer sketch={sc.sketch} play />
        </div>
      ) : null}

      {/* La voix (serif) — la narration. Encadrée pour un `encadre`, avec liste pour un résumé. */}
      <div style={{ minHeight: 40, marginTop: 12, textAlign: 'center', maxWidth: 560, position: 'relative', zIndex: 2 }}>
        {message ? (
          <div className="cca-in" style={framed ? { border: `1.5px solid ${TERRA}55`, borderRadius: 16, padding: '14px 20px', background: 'rgba(217,119,87,.06)' } : undefined}>
            <p style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.55, color: INK, margin: 0 }}>
              {sc?.type === 'surlignage' ? withHighlight(message, sc.term) : message}
              {(presence === 'ecriture' || presence === 'attente') && <span className="cca-caret" />}
            </p>
            {showResume && (
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', textAlign: 'left', display: 'inline-block' }}>
                {sc.points.map((p, i) => (
                  <li key={i} style={{ fontFamily: SERIF, fontSize: 16, color: 'rgba(244,239,230,.85)', margin: '4px 0', paddingLeft: 16, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: GOLD }}>·</span>{p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          !started && <span style={{ fontSize: 12, color: 'rgba(244,239,230,.4)' }}>touche l’écran pour parler</span>
        )}
      </div>

      {/* Fin */}
      {done && (
        <p className="cca-in" style={{ fontFamily: SERIF, fontSize: 15, color: 'rgba(244,239,230,.5)', marginTop: 10 }}>Cours terminé. Reste avec moi — pose-moi une question.</p>
      )}

      {/* Mute */}
      <button onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }} aria-label={muted ? 'Activer le son' : 'Couper le son'}
        style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'rgba(244,239,230,.4)', cursor: 'pointer', fontSize: 15 }}>
        {muted ? '🔇' : '🔊'}
      </button>

      {/* Parler à la présence */}
      {inputOpen && (
        <div className="cca-in" onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', left: '50%', bottom: 96, transform: 'translateX(-50%)', width: 'min(460px, 88vw)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(38,38,36,.96)', boxShadow: '0 8px 30px rgba(0,0,0,.4)', borderRadius: 14, padding: '8px 8px 8px 15px', zIndex: 20 }}>
          <input ref={inputRef} className="cca-field" value={value} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } else if (e.key === 'Escape') closeInput(); }}
            placeholder={awaitingAnswer ? 'Ta réponse…' : 'Parle à la présence…'}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: INK, fontSize: 14, fontFamily: 'inherit' }} />
          <button onClick={submit} aria-label="Envoyer" style={{ width: 32, height: 32, borderRadius: 9, background: TERRA, color: '#2a140c', border: 'none', cursor: 'pointer' }}>↑</button>
        </div>
      )}
    </div>
  );
}
