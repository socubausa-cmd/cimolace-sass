import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { HandwritingInk, InkHighlight } from './HandwritingInk';

/**
 * INTERLUDE DE REFORMULATION — §3.2 du cahier des charges « Tableau Vivant ».
 * Le tableau passe au PREMIER PLAN à la fin d'un chapitre et récapitule, comme un
 * professeur qui reformule avant d'avancer.
 *
 * Les lois tenues ici :
 * - loi 1 (séquentiel) : les points se révèlent UN PAR UN, jamais la liste d'un bloc ;
 * - loi 3 (écriture à la main) : chaque point s'écrit via `HandwritingInk` ;
 * - loi 4 (surlignage du passage lu) : le point courant est souligné par `InkHighlight` ;
 * - loi 6 (gros plan sur l'essentiel) : panneau plein cadre, fond assombri, rien d'autre.
 *
 * Ce que cet interlude N'EST PAS (et qu'il ne faut pas annoncer comme fait) :
 * - il n'y a PAS de voix off : §3.2 point 3 attend une narration TTS de la
 *   reformulation, produite en post-prod (lot 4). Ici la cadence est TEMPORELLE,
 *   pas synchronisée à une voix — la loi 2 n'est donc pas tenue par ce lot ;
 * - il ne dessine aucun schéma (loi 5) : la reformulation n'affiche que du texte.
 *
 * Fermeture : bouton « Continuer » explicite ou Échap. JAMAIS de fermeture
 * automatique — en plein direct, un panneau qui disparaît seul coupe le prof.
 */

/** Temps de lecture d'un point : la loi « une idée = un temps » interdit d'enchaîner à la volée. */
const paceMs = (text) => Math.min(6000, Math.max(1900, 1300 + String(text || '').length * 34));

export default function ChapterInterlude({
  chapterId,
  points,
  onContinue,
  /** Le parent connaît déjà la préférence ; on la respecte aussi seul (composant réutilisable). */
  reduceMotion,
}) {
  const systemReduceMotion = useReducedMotion();
  const rm = reduceMotion ?? systemReduceMotion ?? false;
  // ⚠️ Mémorisé : la scène se re-rend souvent (parallaxe, régie, narration). Une
  // liste recréée à chaque rendu relancerait le minuteur sans fin et la cascade
  // n'avancerait jamais.
  const list = useMemo(
    () => (Array.isArray(points) ? points.filter((p) => String(p || '').trim()) : []),
    [points],
  );
  const total = list.length;
  const listRef = useRef(list);
  listRef.current = list;

  // Sous `prefers-reduced-motion` (garde-fou §7), pas de cascade : tout est lisible
  // immédiatement, l'accessibilité prime sur la mise en scène.
  const [revealed, setRevealed] = useState(() => (rm ? total : 0));
  const continueRef = useRef(null);

  useEffect(() => {
    setRevealed(rm ? total : 0);
  }, [rm, total, chapterId]);

  useEffect(() => {
    if (rm || revealed >= total) return undefined;
    const delay = revealed === 0 ? 420 : paceMs(listRef.current[revealed - 1]);
    const timer = setTimeout(() => setRevealed((n) => Math.min(total, n + 1)), delay);
    return () => clearTimeout(timer);
  }, [rm, revealed, total]);

  const close = useCallback(() => { onContinue?.(); }, [onContinue]);

  useEffect(() => {
    // Capture + stopPropagation : l'arène écoute déjà Échap (sortie du mode
    // tactique, fermetures de panneaux). Sans cela, une seule touche fermerait
    // l'interlude ET réinitialiserait la régie derrière.
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [close]);

  useEffect(() => {
    // Le bouton prend le focus : Entrée/Espace suffisent, et le lecteur d'écran
    // annonce tout de suite la sortie du panneau.
    const id = setTimeout(() => continueRef.current?.focus?.(), 60);
    return () => clearTimeout(id);
  }, []);

  if (total === 0) return null;

  const heading = Number.isFinite(Number(chapterId))
    ? `Ce qu'il faut retenir du chapitre ${Number(chapterId)}`
    : 'Ce qu\'il faut retenir de ce chapitre';

  return (
    <motion.div
      // Affordance de test, dans l'esprit de `data-scene-narration` /
      // `data-scene-reveal-step` : rend l'interlude observable sans ouvrir React.
      data-chapter-interlude="open"
      data-chapter-interlude-chapter={chapterId == null ? '' : String(chapterId)}
      data-chapter-interlude-step={String(revealed)}
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      initial={rm ? { opacity: 0 } : { opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: rm ? 0.15 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      // z-[70] : au-dessus du calque d'annotation (z-[25]) et du bouton de
      // narration (z-[60]) — le récapitulatif est au PREMIER plan (§3.2).
      className="absolute inset-0 z-[70] flex items-center justify-center bg-black/78 backdrop-blur-md px-4 py-6"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-3xl max-h-full overflow-y-auto rounded-[26px] border border-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] bg-[#101014]/85 px-6 py-7 md:px-9 md:py-9 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <span className="inline-flex items-center gap-2 h-6 px-3 rounded-full border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] text-[11px] font-medium tracking-[0.18em] uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--school-accent)]" />
          Reformulation
        </span>

        <h2 className="mt-4 font-serif font-bold leading-tight tracking-[-0.01em] text-[1.6rem] md:text-[2rem] text-[#F5F1E8]">
          {/* Loi 3 : le titre s'écrit lui aussi ; la main ne reste que le temps du tracé. */}
          <HandwritingInk text={heading} perCharMs={22} writing={revealed === 0} rm={rm} />
        </h2>

        <ol className="mt-6 space-y-4">
          <AnimatePresence initial={false}>
            {list.slice(0, revealed).map((point, i) => (
              <motion.li
                key={`${chapterId}-${i}`}
                initial={rm ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: rm ? 0.15 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="flex gap-3 items-start"
              >
                <span
                  aria-hidden
                  className="mt-1 shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[11px] font-semibold text-[var(--school-accent)]"
                >
                  {i + 1}
                </span>
                <p className="font-serif text-[15px] md:text-[17px] leading-relaxed text-white/88">
                  {/* Loi 4 : seul le point EN COURS d'écriture est surligné. */}
                  <InkHighlight active={i === revealed - 1 && revealed < total} rm={rm}>
                    <HandwritingInk
                      text={point}
                      perCharMs={16}
                      writing={i === revealed - 1 && revealed < total}
                      rm={rm}
                    />
                  </InkHighlight>
                </p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>

        {/* Bouton CENTRÉ : le coin bas-gauche est pris par le FAB « IA — coach
            formateur » et la droite par le rail de régie ; un bouton posé là
            devient incliquable (piège déjà rencontré sur cette scène). */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            ref={continueRef}
            type="button"
            onClick={(e) => { e.stopPropagation(); close(); }}
            className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_16%,transparent)] px-6 py-2.5 text-sm font-medium text-[#F5F1E8] hover:bg-[color-mix(in_srgb,var(--school-accent)_26%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)]"
          >
            Continuer
            <span aria-hidden="true">→</span>
          </button>
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
            {revealed < total ? `Point ${revealed} / ${total} · Échap pour continuer` : 'Échap pour continuer'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
