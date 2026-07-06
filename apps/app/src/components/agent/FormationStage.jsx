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

// Mot-clé FORT d'une scène (style Sherpas) : terme surligné explicite, sinon terme entre «…».
function sceneKeyword(sc) {
  if (!sc) return '';
  if (sc.type === 'surlignage' && sc.term) return String(sc.term);
  const q = String(sceneSpeech(sc)).match(/«\s*([^»]{2,40})\s*»/);
  return q ? q[1].trim() : '';
}

// Polices composites (Fraunces/Inter déjà chargées par l'app ; les autres via Google Fonts).
const F_GROTESQUE = "'Bricolage Grotesque', system-ui, sans-serif";
const F_SERIF_BODY = "'Source Serif 4', Georgia, serif";

// Styles typographiques comparables LIVE via ?typo=punch|hybride|temple (défaut = punch).
const TYPO = {
  punch: { body: F_SERIF_BODY, weight: 400, keyFont: F_GROTESQUE, upper: true },   // Sherpas max
  hybride: { body: SERIF, weight: 600, keyFont: F_GROTESQUE, upper: true },          // voix temple + mot-clé punch
  temple: { body: SERIF, weight: 600, keyFont: SERIF, upper: false },                // tout Fraunces
};
function currentTypo() {
  try { return TYPO[new URLSearchParams(window.location.search).get('typo')] || TYPO.punch; }
  catch { return TYPO.punch; }
}

// CSS local du rendu « Sherpas » (mot qui pop + boîte dorée du mot-clé) + chargement des polices.
const SV_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap');
@keyframes svPop{from{opacity:.12;transform:translateY(8px) scale(.88)}to{opacity:1;transform:none}}
.sv-w{display:inline-block}
.sv-pop{animation:svPop .3s cubic-bezier(.16,1,.3,1) both}
.sv-key{color:#2a140c;background:${GOLD};border-radius:9px;padding:0 9px;font-weight:800;-webkit-box-decoration-break:clone;box-decoration-break:clone}
`;

/**
 * SherpasVoice — la voix serif rendue « à la Sherpas » : gros + gras, chaque mot RÉVÉLÉ
 * un à un (le dernier « pop »), et le mot-clé dans une BOÎTE DORÉE (notre équivalent du vert Sherpas).
 * `text` est le message déjà révélé mot à mot par speak() ; keyword = le terme fort à mettre en boîte.
 */
function SherpasVoice({ text, keyword, live, typo }) {
  const t = typo || TYPO.punch;
  const words = String(text || '').split(' ').filter(Boolean);
  const keys = new Set(String(keyword || '').toLowerCase().split(/\s+/).filter((w) => w.length > 1));
  return (
    <p style={{ fontFamily: t.body, fontSize: 'clamp(22px, 4.8vw, 32px)', fontWeight: t.weight, lineHeight: 1.32, letterSpacing: '-0.015em', color: INK, margin: 0 }}>
      {words.map((w, i) => {
        const bare = w.toLowerCase().replace(/[.,;:!?«»"'’—()…]/g, '');
        const isKey = keys.has(bare);
        const last = i === words.length - 1;
        return (
          <React.Fragment key={i}>
            <span
              className={`sv-w${last ? ' sv-pop' : ''}${isKey ? ' sv-key' : ''}`}
              style={isKey ? { fontFamily: t.keyFont, textTransform: t.upper ? 'uppercase' : 'none' } : undefined}
            >{w}</span>
            {i < words.length - 1 ? ' ' : ''}
          </React.Fragment>
        );
      })}
      {live ? <span className="cca-caret" /> : null}
    </p>
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
  const typo = useMemo(() => currentTypo(), []); // style typo (?typo=punch|hybride|temple)

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
        position: 'fixed', inset: 0, zIndex: 4000, overflow: 'hidden',
        background: `radial-gradient(1200px 720px at 50% -6%, #2c2b28, ${BG})`,
        fontFamily: "'Inter', system-ui, sans-serif", cursor: inputOpen ? 'default' : 'text',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 22px',
      }}
    >
      <style>{STYLE}</style>
      <style>{SV_STYLE}</style>
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

      {/* La voix (serif) rendue « Sherpas » : gros/gras, mots qui pop + mot-clé en boîte dorée. */}
      <div style={{ minHeight: 44, marginTop: 12, textAlign: 'center', maxWidth: 680, position: 'relative', zIndex: 2 }}>
        {message ? (
          <div className="cca-in" style={framed ? { border: `1.5px solid ${TERRA}55`, borderRadius: 18, padding: '18px 24px', background: 'rgba(217,119,87,.06)' } : undefined}>
            <SherpasVoice text={message} keyword={sceneKeyword(sc)} live={presence === 'ecriture' || presence === 'attente'} typo={typo} />
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

      {/* Sortie discrète (on couvre le chrome de l'app → il faut pouvoir quitter) */}
      <button onClick={(e) => { e.stopPropagation(); if (window.history.length > 1) window.history.back(); else window.location.assign('/'); }} aria-label="Quitter"
        style={{ position: 'absolute', top: 15, left: 16, background: 'transparent', border: 'none', color: 'rgba(244,239,230,.4)', cursor: 'pointer', fontSize: 18, lineHeight: 1, zIndex: 21 }}>✕</button>

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
