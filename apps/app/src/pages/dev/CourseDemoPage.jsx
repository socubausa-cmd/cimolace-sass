import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, RotateCcw, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import TableauVivant from '@/components/school/course-builder/TableauVivant';

const EXPO = [0.16, 1, 0.3, 1];

/**
 * COURS-DÉMO PUBLIC — /cours-demo (sans auth) — cf. docs/CAHIER_DE_CHARGE_TABLEAU_VIVANT.md
 *
 * « Le tableau qui enseigne comme un prof » : chaque chapitre est un Tableau Vivant
 * qui s'écrit À LA MAIN (une main tient le stylo), séquentiellement, comme à l'école.
 * Les chapitres s'enchaînent tout seuls (onEnded). C'est l'expérience « prof virtuel ».
 */

const CHAPTERS = [
  {
    label: 'La prorascience — une science de l’unité',
    title: 'La prorascience est la science qui combine la spiritualité et la morale',
    subtitle: 'Relier l’esprit et l’éthique dans une seule discipline',
    blocks: [
      { type: 'idea', label: 'Idée centrale', text: 'La prorascience est la science qui combine la spiritualité et la morale.' },
      { type: 'objective', label: 'Objectif', text: 'Comprendre comment une seule discipline relie la vie intérieure et la conduite juste.' },
      { type: 'diagram', label: 'Schéma — au tableau' },
      { type: 'retain', label: 'À retenir', text: 'Spiritualité + morale = prorascience.' },
    ],
  },
  {
    label: 'Une loi unique pour mille phénomènes',
    title: 'Tout pourrait s’expliquer par une seule loi',
    subtitle: 'La quête d’une théorie unifiée',
    blocks: [
      { type: 'idea', label: 'Idée centrale', text: 'Une loi fondamentale unique régirait l’ensemble des phénomènes observables.' },
      { type: 'list', label: 'Les piliers', items: [
        'Unité — relier l’esprit et la matière',
        'Simplicité — une équation pour tout décrire',
        'Universalité — valable pour tous les systèmes',
        'Vérifiabilité — testable par l’expérience',
      ] },
      { type: 'retain', label: 'À retenir', text: 'Une loi, mille phénomènes.' },
    ],
  },
  {
    label: 'Vérifier par l’expérience',
    title: 'Une théorie ne vaut que si elle est testable',
    subtitle: 'Du modèle à la preuve',
    blocks: [
      { type: 'idea', label: 'Idée centrale', text: 'Une loi unificatrice doit produire des prédictions vérifiables par l’expérience.' },
      { type: 'objective', label: 'Objectif', text: 'Distinguer une belle équation d’une science réellement démontrée.' },
      { type: 'diagram', label: 'Schéma — au tableau' },
      { type: 'retain', label: 'À retenir', text: 'Pas de preuve, pas de science.' },
    ],
  },
];

export default function CourseDemoPage() {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  const advanceFrom = useCallback((from) => {
    if (from >= CHAPTERS.length - 1) setDone(true);
    else setIdx(from + 1);
  }, []);

  const goNext = useCallback(() => advanceFrom(idx), [advanceFrom, idx]);
  const goPrev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const replay = useCallback(() => { setDone(false); setIdx(0); }, []);

  const cur = CHAPTERS[idx];

  return (
    <div className="min-h-screen bg-[#0b0f17] px-4 py-8 md:py-12" style={{ '--school-accent': '#d4a36a' }}>
      <div className="mx-auto max-w-3xl">
        {/* En-tête */}
        <div className="mb-5 flex items-center justify-center gap-2 text-amber-400/90">
          <GraduationCap className="h-5 w-5" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Cours généré · Le tableau qui enseigne</span>
        </div>

        {/* Fil des chapitres */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {CHAPTERS.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setDone(false); setIdx(i); }}
              className={`h-1.5 rounded-full transition-all ${i === idx && !done ? 'w-8 bg-[var(--school-accent)]' : 'w-4 bg-white/15 hover:bg-white/30'}`}
              aria-label={`Chapitre ${i + 1}`}
            />
          ))}
        </div>

        {done ? (
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
            <p className="mt-2 text-sm text-white/50">Le tableau a enseigné les {CHAPTERS.length} chapitres, écrits à la main.</p>
            <button
              type="button"
              onClick={replay}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--school-accent)] px-5 py-2.5 text-sm font-bold text-black hover:opacity-90"
            >
              <RotateCcw className="h-4 w-4" /> Revoir le cours
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EXPO }}
          >
            <div className="mb-3 text-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300/80">Chapitre {idx + 1} / {CHAPTERS.length}</div>
              <div className="mt-1 text-sm font-medium text-white/50">{cur.label}</div>
            </div>

            <TableauVivant
              key={idx}
              title={cur.title}
              subtitle={cur.subtitle}
              blocks={cur.blocks}
              autoplay
              onEnded={() => { window.setTimeout(() => advanceFrom(idx), 1600); }}
            />

            {/* Navigation chapitres */}
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
                {idx === CHAPTERS.length - 1 ? 'Terminer' : 'Chapitre suivant'} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        <p className="mt-6 text-center text-xs leading-relaxed text-white/40">
          Chaque chapitre s’écrit <strong className="text-white/70">à la main</strong>, comme un prof au tableau : le texte
          se forme sous le stylo, les schémas se dessinent, l’essentiel s’affiche en gros plan. Dans le vrai cours (avec
          session), une <strong className="text-white/70">voix off</strong> lit chaque ligne au même rythme.
        </p>
      </div>
    </div>
  );
}
