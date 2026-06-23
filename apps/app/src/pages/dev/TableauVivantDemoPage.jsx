import React, { useState } from 'react';
import TableauVivant from '@/components/school/course-builder/TableauVivant';
import ChapterInterlude from '@/components/school/course-builder/ChapterInterlude';

/**
 * Démo SANS AUTH du « Tableau Vivant » + interlude de reformulation — /dev/tableau-vivant
 * cf. docs/CAHIER_DE_CHARGE_TABLEAU_VIVANT.md
 */
const SAMPLE = {
  title: "Tout dans l'univers pourrait s'expliquer par une seule loi",
  subtitle: 'La quête d’une théorie unifiée en prorascience',
  blocks: [
    { type: 'idea', label: 'Idée centrale', text: 'La prorascience est la science qui combine la spiritualité et la morale.' },
    { type: 'objective', label: 'Objectif', text: 'Comprendre l’ambition unificatrice de la prorascience et ses implications pour la science moderne.' },
    { type: 'diagram', label: 'Schéma — au tableau' },
    { type: 'list', label: 'Carte mentale', items: [
      'Unification — relier physique quantique et relativité',
      'Simplicité — une équation pour tout décrire',
      'Universalité — valable pour tous les systèmes',
      'Vérifiabilité — testable par l’expérience',
    ] },
    { type: 'retain', label: 'À retenir', text: 'Une loi, mille phénomènes — la science en équation unique.' },
  ],
};

export default function TableauVivantDemoPage() {
  const [interlude, setInterlude] = useState(false);
  return (
    <div className="min-h-screen bg-[#0b0f17] px-4 py-8 md:py-12" style={{ '--school-accent': '#d4a36a' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400/80">SMARTBOARD · Tableau vivant</div>
          <h2 className="mt-1 text-lg font-semibold text-white/90">Démo — le tableau qui enseigne (séquentiel, écrit/dessiné à la main)</h2>
          <p className="mt-1 text-xs text-white/40">Révélation progressive cadencée comme une narration. La vraie voix off (TTS) joue dans le lecteur (avec session).</p>
          <button
            type="button"
            onClick={() => setInterlude(true)}
            className="mt-4 rounded-full bg-[var(--school-accent)] px-5 py-2.5 text-sm font-bold text-black hover:opacity-90"
          >
            ▶ Simuler « fin de chapitre » → reformulation plein écran
          </button>
        </div>

        <TableauVivant {...SAMPLE} />
      </div>

      <ChapterInterlude
        open={interlude}
        chapterLabel="Chapitre 3"
        title={SAMPLE.title}
        subtitle={SAMPLE.subtitle}
        blocks={SAMPLE.blocks}
        narration={`${SAMPLE.title}. ${SAMPLE.blocks.map((b) => b.text || (b.items || []).join('. ')).filter(Boolean).join('. ')}`}
        supabase={null}
        onContinue={() => setInterlude(false)}
      />
    </div>
  );
}
