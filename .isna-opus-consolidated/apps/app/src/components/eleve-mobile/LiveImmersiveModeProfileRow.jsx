import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronRight, LayoutTemplate } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { IMMERSIVE_DISPLAYS, getStoredImmersiveMode, setStoredImmersiveMode } from '@/lib/eleveLiveImmersive';
import { EV_MUTED } from '@/pages/eleve-mobile/eleveMobileScreensShared';

const OPTIONS = [IMMERSIVE_DISPLAYS.default, IMMERSIVE_DISPLAYS.alpha];

/**
 * Ligne menu **Profil** : choisir l’affichage immersif (maquette live invité) — stocké en `localStorage`.
 */
export function LiveImmersiveModeProfileRow() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(getStoredImmersiveMode);

  const sync = useCallback(() => setCurrent(getStoredImmersiveMode()), []);

  useEffect(() => {
    const onMode = (e) => {
      if (e?.detail?.id === 'alpha' || e?.detail?.id === 'default') setCurrent(e.detail.id);
      else sync();
    };
    window.addEventListener('liri:live-immersive-mode', onMode);
    return () => window.removeEventListener('liri:live-immersive-mode', onMode);
  }, [sync]);

  const label = OPTIONS.find((o) => o.id === current)?.label ?? IMMERSIVE_DISPLAYS.default.label;

  const select = (id) => {
    if (id !== 'default' && id !== 'alpha') return;
    setStoredImmersiveMode(id);
    setCurrent(id);
    setOpen(false);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        <motion.div
          whileTap={{ scale: 0.995 }}
          className="flex w-full items-center gap-4 px-5 py-4"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center">
            <LayoutTemplate className="h-7 w-7 text-violet-400" strokeWidth={1.85} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-[15px] font-semibold leading-tight tracking-tight text-white">Mode d’affichage (live)</p>
            <p className="mt-1 text-[12px] leading-snug" style={{ color: EV_MUTED }}>
              {label} — salle de cours invité
            </p>
          </div>
          <ChevronRight
            className="h-[18px] w-[18px] shrink-0 opacity-90"
            style={{ color: '#9ca3af' }}
            strokeWidth={1.65}
            aria-hidden
          />
        </motion.div>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="z-[1002] max-h-[min(90dvh,520px)] overflow-y-auto rounded-t-2xl border-white/10 bg-[#0f1018]/98 px-4 pb-8 pt-2 text-white"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-lg font-bold text-white">Mode d’affichage</SheetTitle>
            <SheetDescription className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Choisir la présentation de la salle de live (invité). S’applique au lien « Rejoindre le live » depuis
              l’onglet Live.
            </SheetDescription>
          </SheetHeader>
          <ul className="mt-4 flex flex-col gap-2" role="listbox" aria-label="Variantes d’affichage immersif">
            {OPTIONS.map((opt) => {
              const active = current === opt.id;
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => select(opt.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition',
                      active ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/10 bg-white/[0.04]',
                    )}
                    role="option"
                    aria-selected={active}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                        active ? 'border-violet-400 bg-violet-500/20' : 'border-white/15',
                      )}
                    >
                      {active ? <Check className="h-3 w-3 text-violet-300" strokeWidth={2.5} /> : null}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-white">{opt.label}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {opt.description}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
