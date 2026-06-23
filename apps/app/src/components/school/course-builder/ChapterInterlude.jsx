import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Volume2 } from 'lucide-react';
import TableauVivant from './TableauVivant';
import { enqueueMultilangEdgeTts, stopMultilangEdgeTts } from '@/lib/liriMultilangTtsEdge';

/**
 * INTERLUDE DE REFORMULATION — cf. docs/CAHIER_DE_CHARGE_TABLEAU_VIVANT.md (Lot 1).
 *
 * Le moment « prof virtuel » : à la fin d'un chapitre, la vidéo se met en pause
 * et cet overlay PLEIN ÉCRAN joue la reformulation — le Tableau Vivant se construit
 * séquentiellement (texte écrit/dessiné à la main) PENDANT que la voix off (TTS
 * `liri-tts`) lit le résumé. L'élève clique « Continuer » pour reprendre la vidéo.
 *
 * (Synchronisation fine voix↔tableau = Lot 3. Ici la narration démarre à l'ouverture.)
 */
export default function ChapterInterlude({
  open,
  chapterLabel,
  title,
  subtitle,
  blocks = [],
  narration,
  supabase,
  onContinue,
}) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!open) { startedRef.current = false; return undefined; }
    // Lance la voix off une seule fois à l'ouverture (si TTS dispo).
    if (!startedRef.current && supabase && narration) {
      startedRef.current = true;
      enqueueMultilangEdgeTts(supabase, { text: narration, languageCode: 'fr', tier: 'live', onError: () => {} });
    }
    return () => { try { stopMultilangEdgeTts(); } catch { /* */ } };
  }, [open, supabase, narration]);

  const finish = () => { try { stopMultilangEdgeTts(); } catch { /* */ } onContinue?.(); };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0b0f17]/96 p-4 backdrop-blur-sm md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ '--school-accent': 'var(--school-accent, #d4a36a)' }}
        >
          <div className="flex w-full max-w-3xl flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300">
                <Volume2 className="h-4 w-4 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em]">
                  Reformulation {chapterLabel ? `· ${chapterLabel}` : 'du chapitre'}
                </span>
              </div>
              <button
                type="button"
                onClick={finish}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Continuer <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[78vh] overflow-y-auto">
              <TableauVivant key={title} title={title} subtitle={subtitle} blocks={blocks} autoplay />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
