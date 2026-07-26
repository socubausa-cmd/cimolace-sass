/**
 * StudioExportCenterPage — Centre d'export : JSON / PDF / PPTX / support élève / guide prof.
 * Route : /studio/export-center (montée DANS la coque du portail, cf. StudioRouter).
 *
 * ── POURQUOI CET ÉCRAN A ÉTÉ REPRIS ──────────────────────────────────────────
 * C'est le DERNIER écran du parcours de production : le créateur vient de fabriquer
 * son cours et repart avec un fichier. C'était pourtant l'écran le moins « LIRI » de
 * tout le Studio (fond #05070c, en-tête #080a12, cartes bleu/émeraude/violet/orange).
 * Deux raisons de corriger à la SOURCE plutôt que de laisser faire studioWarm.css :
 *   1. le remap CSS ne couvre ni `bg-[#05070c]` ni `bg-[#080a12]` ;
 *   2. surtout, il écrase TOUTES les familles froides sur une seule teinte (#e0926a) →
 *      les cinq formats deviendraient indistinguables. Ici on garde une gamme chaude
 *      DIFFÉRENCIÉE (or → corail), portée en style inline : aucune classe de couleur
 *      nommée, donc plus rien à remapper.
 *
 * ── HONNÊTETÉ SUR CE QUI EST RÉELLEMENT PRODUIT ──────────────────────────────
 * Les libellés d'origine promettaient plus que le moteur ne livre (cf. exportService.js).
 * On ne retire aucun format et on ne touche à aucun appel : on ÉTIQUETTE ce que chaque
 * fichier contient vraiment (champ `portee` + `reserve`), pour ne pas laisser un créateur
 * livrer à ses élèves un PDF qu'il croyait illustré. Détail par format ci-dessous.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, Download, FileJson, FileText, Presentation, GraduationCap, BookOpen,
  CheckCircle, Loader2, AlertTriangle, Info,
} from 'lucide-react';
import { useSmartboardStore } from '@/stores/smartboard.store';
import { proColors } from '@/styles/proTokens';
import {
  exportProjectJson, exportSlidesPdf, exportSlidesPptx,
  exportStudentPdf, exportTeacherPdf,
} from '@/features/export/services/exportService';

/* ── Charte ─────────────────────────────────────────────────────────────────────
   Les valeurs viennent des tokens partagés (déjà alignés sur la charte LIRI) ; on
   ne fait que leur donner des noms parlants pour cet écran. Surtout PAS
   `var(--school-accent)` : hors de la coque du portail cette variable vaut encore
   l'or FROID #d4af37 (index.css), donc l'écran resterait hors charte selon son
   point de montage. */
const C = {
  base: proColors.surface2,          // fond de page — #262624
  panneau: proColors.surface4,       // cartes et panneaux — #30302e
  rail: proColors.surface1,          // bandeau supérieur — #1f1e1c
  encre: proColors.textPrimary,      // texte fort
  encreDouce: proColors.textSecondary,  // texte courant
  encreDiscrete: proColors.textMuted,   // méta et légendes (plancher 4,5:1 tenu)
  ligne: proColors.border,
  corail: proColors.accent,          // LES ACTIONS
  or: proColors.gold,                // accent secondaire / succès
  // Rouge d'erreur ÉCLAIRCI par rapport à proColors.error (#ef6a52) : à 11 px sur le
  // panneau #30302e ce dernier tombe à 4,3:1, sous le plancher de 4,5:1. Même teinte,
  // deux crans plus clair → 5,4:1.
  alerte: '#ef8a70',
};

/** Teinte d'accent en fond/bordure translucide, sans dépendre de Tailwind. */
const voile = (hex, alpha) => `color-mix(in srgb, ${hex} ${alpha}%, transparent)`;

/**
 * PORTÉE RÉELLE DE CHAQUE EXPORT — vérifiée dans exportService.js.
 * `portee` : 'complet' = le fichier contient tout ce que la carte annonce.
 *            'structure' = le fichier contient le PLAN (titre + puces de sections),
 *                          pas le rendu visuel des scènes.
 * `reserve` : la nuance affichée sous la description quand il y en a une. Aucune de
 *             ces réserves n'est cosmétique : elles décrivent le code d'export tel
 *             qu'il est aujourd'hui.
 */
const FORMATS_EXPORT = [
  {
    id: 'json',
    label: 'JSON du projet',
    description: 'Sauvegarde complète : slides, sections, états progressifs.',
    icon: FileJson,
    accent: C.or,
    portee: 'complet',
    reserve: null,
  },
  {
    id: 'pdf',
    label: 'PDF de présentation',
    description: 'Une page par slide, prêt à projeter.',
    icon: FileText,
    accent: '#e08b6b',
    portee: 'structure',
    // exportSlidesPdf est appelé avec stageRef = null → la branche html2canvas n'est
    // jamais atteinte : chaque page est composée du titre du slide et de ses sections.
    reserve: 'Le plan du cours (titre + sections), pas le rendu visuel des scènes.',
  },
  {
    id: 'pptx',
    label: 'PowerPoint',
    description: 'Fichier .pptx, ouvrable dans Office et Google Slides.',
    icon: Presentation,
    accent: '#e8a13c',
    portee: 'structure',
    // pptxgenjs compose titre + puces de sections ; aucun visuel de scène n'est embarqué.
    reserve: 'Une diapositive par slide : titre et sections, sans les visuels.',
  },
  {
    id: 'student-pdf',
    label: 'Support élève',
    description: 'Le PDF du cours, titré pour la remise aux élèves.',
    icon: GraduationCap,
    accent: '#d99a4e',
    portee: 'structure',
    // exportStudentPdf = exportSlidesPdf(includeTeacherNotes:false) : AUCUN filtrage par
    // visibilité n'existe côté moteur. L'ancien libellé (« uniquement les éléments visibles
    // par les élèves ») laissait croire à un tri qui n'a jamais eu lieu.
    reserve: 'Contenu identique au PDF de présentation : le tri par visibilité élève n’est pas encore appliqué.',
  },
  {
    id: 'teacher-pdf',
    label: 'Guide du professeur',
    description: 'Le PDF du cours augmenté d’une page de notes par slide.',
    icon: BookOpen,
    accent: C.corail,
    portee: 'structure',
    // La page « Notes prof » n'est ajoutée que si slides[i].segmentIds est non vide, et
    // elle liste les sections — les scripts ne sont pas repris.
    reserve: 'La page de notes reprend l’enchaînement des sections, pas les scripts.',
  },
];

/** Pastille de portée — dit en un mot ce que le fichier contient vraiment. */
function PastillePortee({ portee }) {
  const complet = portee === 'complet';
  return (
    <span
      className="shrink-0 rounded-full px-2 py-[3px] text-[9px] font-semibold uppercase tracking-[0.08em]"
      style={{
        color: complet ? C.or : C.encreDiscrete,
        background: complet ? voile(C.or, 12) : 'rgba(245,244,238,.06)',
        border: `1px solid ${complet ? voile(C.or, 28) : C.ligne}`,
      }}
    >
      {complet ? 'Complet' : 'Plan seul'}
    </span>
  );
}

function CarteExport({ format, slides, projectTitle }) {
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');

  // ⚠️ Logique d'export inchangée (mêmes appels, mêmes arguments, mêmes états).
  const handleExport = async () => {
    if (!slides.length) { setError('Aucun slide à exporter'); return; }
    setStatus('loading');
    setError('');
    try {
      switch (format.id) {
        case 'json': exportProjectJson(slides); break;
        case 'pdf': await exportSlidesPdf(slides, null, { title: projectTitle }); break;
        case 'pptx': await exportSlidesPptx(slides, projectTitle); break;
        case 'student-pdf': await exportStudentPdf(slides, `${projectTitle} — Élève`); break;
        case 'teacher-pdf': await exportTeacherPdf(slides, `${projectTitle} — Prof`); break;
      }
      setStatus('done');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e) {
      setError(e.message ?? 'Erreur inconnue');
      setStatus('error');
    }
  };

  const Icon = format.icon;
  const principal = format.id === 'teacher-pdf'; // seule action pleine, comme avant
  const inactif = status === 'loading' || !slides.length;

  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-4"
      style={{
        background: C.panneau,
        border: `1px solid ${principal ? voile(C.corail, 30) : C.ligne}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            color: format.accent,
            background: voile(format.accent, 12),
            border: `1px solid ${voile(format.accent, 26)}`,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold" style={{ color: C.encre }}>{format.label}</h3>
            <PastillePortee portee={format.portee} />
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: C.encreDouce }}>
            {format.description}
          </p>
        </div>
      </div>

      {/* Réserve : ce que le fichier ne contient PAS, dit sans détour. */}
      {format.reserve && (
        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed" style={{ color: C.encreDiscrete }}>
          <Info className="mt-[1px] h-3 w-3 shrink-0" />
          {format.reserve}
        </p>
      )}

      {status === 'error' && (
        <p className="flex items-center gap-1.5 text-[11px]" style={{ color: C.alerte }}>
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}

      <button
        onClick={handleExport}
        disabled={inactif}
        className="mt-auto flex items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-semibold transition-colors"
        style={{
          background: principal ? C.corail : 'transparent',
          color: principal ? '#241a15' : C.encre,
          border: principal ? '1px solid transparent' : `1px solid ${C.ligne}`,
          opacity: inactif ? 0.4 : 1,
          cursor: inactif ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'loading' ? (
          <><Loader2 className="h-4 w-4 animate-spin" />Export en cours…</>
        ) : status === 'done' ? (
          <><CheckCircle className="h-4 w-4" style={{ color: principal ? '#241a15' : C.or }} />Téléchargé</>
        ) : (
          <><Download className="h-4 w-4" />Télécharger</>
        )}
      </button>
    </div>
  );
}

/** Compteur du bandeau de fin de parcours. */
function Compteur({ valeur, libelle, accentue = false }) {
  return (
    <div>
      <div className="text-[20px] font-bold" style={{ color: accentue ? C.or : C.encre }}>{valeur}</div>
      <div className="text-[10px]" style={{ color: C.encreDiscrete }}>{libelle}</div>
    </div>
  );
}

export default function StudioExportCenterPage() {
  const slides = useSmartboardStore((s) => s.slides);
  const [projectTitle, setProjectTitle] = useState('LIRI SmartBoard');

  const totalElements = slides.reduce(
    (acc, s) => acc + (s.initialState?.elements?.length ?? 0), 0,
  );
  const totalSections = slides.reduce((a, s) => a + (s.sections?.length ?? 0), 0);
  const pret = slides.length > 0;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" style={{ background: C.base, color: C.encre }}>
      {/* En-tête de l'écran. Volontairement MINCE et sans logo : la coque du portail
          (LiriPortalShell, cf. StudioRouter) pose déjà la topbar, la marque et le rail
          moteur juste au-dessus — un second bandeau de marque ferait doublon. */}
      <div
        className="flex shrink-0 items-center gap-3 px-4 py-2.5"
        style={{ background: C.rail, borderBottom: `1px solid ${C.ligne}` }}
      >
        <Link
          to="/studio"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors"
          style={{ color: C.encreDouce, border: `1px solid ${C.ligne}` }}
          onMouseEnter={(e) => { e.currentTarget.style.color = C.corail; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = C.encreDouce; }}
        >
          <ChevronLeft className="h-3.5 w-3.5" />Studio
        </Link>
        <div className="h-5 w-px" style={{ background: C.ligne }} />
        <Download className="h-4 w-4" style={{ color: C.corail }} />
        <h1 className="text-[14px] font-bold" style={{ color: C.encre }}>Centre d&apos;export</h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        {/* ── Fin de parcours ──────────────────────────────────────────────────
            Sobre : une ligne qui dit que le travail est terminé, le nom du fichier
            à emporter, et les trois compteurs. Rien d'inventé — tout vient du store. */}
        <div
          className="rounded-xl p-4"
          style={{
            background: C.panneau,
            border: `1px solid ${pret ? voile(C.corail, 24) : C.ligne}`,
          }}
        >
          {pret && (
            <div className="mb-4 flex items-start gap-2.5">
              <CheckCircle className="mt-[2px] h-4 w-4 shrink-0" style={{ color: C.or }} />
              <div>
                <div className="text-[13px] font-semibold" style={{ color: C.encre }}>
                  Le cours est prêt à être emporté.
                </div>
                <div className="mt-0.5 text-[11px]" style={{ color: C.encreDouce }}>
                  Choisissez un format ci-dessous : le fichier est téléchargé directement
                  sur votre appareil.
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-wider" style={{ color: C.encreDiscrete }}>
                Nom du projet
              </label>
              <input
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-[13px] outline-none transition-colors"
                style={{
                  background: 'rgba(245,244,238,.04)',
                  border: `1px solid ${C.ligne}`,
                  color: C.encre,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = voile(C.corail, 45); }}
                onBlur={(e) => { e.currentTarget.style.borderColor = C.ligne; }}
              />
            </div>
            <div className="flex gap-6 text-center">
              <Compteur valeur={slides.length} libelle="Slides" accentue />
              <Compteur valeur={totalElements} libelle="Éléments" />
              <Compteur valeur={totalSections} libelle="Sections" />
            </div>
          </div>
        </div>

        {!pret && (
          <div
            className="rounded-xl p-4"
            style={{ background: voile(C.or, 8), border: `1px solid ${voile(C.or, 22)}` }}
          >
            <p className="flex items-center gap-2 text-[12px]" style={{ color: C.or }}>
              <AlertTriangle className="h-4 w-4" />
              Aucun slide à exporter. Composez d&apos;abord un cours dans le constructeur de
              formation, puis envoyez-le vers l&apos;éditeur SmartBoard.
            </p>
          </div>
        )}

        {/* Ce que contiennent réellement les fichiers — dit une fois, en haut de la
            grille, pour que la nuance ne se découvre pas après le téléchargement. */}
        <p className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: C.encreDiscrete }}>
          <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
          Le JSON conserve l&apos;intégralité du projet. Les exports PDF et PowerPoint
          reprennent aujourd&apos;hui le plan du cours — titres et sections — et non le rendu
          visuel des scènes du SmartBoard.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FORMATS_EXPORT.map((format) => (
            <CarteExport key={format.id} format={format} slides={slides} projectTitle={projectTitle} />
          ))}
        </div>
      </div>
    </div>
  );
}
