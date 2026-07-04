import React from 'react';
import { Link } from 'react-router-dom';
import {
  Film, Image as ImageIcon, Type, Sparkles, Info, Camera, Radio, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { usePostProdNleStore } from '@/features/smartboard-konva-editor/store/usePostProdNleStore';

/** @typedef {'source'|'transcript'|'segments'|'nle'|'pipeline'|'assistant'|'properties'} PostProdToolId */
/** @typedef {'video'|'image'|'text'} PropertyKind */

const ACCENT = {
  amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/12',   border: 'border-amber-500/28',   glow: 'shadow-[0_0_12px_rgba(245,158,11,0.2)]' },
  violet:  { text: 'text-violet-400',  bg: 'bg-violet-500/12',  border: 'border-violet-500/28',  glow: 'shadow-[0_0_12px_rgba(236,174,144,0.2)]' },
  cyan:    { text: 'text-cyan-400',    bg: 'bg-cyan-500/12',    border: 'border-cyan-500/28',    glow: 'shadow-[0_0_12px_rgba(227,170,107,0.2)]' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/12', border: 'border-emerald-500/28', glow: 'shadow-[0_0_12px_rgba(207,128,89,0.2)]' },
  rose:    { text: 'text-rose-400',    bg: 'bg-rose-500/12',    border: 'border-rose-500/28',    glow: 'shadow-[0_0_12px_rgba(251,113,133,0.2)]' },
  orange:  { text: 'text-orange-400',  bg: 'bg-orange-500/12',  border: 'border-orange-500/28', glow: 'shadow-[0_0_12px_rgba(251,146,60,0.2)]' },
};

function SectionLabel({ children }) {
  return (
    <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-white/22">{children}</p>
  );
}

function DockHint({ title, children }) {
  return (
    <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/[0.06] px-2 py-1.5">
      <p className="text-[10px] font-medium text-cyan-100/90">{title}</p>
      <div className="mt-1 text-[9px] leading-relaxed text-white/40">{children}</div>
    </div>
  );
}

function RoadmapNote({ children }) {
  return <p className="text-[8px] leading-snug text-white/22">{children}</p>;
}

function NleDockControls() {
  const grade = usePostProdNleStore((s) => s.grade);
  const setGrade = usePostProdNleStore((s) => s.setGrade);
  const resetGrade = usePostProdNleStore((s) => s.resetGrade);
  const row = (key, label, min, max, step) => (
    <div className="space-y-1">
      <div className="flex justify-between gap-2">
        <Label className="text-[9px] text-white/45">{label}</Label>
        <span className="font-mono text-[9px] text-white/35">{Math.round(Number(grade[key]) || 0)}</span>
      </div>
      <Slider
        value={[Number(grade[key]) || 0]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => setGrade({ [key]: Array.isArray(v) ? v[0] : v })}
        className="py-0.5"
      />
    </div>
  );
  return (
    <div className="space-y-2 rounded-lg border border-orange-500/20 bg-orange-500/[0.06] p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-semibold text-orange-100/90">Étalonnage (aperçu)</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[8px] text-white/35 hover:text-white/70"
          onClick={() => resetGrade()}
          title="Réinitialiser"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>
      <p className="text-[8px] leading-snug text-white/30">
        Filtres CSS sur la preview — enregistrés dans <span className="font-mono text-white/45">data.nle</span> avec Valider.
      </p>
      {row('exposure', 'Luminosité', -100, 100, 1)}
      {row('contrast', 'Contraste %', 0, 200, 1)}
      {row('saturation', 'Saturation %', 0, 200, 1)}
      {row('warmth', 'Chaleur', -100, 100, 1)}
    </div>
  );
}

/** Propriétés : prévisualisation SmartBoard réelle dans la zone centrale ; étalonnage NLE ; reste roadmap */
function PropertiesByKind({ kind }) {
  if (kind === 'video') {
    return (
      <div className="space-y-2">
        <NleDockControls />
        <DockHint title="Vue SmartBoard (active)">
          La zone principale affiche le split vidéo + slides / script selon le mode choisi (barre « Mode SmartBoard » au-dessus
          quand cet onglet est actif). C'est le même moteur que la page post-prod plein écran.
        </DockHint>
        <SectionLabel>Roadmap montage avancé</SectionLabel>
        <RoadmapNote>Transitions, time-remap multi-piste — hors scope de ce module.</RoadmapNote>
      </div>
    );
  }
  if (kind === 'image') {
    return (
      <div className="space-y-2">
        <SectionLabel>Image — roadmap</SectionLabel>
        <RoadmapNote>LUT, calibration, HSL — hors scope de la post-prod pédagogique actuelle.</RoadmapNote>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <SectionLabel>Texte — roadmap</SectionLabel>
      <RoadmapNote>Typo calque / animation — à brancher sur la sélection Konva et la timeline.</RoadmapNote>
    </div>
  );
}

/**
 * Panneau latéral central du dock post-prod : sous-outils et propriétés (comme ContextualPanel Konva).
 *
 * @param {{
 *   activeTool: PostProdToolId;
 *   propertyKind: PropertyKind;
 *   onPropertyKindChange: (k: PropertyKind) => void;
 *   contentLoaded: boolean;
 *   draft: string;
 *   draftValid: boolean;
 *   onDraftChange: (v: string) => void;
 *   onApplyContentId: () => void;
 *   onOpenVideoStudio?: () => void;
 *   designerBackHref?: string | null;
 * }} props
 */
export function PostProductionContextPanel({
  activeTool,
  propertyKind,
  onPropertyKindChange,
  contentLoaded,
  draft,
  draftValid,
  onDraftChange,
  onApplyContentId,
  onOpenVideoStudio,
  designerBackHref = null,
}) {
  const locked = !contentLoaded && activeTool !== 'source';

  return (
    <div className="flex h-full min-h-0 w-[220px] flex-shrink-0 flex-col overflow-hidden border-r border-white/[0.06]" style={{ background: '#1f1e1c' }}>
      <div className="shrink-0 border-b border-white/[0.06] px-2.5 py-2">
        <p className="text-[10px] font-semibold text-white/70">Sous-outils</p>
        <p className="text-[9px] text-white/30">Varie selon l'onglet actif</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.08)_transparent]">
        {locked ? (
          <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-2 text-[10px] leading-snug text-amber-100/85">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/90" />
            <span>
              Chargez d'abord un contenu (onglet <strong className="text-amber-200/95">Source</strong>) pour utiliser cet
              outil. Les réglages ci-dessous sont des emplacements pour la suite du montage dans le designer.
            </span>
          </div>
        ) : null}

        {activeTool === 'source' && (
          <div className="space-y-2">
            <SectionLabel>Source & import</SectionLabel>
            <p className="text-[10px] leading-relaxed text-white/40">
              Identifiant du contenu vidéo (formation). Les données viennent de la même base que la page post-production
              dédiée.
            </p>
            {typeof onOpenVideoStudio === 'function' ? (
              <button
                type="button"
                onClick={onOpenVideoStudio}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 py-2 text-[10px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/18"
              >
                <Camera className="h-3.5 w-3.5 shrink-0" />
                Capturer ou importer
              </button>
            ) : null}
            <p className="text-[9px] leading-snug text-white/28">
              Webcam, téléphone (QR), écran, fichier — même flux que le constructeur de cours. Ensuite validation pour
              ouvrir la post-prod ici (brouillon si pas encore en base).
            </p>
            <div className="h-px bg-white/[0.06]" />
            <p className="text-[9px] font-medium uppercase tracking-wide text-white/25">Ou coller un UUID existant</p>
            <input
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && draftValid && onApplyContentId()}
              placeholder="UUID…"
              className="w-full rounded-lg border border-white/10 bg-black/35 px-2 py-1.5 font-mono text-[10px] text-white/80 placeholder:text-white/20 focus:border-amber-500/35 focus:outline-none"
            />
            <button
              type="button"
              disabled={!draftValid}
              onClick={onApplyContentId}
              className={cn(
                'w-full rounded-lg border py-1.5 text-[10px] font-semibold transition-colors',
                draftValid
                  ? 'border-amber-500/35 bg-amber-500/10 text-amber-200 hover:bg-amber-500/18'
                  : 'cursor-not-allowed border-white/10 text-white/25',
              )}
            >
              Charger le contenu
            </button>
            <Link
              to="/studio/course-builder"
              state={designerBackHref ? { returnToDesigner: designerBackHref } : undefined}
              className="block text-center text-[9px] text-amber-500/50 hover:text-amber-400/90"
            >
              Configurateur de formation →
            </Link>
            <div className="h-px bg-white/[0.06]" />
            <SectionLabel>Live & NeuroRecall</SectionLabel>
            <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-white/38">
              <Radio className="mt-0.5 h-3 w-3 shrink-0 text-rose-400/70" />
              Après un live avec NeuroRecall, un contenu post-prod peut être créé : récupérez l'UUID (
              <code className="rounded bg-black/40 px-0.5 font-mono text-[8px] text-white/55">postproduction_content_id</code>
              ) dans la fiche post-live ou collez-le ci-dessus.
            </p>
            <Link
              to="/studio/liri"
              className="block text-center text-[9px] text-rose-400/45 hover:text-rose-300/90"
            >
              Hub LIRI — lives & parcours →
            </Link>
            <Link
              to="/studio/smartboard-cinema"
              className="mt-1 flex items-center justify-center gap-1 text-center text-[9px] text-violet-400/55 hover:text-violet-300/90"
            >
              <Film className="h-3 w-3 shrink-0" />
              Cinéma pédagogique (prises sur le canvas) →
            </Link>
          </div>
        )}

        {activeTool === 'transcript' && (
          <div className="space-y-2">
            <SectionLabel>Transcription</SectionLabel>
            <DockHint title="Synchronisé avec la zone centrale">
              L'icône <strong className="text-white/55">Transcription</strong> ouvre le workflow classique et fait défiler
              jusqu'au bloc Transcription (ASR, éditeur, export). Toute action se fait dans le panneau principal.
            </DockHint>
          </div>
        )}

        {activeTool === 'segments' && (
          <div className="space-y-2">
            <SectionLabel>Segments & chapitres</SectionLabel>
            <DockHint title="Synchronisé">
              Défilement vers la carte <strong className="text-white/55">Chapitres</strong> : IN/OUT, validation
              progressive, alignement avec la preview.
            </DockHint>
          </div>
        )}

        {activeTool === 'nle' && (
          <div className="space-y-2">
            <SectionLabel>Montage NLE</SectionLabel>
            <DockHint title="Timeline multi-piste">
              La zone centrale affiche <strong className="text-white/55">NleEngineWorkspace</strong> (timeline, clips,
              transitions) — même vue que l'onglet « Montage NLE » de la page post-prod plein écran. Les sources
              additionnelles pour l'export FFmpeg sont sous la timeline.
            </DockHint>
          </div>
        )}

        {activeTool === 'pipeline' && (
          <div className="space-y-2">
            <SectionLabel>Pipeline IA</SectionLabel>
            <DockHint title="Vue Pipeline">
              Bascule la zone centrale vers <strong className="text-white/55">CoursePipelineView</strong> (graphe,
              étapes, même invocation edge functions que la page dédiée).
            </DockHint>
          </div>
        )}

        {activeTool === 'assistant' && (
          <div className="space-y-2">
            <SectionLabel>Assistance IA</SectionLabel>
            <DockHint title="Vue Assistance">
              Panneau segment IA (génération, validation, illustrations) — identique à l'onglet « Assistance IA » plein
              écran. Choisis un chapitre actif dans le workflow classique si besoin.
            </DockHint>
          </div>
        )}

        {activeTool === 'properties' && (
          <div className="space-y-3">
            <SectionLabel>Propriétés & SmartBoard</SectionLabel>
            <p className="text-[9px] text-white/35">
              Ouvre la vue <strong className="text-white/50">SmartBoard</strong> (split vidéo + contenu). Les onglets
              vidéo / image / texte ci-dessous décrivent la roadmap ; le rendu utile est dans la zone centrale.
            </p>
            <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-black/25 p-0.5">
              {(
                /** @type {{ id: PropertyKind; Icon: typeof Film; label: string }[]} */
                [
                  { id: 'video', Icon: Film, label: 'Vidéo' },
                  { id: 'image', Icon: ImageIcon, label: 'Image' },
                  { id: 'text', Icon: Type, label: 'Texte' },
                ]
              ).map(({ id, Icon, label }) => {
                const on = propertyKind === id;
                const a = ACCENT[id === 'video' ? 'amber' : id === 'image' ? 'violet' : 'cyan'];
                return (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    onClick={() => onPropertyKindChange(id)}
                    className={cn(
                      'flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-[8px] font-semibold transition-all',
                      on ? cn(a.bg, a.border, 'border text-white/90', a.glow) : 'text-white/35 hover:bg-white/[0.04]',
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', on ? a.text : '')} />
                    {label}
                  </button>
                );
              })}
            </div>
            <PropertiesByKind kind={propertyKind} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.06] px-2 py-1.5">
        <p className="flex items-center gap-1 text-[8px] text-white/22">
          <Sparkles className="h-2.5 w-2.5" />
          Dock relié à la zone centrale — onglets = vues + défilement
        </p>
      </div>
    </div>
  );
}
