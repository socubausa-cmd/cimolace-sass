/**
 * Aide — SmartBoard Designer (Konva) : formats workspace, import historique Polotno.
 * Route : /studio/smartboard-aide (montée DANS la coque du portail, cf. StudioRouter).
 *
 * Charte LIRI appliquée à la source : le fond #05070c et les titres de section
 * #7d89b0 (slate froid) n'étaient couverts par aucun remap de studioWarm.css, et les
 * quatre icônes (cyan / ambre / rose / émeraude) y auraient été écrasées sur une seule
 * teinte — les sections auraient perdu leur repère visuel. Chaque section garde donc
 * son accent, pris dans la gamme chaude (or → corail).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, BookOpen, FileJson, ArrowRightLeft, Clapperboard } from 'lucide-react';
import { proColors } from '@/styles/proTokens';

/* Tokens partagés (déjà à la charte LIRI). Surtout pas `var(--school-accent)` :
   hors de la coque du portail elle vaut encore l'or FROID #d4af37 (index.css). */
const C = {
  base: proColors.surface2,             // #262624
  encre: proColors.textPrimary,
  encreDouce: proColors.textSecondary,  // texte courant
  encreDiscrete: proColors.textMuted,   // secondaire — plancher 4,5:1 tenu
  ligne: proColors.border,
  corail: proColors.accent,
  or: proColors.gold,
};

/** Teinte translucide, pour ne pas réécrire les rgba à la main. */
const voile = (hex, alpha) => `color-mix(in srgb, ${hex} ${alpha}%, transparent)`;

/* Un accent par section : la différenciation se joue sur l'intensité, pas sur la teinte. */
const ACCENT_SECTION = {
  workspace: C.or,        // or — le format de référence
  import: '#e8a13c',      // orange doré — la conversion
  live: '#e8674f',        // rouge chaud — le direct
  raccourcis: '#e3aa6b',  // ocre clair — l'annexe
};

/** Titre de section : pastille d'icône colorée + intitulé en capitales. */
function TitreSection({ icon: Icon, accent, children }) {
  return (
    <h2
      className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]"
      style={{ color: C.encreDouce }}
    >
      <Icon className="h-4 w-4" style={{ color: accent }} />
      {children}
    </h2>
  );
}

/** Code inline — fond ivoire très discret, jamais de gris bleuté. */
function Code({ children }) {
  return (
    <code
      className="rounded px-1 text-[12px]"
      style={{ background: 'rgba(245,244,238,.08)', color: C.encre }}
    >
      {children}
    </code>
  );
}

/** Lien interne — corail, l'action dans la charte LIRI. */
function LienChaud({ to, children }) {
  return (
    <Link className="hover:underline" style={{ color: C.corail }} to={to}>
      {children}
    </Link>
  );
}

export default function StudioSmartboardHelpPage() {
  return (
    <div className="min-h-[100dvh]" style={{ background: C.base, color: C.encre }}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <Link
            to="/studio"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors"
            style={{ color: C.encreDouce, border: `1px solid ${C.ligne}` }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.corail; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.encreDouce; }}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Studio
          </Link>
          <Link
            to="/studio/smartboard-designer"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors"
            style={{
              background: voile(C.corail, 14),
              border: `1px solid ${voile(C.corail, 32)}`,
              color: C.or,
            }}
          >
            Ouvrir le designer
          </Link>
        </div>

        <h1 className="font-serif text-2xl font-semibold md:text-3xl" style={{ color: C.or }}>
          SmartBoard Designer — aide
        </h1>
        <p className="mt-2 text-sm" style={{ color: C.encreDouce }}>
          L&apos;éditeur principal est désormais entièrement{' '}
          <strong style={{ color: C.encre }}>Konva</strong> (scènes 1037×750, objets
          manipulables, exports PDF / PPTX / texte, Course Copilot).
        </p>

        <section className="mt-10 space-y-4">
          <TitreSection icon={FileJson} accent={ACCENT_SECTION.workspace}>
            Fichier workspace (JSON)
          </TitreSection>
          <ul className="list-inside list-disc space-y-2 text-[13px] leading-relaxed" style={{ color: C.encreDouce }}>
            <li>
              <strong style={{ color: C.encre }}>Format courant</strong> : <Code>konvaProject</Code> (scènes
              + objets) + état Course Copilot (texte source, plan slides, thème, etc.). C&apos;est ce qui est sauvegardé sur le cloud et
              exporté depuis le designer.
            </li>
            <li>
              <strong style={{ color: C.encre }}>Anciens fichiers v2 avec uniquement</strong>{' '}
              <Code>polotnoProject</Code> : à l&apos;ouverture (invitation ou import), le
              designer tente une <strong>conversion automatique</strong> vers Konva (texte, images, formes de base — mise en page
              approximative). Vérifiez le rendu puis enregistrez pour figer un workspace Konva.
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <TitreSection icon={ArrowRightLeft} accent={ACCENT_SECTION.import}>
            Import depuis l&apos;historique Polotno
          </TitreSection>
          <p className="text-[13px] leading-relaxed" style={{ color: C.encreDouce }}>
            Les workspaces enregistrés uniquement au format Polotno sont convertis côté application sans moteur Polotno. Certains éléments
            avancés peuvent être simplifiés ou omis ; les scènes complexes méritent une relecture manuelle.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <TitreSection icon={Clapperboard} accent={ACCENT_SECTION.live}>
            Salle live et workspace
          </TitreSection>
          <p className="text-[13px] leading-relaxed" style={{ color: C.encreDouce }}>
            En <strong style={{ color: C.encre }}>direct</strong>, l&apos;écran intelligent lit les scènes en base (
            <Code>live_scenes</Code>) : slides « Architect » avec{' '}
            <Code>ia_data</Code> (lecture progressive), éléments positionnels, ou médias
            importés depuis le{' '}
            <LienChaud to="/studio/live">constructeur de live</LienChaud>.
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: C.encreDiscrete }}>
            Le <strong style={{ color: C.encre }}>fichier workspace</strong> (cloud LIRI ou export JSON) sert à <strong>concevoir</strong> la
            fiche 1037×750 et le plan Course Copilot : ce n&apos;est pas le même format que les slides{' '}
            <Code>ia_data</Code> du wizard. Pour l&apos;ordre des scènes et l&apos;import brouillon
            → session, utilisez la{' '}
            <LienChaud to="/studio/live-preparation">préparation live</LienChaud>.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <TitreSection icon={BookOpen} accent={ACCENT_SECTION.raccourcis}>
            Raccourcis utiles
          </TitreSection>
          <ul className="space-y-2 text-[13px]" style={{ color: C.encreDouce }}>
            <li>
              Designer :{' '}
              <LienChaud to="/studio/smartboard-designer">/studio/smartboard-designer</LienChaud>{' '}
              (alias <Code>/studio/smartboard-konva</Code>). L&apos;ancienne route{' '}
              <Code>/studio/smartboard-konva-parite</Code> redirige ici.
            </li>
            <li>
              Invitations cloud : <Code>?cw_invite=…</Code> sur cette même URL.
            </li>
            <li>
              Préparation live (scènes, import brouillon) :{' '}
              <LienChaud to="/studio/live-preparation">/studio/live-preparation</LienChaud>.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
