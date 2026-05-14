/**
 * Aide — SmartBoard Designer (Konva) : formats workspace, import historique Polotno.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, BookOpen, FileJson, ArrowRightLeft, Clapperboard } from 'lucide-react';

export default function StudioSmartboardHelpPage() {
  return (
    <div className="min-h-[100dvh] bg-[#05070c] text-white">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <Link
            to="/studio"
            className="inline-flex items-center gap-1 rounded-lg border border-white/12 px-2 py-1 text-[11px] text-white/70 hover:border-[#D4AF37]/35 hover:text-[#D4AF37]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Studio
          </Link>
          <Link
            to="/studio/smartboard-designer"
            className="inline-flex items-center gap-1 rounded-lg border border-[#D4AF37]/30 bg-[#1a1510] px-2 py-1 text-[11px] text-[#f5dd8a] hover:bg-[#D4AF37]/15"
          >
            Ouvrir le designer
          </Link>
        </div>

        <h1 className="font-serif text-2xl font-semibold text-[#D4AF37] md:text-3xl">SmartBoard Designer — aide</h1>
        <p className="mt-2 text-sm text-white/55">
          L’éditeur principal est désormais entièrement <strong className="text-white/80">Konva</strong> (scènes 1037×750, objets
          manipulables, exports PDF / PPTX / texte, Course Copilot).
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#7d89b0]">
            <FileJson className="h-4 w-4 text-cyan-400/80" />
            Fichier workspace (JSON)
          </h2>
          <ul className="list-inside list-disc space-y-2 text-[13px] leading-relaxed text-white/75">
            <li>
              <strong className="text-white/90">Format courant</strong> : <code className="rounded bg-white/10 px-1 text-[12px]">konvaProject</code> (scènes
              + objets) + état Course Copilot (texte source, plan slides, thème, etc.). C’est ce qui est sauvegardé sur le cloud et
              exporté depuis le designer.
            </li>
            <li>
              <strong className="text-white/90">Anciens fichiers v2 avec uniquement</strong>{' '}
              <code className="rounded bg-white/10 px-1 text-[12px]">polotnoProject</code> : à l’ouverture (invitation ou import), le
              designer tente une <strong>conversion automatique</strong> vers Konva (texte, images, formes de base — mise en page
              approximative). Vérifiez le rendu puis enregistrez pour figer un workspace Konva.
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#7d89b0]">
            <ArrowRightLeft className="h-4 w-4 text-amber-400/80" />
            Import depuis l’historique Polotno
          </h2>
          <p className="text-[13px] leading-relaxed text-white/75">
            Les workspaces enregistrés uniquement au format Polotno sont convertis côté application sans moteur Polotno. Certains éléments
            avancés peuvent être simplifiés ou omis ; les scènes complexes méritent une relecture manuelle.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#7d89b0]">
            <Clapperboard className="h-4 w-4 text-rose-400/80" />
            Salle live et workspace
          </h2>
          <p className="text-[13px] leading-relaxed text-white/75">
            En <strong className="text-white/90">direct</strong>, l’écran intelligent lit les scènes en base (
            <code className="rounded bg-white/10 px-1 text-[12px]">live_scenes</code>) : slides « Architect » avec{' '}
            <code className="rounded bg-white/10 px-1 text-[12px]">ia_data</code> (lecture progressive), éléments positionnels, ou médias
            importés depuis le{' '}
            <Link className="text-[#D4AF37] hover:underline" to="/studio/live">
              constructeur de live
            </Link>
            .
          </p>
          <p className="text-[13px] leading-relaxed text-white/65">
            Le <strong className="text-white/85">fichier workspace</strong> (cloud LIRI ou export JSON) sert à <strong>concevoir</strong> la
            fiche 1037×750 et le plan Course Copilot : ce n’est pas le même format que les slides{' '}
            <code className="rounded bg-white/10 px-1 text-[11px]">ia_data</code> du wizard. Pour l’ordre des scènes et l’import brouillon
            → session, utilisez la{' '}
            <Link className="text-[#D4AF37] hover:underline" to="/studio/live-preparation">
              préparation live
            </Link>
            .
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#7d89b0]">
            <BookOpen className="h-4 w-4 text-emerald-400/80" />
            Raccourcis utiles
          </h2>
          <ul className="space-y-2 text-[13px] text-white/70">
            <li>
              Designer :{' '}
              <Link className="text-[#D4AF37] hover:underline" to="/studio/smartboard-designer">
                /studio/smartboard-designer
              </Link>{' '}
              (alias <code className="rounded bg-white/10 px-1 text-[11px]">/studio/smartboard-konva</code>). L’ancienne route{' '}
              <code className="rounded bg-white/10 px-1 text-[11px]">/studio/smartboard-konva-parite</code> redirige ici.
            </li>
            <li>
              Invitations cloud : <code className="rounded bg-white/10 px-1 text-[11px]">?cw_invite=…</code> sur cette même URL.
            </li>
            <li>
              Préparation live (scènes, import brouillon) :{' '}
              <Link className="text-[#D4AF37] hover:underline" to="/studio/live-preparation">
                /studio/live-preparation
              </Link>
              .
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
