import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, RotateCcw, ChevronRight, ChevronLeft, Check, Volume2, Play, X } from 'lucide-react';
import TableauVivant, { primeSpeech } from '@/components/school/course-builder/TableauVivant';

const EXPO = [0.16, 1, 0.3, 1];

/**
 * ImmersiveClassroom — « Salle de classe » immersive PLEIN ÉCRAN.
 *
 * Joue TOUT un cours comme un « Tableau Vivant » : le prof écrit chaque ligne à
 * la main et la lit à voix haute, chapitre par chapitre (même expérience que
 * /cours-demo, mais alimentée par le contenu RÉEL du cours — chapitres issus du
 * mindmap/slideContent générés en post-production).
 *
 * Overlay NON destructif : se superpose au lecteur existant (la vidéo scrubbable,
 * le forum et les notes restent intacts dessous). Fermeture par le bouton ✕.
 *
 * Usage :
 *   <ImmersiveClassroom open={show} chapters={chapters} onClose={...} />
 *   chapters = [{ title, subtitle?, chapterLabel?, blocks:[…], narration? }]
 */
export default function ImmersiveClassroom({ open, chapters = [], title = 'Cours', onClose }) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);

  const advanceFrom = useCallback(
    (from) => { if (from >= chapters.length - 1) setDone(true); else setIdx(from + 1); },
    [chapters.length],
  );
  const goNext = useCallback(() => advanceFrom(idx), [advanceFrom, idx]);
  const goPrev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const replay = useCallback(() => { setDone(false); setStarted(true); setIdx(0); }, []);

  if (!open) return null;
  const cur = chapters[idx] || null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] overflow-y-auto bg-[#0b0f17] px-4 py-8 md:py-12"
        style={{ '--school-accent': '#d4a36a' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Fermer — toujours visible */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la salle de classe"
          className="fixed right-5 top-5 z-[210] inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 backdrop-blur transition-colors hover:bg-white/10"
        >
          <X className="h-4 w-4" /> Fermer
        </button>

        <div className="mx-auto max-w-3xl">
          <div className="mb-5 flex items-center justify-center gap-2 text-amber-400/90">
            <GraduationCap className="h-5 w-5" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Salle de classe · Le tableau qui enseigne</span>
          </div>

          {/* Fil des chapitres */}
          {chapters.length > 1 && (
            <div className="mb-6 flex items-center justify-center gap-2">
              {chapters.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setDone(false); setStarted(true); setIdx(i); }}
                  className={`h-1.5 rounded-full transition-all ${i === idx && !done ? 'w-8 bg-[var(--school-accent)]' : 'w-4 bg-white/15 hover:bg-white/30'}`}
                  aria-label={`Chapitre ${i + 1}`}
                />
              ))}
            </div>
          )}

          {!started && !done ? (
            <motion.div
              key="cover"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: EXPO }}
              className="rounded-[28px] border border-white/10 bg-gradient-to-b from-[#11161f] to-[#0c1119] p-10 text-center shadow-2xl md:p-14"
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--school-accent)]/15 text-[var(--school-accent)]">
                <Volume2 className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-white md:text-3xl">{chapters[0]?.title || title}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/55">
                Cours <strong className="text-white/80">narré</strong> : le prof écrit chaque ligne à la main
                <strong className="text-white/80"> et la lit à voix haute</strong>. Monte le son 🔊, puis clique pour commencer.
              </p>
              <button
                type="button"
                onClick={() => { primeSpeech(); setStarted(true); }}
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--school-accent)] px-7 py-3 text-base font-bold text-black hover:opacity-90"
              >
                <Play className="h-5 w-5" /> Commencer le cours
              </button>
            </motion.div>
          ) : done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: EXPO }}
              className="rounded-[28px] border border-white/10 bg-gradient-to-b from-[#11161f] to-[#0c1119] p-12 text-center shadow-2xl"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--school-accent)]/15 text-[var(--school-accent)]">
                <Check className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-extrabold text-white">Cours terminé</h2>
              <p className="mt-2 text-sm text-white/50">
                Le tableau a enseigné {chapters.length} chapitre{chapters.length > 1 ? 's' : ''}, écrit{chapters.length > 1 ? 's' : ''} à la main.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={replay}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
                >
                  <RotateCcw className="h-4 w-4" /> Revoir
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--school-accent)] px-5 py-2.5 text-sm font-bold text-black hover:opacity-90"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key={idx} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EXPO }}>
              <div className="mb-3 text-center">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300/80">
                  Chapitre {idx + 1} / {chapters.length}
                </div>
                {cur?.chapterLabel ? <div className="mt-1 text-sm font-medium text-white/50">{cur.chapterLabel}</div> : null}
              </div>

              <TableauVivant
                key={idx}
                title={cur?.title}
                subtitle={cur?.subtitle}
                blocks={cur?.blocks || []}
                autoplay
                speak
                onEnded={() => { window.setTimeout(() => advanceFrom(idx), 1600); }}
              />

              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={idx === 0}
                  className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" /> Précédent
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--school-accent)] px-5 py-2 text-sm font-bold text-black hover:opacity-90"
                >
                  {idx === chapters.length - 1 ? 'Terminer' : 'Chapitre suivant'} <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
