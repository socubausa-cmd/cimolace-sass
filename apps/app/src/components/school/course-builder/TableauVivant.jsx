import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Pause, Play } from 'lucide-react';

/**
 * LE TABLEAU VIVANT — cf. docs/CAHIER_DE_CHARGE_TABLEAU_VIVANT.md
 *
 * Reproduit le geste d'un PROF qui enseigne au tableau : affichage SEQUENTIEL
 * (un bloc a la fois), le texte S'ECRIT (cascade facon main), le passage actif
 * est SURLIGNE, les accents sont DESSINES A LA MAIN (trace SVG), et les
 * « a retenir » s'affichent en GROS PLAN.
 *
 * Cette version cadence les blocs sur une estimation de debit de parole. La
 * synchro fine avec la VRAIE voix off (TTS) est le Lot 1/3 du CDC : il suffira
 * de remplacer speakMs() par les reperes temporels de l'audio.
 */

// Duree de « narration » estimee d'un texte (~ debit d'un prof).
const speakMs = (text) => Math.max(1100, Math.min(8000, String(text || '').length * 52));

const EASE = [0.22, 1, 0.36, 1];

// Texte qui « s'ecrit » : cascade caractere par caractere, groupee par MOTS
// (inline-block) pour garder un retour a la ligne propre, + plume au bout.
function Handwriting({ text, perCharMs = 24, writing }) {
  const words = String(text || '').split(' ');
  let gi = 0; // index global pour cadencer la cascade a travers les mots
  return (
    <span aria-label={text} className="relative">
      {words.map((w, wi) => {
        const word = (
          <span className="inline-block">
            {[...w].map((c, ci) => {
              const delay = gi * (perCharMs / 1000);
              gi += 1;
              return (
                <motion.span
                  key={ci}
                  aria-hidden
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.08, delay }}
                >
                  {c}
                </motion.span>
              );
            })}
          </span>
        );
        gi += 1;
        return (
          <React.Fragment key={wi}>
            {word}
            {wi < words.length - 1 ? ' ' : null}
          </React.Fragment>
        );
      })}
      {writing ? (
        <motion.span
          aria-hidden
          className="ml-[1px] inline-block h-[1em] w-[2px] rounded-full bg-blue-600/80 align-text-bottom"
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      ) : null}
    </span>
  );
}

// Soulignage « trace a la main » qui se dessine sous un titre.
function HandUnderline({ play }) {
  return (
    <svg viewBox="0 0 320 12" className="mt-1 h-3 w-[min(320px,80%)]" fill="none" aria-hidden>
      <motion.path
        d="M2 7 C 60 2, 110 11, 170 6 S 280 3, 318 8"
        stroke="var(--school-accent, #d4a36a)"
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0.9 }}
        animate={play ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      />
    </svg>
  );
}

// Ideogramme dessine a la main (cercle + fleche + noeud) — trace progressif.
function HandDrawnDiagram({ play }) {
  const draw = (delay) => ({
    initial: { pathLength: 0, opacity: 0.95 },
    animate: play ? { pathLength: 1 } : { pathLength: 0 },
    transition: { duration: 0.8, ease: EASE, delay },
  });
  return (
    <svg viewBox="0 0 200 120" className="h-28 w-full" fill="none" aria-hidden>
      <motion.circle cx="60" cy="60" r="34" stroke="#2563eb" strokeWidth="2.5" {...draw(0)} />
      <motion.path d="M96 60 L140 60" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" {...draw(0.5)} />
      <motion.path d="M132 53 L142 60 L132 67" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...draw(0.7)} />
      <motion.circle cx="165" cy="60" r="18" stroke="#9333ea" strokeWidth="2.5" {...draw(0.9)} />
      <motion.path d="M60 26 L60 60" stroke="#d4a36a" strokeWidth="2" strokeLinecap="round" {...draw(1.1)} />
    </svg>
  );
}

const REVEAL = {
  hidden: { opacity: 0, y: 14, filter: 'blur(2px)' },
  shown: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: EASE } },
};

export default function TableauVivant({ title, subtitle, blocks = [], autoplay = true, onEnded }) {
  const steps = blocks.length;
  const [step, setStep] = useState(0); // nombre d'elements reveles (0 = titre seul en cours d'ecriture)
  const [playing, setPlaying] = useState(autoplay);
  const timer = useRef(null);

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  useEffect(() => {
    clear();
    if (!playing) return undefined;
    if (step >= steps) { onEnded?.(); return undefined; }
    const cur = step === 0
      ? `${title || ''} ${subtitle || ''}`
      : (blocks[step - 1]?.text || (blocks[step - 1]?.items || []).join(' '));
    timer.current = setTimeout(() => setStep((s) => s + 1), speakMs(cur));
    return clear;
  }, [step, playing, steps, blocks, title, subtitle, onEnded]);

  useEffect(() => () => clear(), []);

  const replay = useCallback(() => { clear(); setStep(0); setPlaying(true); }, []);
  const activeBlock = step - 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-[28px] bg-white p-7 shadow-2xl ring-1 ring-black/5 md:p-10">
        <h1 className="break-words text-2xl font-extrabold leading-tight text-slate-900 md:text-[34px]">
          <Handwriting text={title} perCharMs={22} writing={step === 0} />
        </h1>
        <HandUnderline play={step >= 1} />
        {subtitle ? (
          <p className="mt-2 text-base font-medium text-blue-700 md:text-lg">
            {step >= 1 ? subtitle : <span className="opacity-0">{subtitle}</span>}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-4">
          {blocks.map((b, i) => {
            const revealed = step >= i + 1;
            const isActive = activeBlock === i;
            if (!revealed) return null;
            return (
              <motion.div
                key={i}
                initial="hidden"
                animate="shown"
                variants={REVEAL}
                className={`rounded-2xl border p-4 transition-colors ${
                  b.type === 'retain'
                    ? 'border-amber-400 bg-amber-50'
                    : isActive
                      ? 'border-amber-300 bg-amber-50/70'
                      : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                {b.label ? (
                  <div className={`mb-1.5 text-[11px] font-bold uppercase tracking-wider ${b.type === 'retain' ? 'text-amber-700' : 'text-blue-700'}`}>
                    {b.label}
                  </div>
                ) : null}

                {b.type === 'diagram' ? (
                  <HandDrawnDiagram play={revealed} />
                ) : b.type === 'list' ? (
                  <ul className="grid gap-2 md:grid-cols-2">
                    {(b.items || []).map((it, j) => (
                      <motion.li
                        key={j}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + j * 0.18, duration: 0.35, ease: EASE }}
                        className="flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200"
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                        <span>{it}</span>
                      </motion.li>
                    ))}
                  </ul>
                ) : b.type === 'retain' ? (
                  <div className="text-xl font-extrabold leading-snug text-slate-900 md:text-2xl">
                    <Handwriting text={b.text} perCharMs={26} writing={isActive} />
                  </div>
                ) : (
                  <div className="text-[15px] leading-relaxed text-slate-700 md:text-base">
                    {isActive ? <Handwriting text={b.text} perCharMs={16} writing /> : b.text}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute right-5 top-5 flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
          </span>
          <span className="text-[11px] font-semibold text-slate-500">Narration</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? 'Pause' : 'Lire'}
        </button>
        <button
          type="button"
          onClick={replay}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" /> Rejouer
        </button>
        <span className="text-xs tabular-nums text-white/40">{Math.min(step, steps)}/{steps}</span>
      </div>
    </div>
  );
}
