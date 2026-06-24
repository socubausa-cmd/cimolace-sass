import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Volume2, Play, RotateCcw, Check, PenLine } from 'lucide-react';
import {
  Handwriting, speakText, cancelSpeech, canSpeak, estSpeechMs, primeSpeech,
} from '@/components/school/course-builder/TableauVivant';
import SketchRenderer from '@/components/school/course-builder/SketchRenderer';
import AnimatedExample from '@/components/school/course-builder/AnimatedExample';
import AtelierPrompt from '@/components/school/course-builder/AtelierPrompt';
import { CANONICAL_COURSE } from './precepteurCanonicalCourse';

/**
 * LE PRÉCEPTEUR — lecteur immersif (preuve « temps → spirale »).
 * cf. docs/CAHIER_DE_CHARGE_PRECEPTEUR.md. Route publique /precepteur.
 *
 * Joue la partition scène par scène : leçon écrite à la main + voix → amorce →
 * croquis vectoriel tracé main (balayage) → atelier nominatif (saisie) → analogie animée.
 */

const EXPO = [0.16, 1, 0.3, 1];

function Board({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99, filter: 'blur(2px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, ease: EXPO }}
      className={`relative w-full max-w-4xl overflow-hidden rounded-[28px] bg-white p-7 shadow-2xl ring-1 ring-black/5 md:p-10 ${className}`}
    >
      <div className="pointer-events-none absolute right-5 top-5 flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
        </span>
        <span className="text-[11px] font-semibold text-slate-500">Le Précepteur</span>
      </div>
      {children}
    </motion.div>
  );
}

export default function PrecepteurDemoPage() {
  const course = CANONICAL_COURSE;
  const scenes = useMemo(
    () => course.concepts.flatMap((c) => c.scenes.map((s) => ({ ...s, conceptTitle: c.title }))),
    [course],
  );

  const [started, setStarted] = useState(false);
  const [name, setName] = useState('');
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const speak = canSpeak();

  const sc = scenes[idx];
  const advance = useCallback(() => {
    setIdx((i) => {
      if (i >= scenes.length - 1) { setDone(true); return i; }
      return i + 1;
    });
  }, [scenes.length]);

  // Cadence auto pour les scènes NON interactives (l'atelier s'avance lui-même).
  useEffect(() => {
    if (!started || done || !sc) return undefined;
    if (sc.type === 'atelier') return undefined;
    const narration = sc.narration || sc.board_text || '';
    if (speak && narration) speakText(narration);
    const speechMs = narration ? estSpeechMs(narration) : 1600;
    let ms = speechMs + 800;
    if (sc.type === 'croquis') ms = Math.max((sc.sketch?.elements?.length || 1) * 1400 + 1000, speechMs) + 900;
    else if (sc.type === 'image_analogie') ms = speechMs + 2400;
    else if (sc.type === 'amorce_croquis') ms = speechMs + 400;
    else if (sc.type === 'transition') ms = speechMs + 500;
    const id = window.setTimeout(advance, ms);
    return () => { window.clearTimeout(id); if (speak) cancelSpeech(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, started, done]);

  const begin = () => { primeSpeech(); setStarted(true); };
  const replay = () => { setDone(false); setStarted(true); setIdx(0); };

  // --- rendu d'une scène ---
  const renderScene = (s) => {
    if (s.type === 'lecon') {
      const txt = s.board_text || '';
      const perChar = speak ? Math.max(26, Math.min(70, Math.round((estSpeechMs(s.narration || txt) * 0.7) / Math.max(1, txt.length)))) : 18;
      return (
        <Board>
          {s.title ? <h2 className="mb-3 text-xl font-extrabold text-slate-900 md:text-2xl">{s.title}</h2> : null}
          <div className="text-[17px] leading-relaxed text-slate-700 md:text-lg">
            <Handwriting text={txt} perCharMs={perChar} writing />
          </div>
        </Board>
      );
    }
    if (s.type === 'amorce_croquis') {
      return (
        <Board className="text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-amber-700">
            <PenLine className="h-5 w-5" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Au tableau</span>
          </div>
          <div className="text-2xl font-bold italic text-slate-800 md:text-3xl">
            <Handwriting text={s.narration} perCharMs={speak ? 46 : 24} writing />
          </div>
        </Board>
      );
    }
    if (s.type === 'croquis') {
      return (
        <Board>
          <div className="h-[58vh] max-h-[460px] w-full">
            <SketchRenderer sketch={s.sketch} play />
          </div>
          {s.narration ? <p className="mt-3 text-center text-sm leading-relaxed text-slate-500">{s.narration}</p> : null}
        </Board>
      );
    }
    if (s.type === 'image_analogie') {
      return (
        <Board>
          <div className="grid items-center gap-6 md:grid-cols-2">
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Pour faire asseoir l’idée</div>
              <p className="text-[17px] leading-relaxed text-slate-700 md:text-lg">{s.analogie}</p>
            </div>
            <AnimatedExample subject={s.animated_example?.subject} caption={s.animated_example?.caption} />
          </div>
        </Board>
      );
    }
    if (s.type === 'atelier') {
      return (
        <div className="w-full max-w-4xl">
          <AtelierPrompt scene={s} studentName={name} speak={speak} onContinue={advance} />
        </div>
      );
    }
    // transition
    return (
      <Board className="text-center">
        <p className="text-xl font-medium italic text-slate-600 md:text-2xl">{s.narration}</p>
      </Board>
    );
  };

  const strong = sc && (sc.type === 'croquis' || sc.type === 'image_analogie');

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0f17] px-4 py-6 md:py-8" style={{ '--school-accent': '#d4a36a' }}>
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
        {/* En-tête */}
        <div className="mb-4 flex items-center justify-center gap-2 text-amber-400/90">
          <GraduationCap className="h-5 w-5" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Le Précepteur · cours enseigné</span>
        </div>

        {/* Progression */}
        {started && !done ? (
          <div className="mb-5 flex items-center justify-center gap-1.5">
            {scenes.map((_, i) => (
              <span key={i} className={`h-1 rounded-full transition-all ${i === idx ? 'w-7 bg-[var(--school-accent)]' : i < idx ? 'w-3 bg-white/35' : 'w-3 bg-white/12'}`} />
            ))}
          </div>
        ) : null}

        <div className="flex flex-1 items-center justify-center">
          {!started && !done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EXPO }}
              className="w-full max-w-lg rounded-[28px] border border-white/10 bg-gradient-to-b from-[#11161f] to-[#0c1119] p-9 text-center shadow-2xl md:p-12"
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--school-accent)]/15 text-[var(--school-accent)]">
                <Volume2 className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-white md:text-3xl">{course.title}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/55">
                Cours <strong className="text-white/80">narré et dessiné à la main</strong>. Le professeur t’appellera par ton prénom. Monte le son 🔊.
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') begin(); }}
                placeholder="Ton prénom (ex. Badika)"
                className="mt-6 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-base text-white outline-none placeholder:text-white/30 focus:border-[var(--school-accent)]"
              />
              <button
                type="button"
                onClick={begin}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--school-accent)] px-7 py-3 text-base font-bold text-black hover:opacity-90"
              >
                <Play className="h-5 w-5" /> Commencer le cours
              </button>
            </motion.div>
          ) : done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EXPO }}
              className="w-full max-w-lg rounded-[28px] border border-white/10 bg-gradient-to-b from-[#11161f] to-[#0c1119] p-12 text-center shadow-2xl"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--school-accent)]/15 text-[var(--school-accent)]">
                <Check className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-extrabold text-white">Cours terminé</h2>
              <p className="mt-2 text-sm text-white/50">Le temps courbé par l’espace — leçon, croquis, atelier et analogie.</p>
              <button type="button" onClick={replay} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--school-accent)] px-5 py-2.5 text-sm font-bold text-black hover:opacity-90">
                <RotateCcw className="h-4 w-4" /> Revoir le cours
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={idx}
              initial={{ x: strong ? '55%' : '7%', opacity: 0, filter: 'blur(3px)' }}
              animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: strong ? 0.6 : 0.45, ease: EXPO }}
              className="flex w-full justify-center"
            >
              {renderScene(sc)}
            </motion.div>
          )}
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-white/35">
          Démo « Le Précepteur » — leçon → amorce → croquis dessiné (balayage) → atelier nominatif → analogie animée.
          Voix off : synthèse du navigateur (en production : ElevenLabs).
        </p>
      </div>
    </div>
  );
}
