import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RotateCcw, Pause, Play } from 'lucide-react';

/**
 * LE TABLEAU VIVANT — cf. docs/CAHIER_DE_CHARGE_TABLEAU_VIVANT.md
 *
 * Reproduit le geste d'un PROF qui enseigne au tableau : affichage SEQUENTIEL,
 * le texte S'ECRIT (encre, caractere par caractere), le bloc lu est SURLIGNE
 * (surligneur anime), les accents sont DESSINES A LA MAIN (trace SVG), et les
 * « a retenir » s'affichent en GROS PLAN. Passe motion design : entree
 * orchestree (scale + flou), courbes ease-out-expo, respect de prefers-reduced-motion.
 */

const speakMs = (text) => Math.max(1100, Math.min(8000, String(text || '').length * 52));

const EXPO = [0.16, 1, 0.3, 1]; // ease-out-expo
const QUINT = [0.22, 1, 0.36, 1]; // ease-out-quint

// Texte qui « s'ecrit » a l'encre : cascade caractere par caractere (glisse depuis
// la gauche), groupee par MOTS (inline-block) pour un retour a la ligne propre, + plume.
function Handwriting({ text, perCharMs = 24, writing, rm }) {
  const words = String(text || '').split(' ');
  let gi = 0;
  return (
    <span aria-label={text} className="relative">
      {words.map((w, wi) => {
        const word = (
          <span className="inline-block">
            {[...w].map((c, ci) => {
              const delay = gi * (perCharMs / 1000);
              gi += 1;
              return rm ? (
                <span key={ci} aria-hidden>{c}</span>
              ) : (
                <motion.span
                  key={ci}
                  aria-hidden
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.12, ease: 'easeOut', delay }}
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
      {writing && !rm ? (
        <motion.span
          aria-hidden
          className="ml-[2px] inline-block h-[1em] w-[3px] -rotate-12 rounded-full bg-blue-600/80 align-text-bottom"
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      ) : null}
    </span>
  );
}

function HandUnderline({ play, rm }) {
  return (
    <svg viewBox="0 0 320 12" className="mt-1 h-3 w-[min(320px,80%)]" fill="none" aria-hidden>
      <motion.path
        d="M2 7 C 60 2, 110 11, 170 6 S 280 3, 318 8"
        stroke="var(--school-accent, #d4a36a)"
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: rm ? 1 : 0, opacity: 0.9 }}
        animate={play ? { pathLength: 1 } : { pathLength: rm ? 1 : 0 }}
        transition={{ duration: rm ? 0 : 0.7, ease: EXPO }}
      />
    </svg>
  );
}

function HandDrawnDiagram({ play, rm }) {
  const draw = (delay) => ({
    initial: { pathLength: rm ? 1 : 0, opacity: 0.95 },
    animate: play ? { pathLength: 1 } : { pathLength: rm ? 1 : 0 },
    transition: { duration: rm ? 0 : 0.8, ease: EXPO, delay: rm ? 0 : delay },
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

export default function TableauVivant({ title, subtitle, blocks = [], autoplay = true, onEnded }) {
  const rm = useReducedMotion();
  const steps = blocks.length;
  const [step, setStep] = useState(0);
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

  const REVEAL = rm
    ? { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: 0.2 } } }
    : {
        hidden: { opacity: 0, y: 18, scale: 0.98, filter: 'blur(6px)' },
        shown: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.55, ease: EXPO } },
      };

  return (
    <div className="flex flex-col gap-3">
      {/* Le tableau se POSE (entree orchestree : scale + flou) */}
      <motion.div
        initial={rm ? { opacity: 0 } : { opacity: 0, scale: 0.97, filter: 'blur(8px)', y: 10 }}
        animate={rm ? { opacity: 1 } : { opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
        transition={{ duration: rm ? 0.2 : 0.6, ease: EXPO }}
        className="relative overflow-hidden rounded-[28px] bg-white p-7 shadow-2xl ring-1 ring-black/5 md:p-10"
      >
        <h1 className="break-words text-2xl font-extrabold leading-tight text-slate-900 md:text-[34px]">
          <Handwriting text={title} perCharMs={22} writing={step === 0} rm={rm} />
        </h1>
        <HandUnderline play={step >= 1} rm={rm} />
        {subtitle ? (
          <motion.p
            className="mt-2 text-base font-medium text-blue-700 md:text-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: step >= 1 ? 1 : 0 }}
            transition={{ duration: 0.4, ease: QUINT, delay: 0.1 }}
          >
            {subtitle}
          </motion.p>
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
                className={`relative overflow-hidden rounded-2xl border p-4 ${
                  b.type === 'retain'
                    ? 'border-amber-400 bg-amber-50'
                    : isActive
                      ? 'border-amber-300'
                      : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                {/* Surligneur anime : balaie le bloc en cours de lecture */}
                {isActive && b.type !== 'retain' && !rm ? (
                  <motion.div
                    aria-hidden
                    className="absolute inset-0 origin-left bg-amber-100/70"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 1.1, ease: QUINT }}
                  />
                ) : null}

                <div className="relative">
                  {b.label ? (
                    <div className={`mb-1.5 text-[11px] font-bold uppercase tracking-wider ${b.type === 'retain' ? 'text-amber-700' : 'text-blue-700'}`}>
                      {b.label}
                    </div>
                  ) : null}

                  {b.type === 'diagram' ? (
                    <HandDrawnDiagram play={revealed} rm={rm} />
                  ) : b.type === 'list' ? (
                    <ul className="grid gap-2 md:grid-cols-2">
                      {(b.items || []).map((it, j) => (
                        <motion.li
                          key={j}
                          initial={rm ? { opacity: 0 } : { opacity: 0, x: -10, filter: 'blur(3px)' }}
                          animate={rm ? { opacity: 1 } : { opacity: 1, x: 0, filter: 'blur(0px)' }}
                          transition={{ delay: rm ? 0 : 0.15 + j * 0.16, duration: 0.4, ease: EXPO }}
                          className="flex items-start gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200"
                        >
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                          <span>{it}</span>
                        </motion.li>
                      ))}
                    </ul>
                  ) : b.type === 'retain' ? (
                    <div className="text-xl font-extrabold leading-snug text-slate-900 md:text-2xl">
                      <Handwriting text={b.text} perCharMs={26} writing={isActive} rm={rm} />
                    </div>
                  ) : (
                    <div className="text-[15px] leading-relaxed text-slate-700 md:text-base">
                      {isActive ? <Handwriting text={b.text} perCharMs={16} writing rm={rm} /> : b.text}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute right-5 top-5 flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            {!rm ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500/60" /> : null}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
          </span>
          <span className="text-[11px] font-semibold text-slate-500">Narration</span>
        </div>
      </motion.div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? 'Pause' : 'Lire'}
        </button>
        <button
          type="button"
          onClick={replay}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" /> Rejouer
        </button>
        <span className="text-xs tabular-nums text-white/40">{Math.min(step, steps)}/{steps}</span>
      </div>
    </div>
  );
}
