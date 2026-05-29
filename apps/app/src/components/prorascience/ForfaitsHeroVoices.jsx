import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote } from 'lucide-react';

/**
 * Bandeau sous l'image hero : 4 portraits + citation qui alterne (clic ou auto).
 */
export function ForfaitsHeroVoices({ profiles = [], cycleKey, prefersReducedMotion, easePremium }) {
  const list = profiles.length ? profiles : [];
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
  }, [cycleKey]);

  useEffect(() => {
    if (list.length <= 1 || prefersReducedMotion) return undefined;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % list.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, [list.length, cycleKey, prefersReducedMotion]);

  const onPick = useCallback(
    (i) => {
      setActive(i);
    },
    []
  );

  if (!list.length) return null;

  const current = list[active] || list[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2 sm:gap-3" role="tablist" aria-label="Témoignages">
        {list.map((p, i) => {
          const isOn = i === active;
          return (
            <button
              key={`${cycleKey}-voice-${p.name}-${i}`}
              type="button"
              role="tab"
              aria-selected={isOn}
              onClick={() => onPick(i)}
              className={`relative shrink-0 rounded-full p-0.5 transition-transform duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/70 ${
                isOn ? 'scale-110 ring-2 ring-[#D4AF37]/80' : 'opacity-75 hover:opacity-100 hover:ring-1 hover:ring-white/20'
              }`}
            >
              <span className="block h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-[#1a2234] sm:h-14 sm:w-14">
                <img
                  src={p.image}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative min-h-[5.5rem] rounded-xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37]/90">
          <Quote className="h-3.5 w-3.5" aria-hidden />
          Voix du niveau
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${cycleKey}-quote-${active}`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: easePremium }}
          >
            <p className="text-sm leading-relaxed text-white/88 md:text-[15px]">
              &ldquo;{current.quote}&rdquo;
            </p>
            <p className="mt-2 text-xs text-white/55">
              <span className="font-semibold text-[#D4AF37]">{current.name}</span>
              <span className="text-white/40"> · </span>
              {current.role}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
