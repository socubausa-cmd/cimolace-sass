import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clapperboard,
  ExternalLink,
  Loader2,
  X,
  Link2,
  ArrowLeft,
  Subtitles,
  Scissors,
  GitBranch,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PostProductionContextPanel } from '@/pages/studio-creator/studio/PostProductionDockPanels';
import VideoUploadModal from '@/components/school/formations/VideoUploadModal';
import { useToast } from '@/components/ui/use-toast';
import { useTenantBranding } from '@/hooks/useTenantBranding';

const VideoPostProductionPage = lazy(() => import('@/pages/VideoPostProductionPage'));

function newUuid() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const isUuid = (value) => {
  if (!value) return false;
  const s = String(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
};

const PP_ACCENTS = {
  amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   glow: 'shadow-[0_0_12px_rgba(245,158,11,0.22)]' },
  violet:  { text: 'text-violet-400',  bg: 'bg-violet-500/15',  border: 'border-violet-500/30',  glow: 'shadow-[0_0_12px_rgba(236,174,144,0.22)]' },
  cyan:    { text: 'text-cyan-400',    bg: 'bg-cyan-500/15',    border: 'border-cyan-500/30',    glow: 'shadow-[0_0_12px_rgba(227,170,107,0.22)]' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', glow: 'shadow-[0_0_12px_rgba(207,128,89,0.22)]' },
  rose:    { text: 'text-rose-400',    bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    glow: 'shadow-[0_0_12px_rgba(251,113,133,0.22)]' },
  orange:  { text: 'text-orange-400',  bg: 'bg-orange-500/15',  border: 'border-orange-500/30',  glow: 'shadow-[0_0_12px_rgba(251,146,60,0.22)]' },
};

const POST_PROD_TOOLS = [
  { id: 'source',      icon: Link2,           label: 'Source',        accent: 'amber' },
  { id: 'transcript',  icon: Subtitles,       label: 'Transcription', accent: 'cyan' },
  { id: 'segments',    icon: Scissors,        label: 'Segments',      accent: 'violet' },
  { id: 'nle',         icon: Clapperboard,    label: 'Montage NLE',   accent: 'orange' },
  { id: 'pipeline',    icon: GitBranch,       label: 'Pipeline',      accent: 'emerald' },
  { id: 'assistant',   icon: Sparkles,        label: 'IA',            accent: 'rose' },
  { id: 'properties',  icon: SlidersHorizontal, label: 'Propriétés', accent: 'orange' },
];

function PostProdToolStrip({ activeTool, onTool }) {
  return (
    <aside
      className="flex w-12 flex-shrink-0 flex-col gap-0.5 border-r border-white/[0.07] px-1.5 py-2"
      style={{ background: '#1f1e1c' }}
    >
      {POST_PROD_TOOLS.map((tool) => {
        const Icon = tool.icon;
        const a = PP_ACCENTS[tool.accent] ?? PP_ACCENTS.amber;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            title={tool.label}
            onClick={() => onTool(tool.id)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150',
              isActive ? [a.bg, 'border', a.border, a.glow] : 'border border-transparent text-white/30 hover:bg-white/[0.06] hover:text-white/60',
            )}
          >
            <Icon className={cn('h-4 w-4', isActive ? a.text : '')} />
          </button>
        );
      })}
      <div className="flex-1 min-h-[8px]" />
    </aside>
  );
}

/**
 * Panneau post-production : barre d'icônes (comme outils gauche) + panneau contextuel + zone principale.
 *
 * @param {{
 *   contentId: string;
 *   onContentIdChange: (id: string) => void;
 *   onClose: () => void;
 *   returnToHref?: string | null;
 *   designerBackHref?: string | null;
 * }} props
 */
export default function DesignerPostProductionDock({
  contentId,
  onContentIdChange,
  onClose,
  returnToHref = null,
  designerBackHref = null,
}) {
  const { toast } = useToast();
  const { branding, cssVars, shellTheme } = useTenantBranding();
  const [draft, setDraft] = useState(contentId || '');
  const parentId = (contentId || '').trim();
  const parentValid = isUuid(parentId);
  const trimmedDraft = (draft || '').trim();
  const draftValid = isUuid(trimmedDraft);

  const [activeTool, setActiveTool] = useState(
    /** @type {'source'|'transcript'|'segments'|'nle'|'pipeline'|'assistant'|'properties'} */ ('source'),
  );
  const [propertyKind, setPropertyKind] = useState(/** @type {'video'|'image'|'text'} */ ('video'));
  const [videoStudioOpen, setVideoStudioOpen] = useState(false);
  /** Données `formation_day_contents.data` quand la vidéo n'est pas encore en base (même logique que la page post-prod). */
  const [syntheticVideoData, setSyntheticVideoData] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const skipClearSyntheticOnParentIdRef = useRef(false);

  useEffect(() => {
    if (parentId) setDraft(parentId);
  }, [parentId]);

  useEffect(() => {
    if (skipClearSyntheticOnParentIdRef.current) {
      skipClearSyntheticOnParentIdRef.current = false;
      return;
    }
    setSyntheticVideoData(null);
  }, [parentId]);

  const applyDraft = useCallback(() => {
    if (!draftValid) return;
    if (trimmedDraft !== parentId) setSyntheticVideoData(null);
    onContentIdChange(trimmedDraft);
  }, [onContentIdChange, trimmedDraft, draftValid, parentId]);

  const handleStudioSave = useCallback(
    (saved) => {
      const rawId = saved?.id;
      const id = rawId && isUuid(String(rawId)) ? String(rawId) : newUuid();
      skipClearSyntheticOnParentIdRef.current = true;
      const durationSeconds =
        Number(saved?.duration_seconds) > 0
          ? Math.round(Number(saved.duration_seconds))
          : saved?.type === 'upload' && Number(saved?.duration) > 0
            ? Math.round(Number(saved.duration) * 60)
            : 0;
      setSyntheticVideoData({
        url: String(saved?.url || ''),
        storagePath: String(saved?.storagePath || ''),
        title: String(saved?.title || ''),
        description: String(saved?.description || ''),
        duration_seconds: durationSeconds,
      });
      onContentIdChange(id);
      setVideoStudioOpen(false);
      toast({
        title: 'Vidéo prête',
        description:
          "Post-production ouverte en brouillon. Enregistrez une formation pour persister le contenu en base et activer toute l'IA serveur.",
      });
    },
    [onContentIdChange, toast],
  );

  const onTool = useCallback((id) => {
    setActiveTool(id);
  }, []);

  const onEmbeddedViewChange = useCallback((tool) => {
    setActiveTool(tool);
  }, []);

  const externalPostProdOrBuilderHref = parentValid
    ? `/studio/post-production/${parentId}${
        designerBackHref ? `?returnTo=${encodeURIComponent(designerBackHref)}` : ''
      }`
    : `/studio/course-builder${
        designerBackHref ? `?designerReturn=${encodeURIComponent(designerBackHref)}` : ''
      }`;

  return (
    <>
    <aside
      className="flex h-full min-h-0 w-[min(100vw,460px)] max-w-[100vw] flex-shrink-0 flex-col overflow-hidden border-l border-white/[0.07]"
      style={{
        background: 'var(--school-shell-panel, #1f1e1c)',
        fontFamily: 'var(--school-font-family, Inter, system-ui, sans-serif)',
        ...cssVars,
      }}
      data-school-shell="post-production-dock"
      data-tenant-brand={branding.name}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-3 py-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400" style={{ borderRadius: 'var(--school-radius, 12px)' }}>
          <Clapperboard className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-white/80">Post-production</p>
          <p className="truncate text-[9px] text-white/30">Outils · sous-panneaux · workflow</p>
        </div>
        {returnToHref ? (
          <Link
            to={returnToHref}
            title={
              returnToHref.includes('/studio/course-builder')
                ? 'Retour au configurateur de cours'
                : 'Retour'
            }
            className="flex max-w-[min(140px,32vw)] shrink-0 items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-2 py-1 text-[9px] font-semibold text-amber-100/90 transition-colors hover:bg-amber-500/15"
            style={{ borderRadius: 'var(--school-radius, 12px)' }}
          >
            <ArrowLeft className="h-3 w-3 shrink-0 opacity-90" />
            <span className="truncate">
              {returnToHref.includes('/studio/course-builder') ? 'Configurateur' : 'Retour'}
            </span>
          </Link>
        ) : null}
        <Link
          to={externalPostProdOrBuilderHref}
          target="_blank"
          rel="noreferrer"
          title={
            designerBackHref
              ? "Ouvrir dans un onglet (retour designer conservé via l'URL)"
              : "Ouvrir dans un onglet"
          }
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/25 transition-colors hover:bg-white/[0.06] hover:text-amber-400/90"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          title="Fermer le panneau"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/70"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <PostProdToolStrip activeTool={activeTool} onTool={onTool} />
        <PostProductionContextPanel
          activeTool={activeTool}
          propertyKind={propertyKind}
          onPropertyKindChange={setPropertyKind}
          contentLoaded={parentValid}
          draft={draft}
          draftValid={draftValid}
          onDraftChange={setDraft}
          onApplyContentId={applyDraft}
          onOpenVideoStudio={() => setVideoStudioOpen(true)}
          designerBackHref={designerBackHref}
        />
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          style={shellTheme.gridBackground}
        >
          {!parentValid ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-6 text-center">
              {/* Icône centrale */}
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] text-amber-400/60 shadow-[0_0_24px_rgba(245,158,11,0.1)]">
                <Clapperboard className="h-8 w-8" />
              </div>

              {/* Titre + sous-titre */}
              <div>
                <p className="text-[13px] font-bold text-white/70">Post-production</p>
                <p className="mt-1 text-[10px] leading-relaxed text-white/35">
                  Importez ou liez une vidéo pour démarrer le studio.
                </p>
              </div>

              {/* CTA principal — ouvre directement la modale d'import */}
              <button
                type="button"
                onClick={() => { onTool('source'); setVideoStudioOpen(true); }}
                className="flex w-full max-w-[180px] items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/[0.12] px-3 py-2.5 text-[11px] font-semibold text-cyan-200 shadow-[0_0_12px_rgba(227,170,107,0.12)] transition-all hover:bg-cyan-500/20"
                style={{ borderRadius: 'var(--school-radius, 12px)' }}
              >
                <span className="text-[12px]">📹</span>
                Capturer ou importer
              </button>

              {/* Ou UUID */}
              <p className="text-[9px] text-white/25">ou collez un UUID dans l'onglet <span className="text-amber-400/70">Source ←</span></p>

              <div className="h-px w-full max-w-[160px] bg-white/[0.06]" />

              <Link
                to="/studio/course-builder"
                state={designerBackHref ? { returnToDesigner: designerBackHref } : undefined}
                className="text-[9px] text-amber-500/50 underline-offset-2 hover:text-amber-400/90 hover:underline"
              >
                Créer un contenu vidéo via le Course Builder →
              </Link>
            </div>
          ) : (
            <>
              {syntheticVideoData ? (
                <div className="shrink-0 border-b border-amber-500/25 bg-amber-500/[0.07] px-3 py-2">
                  <p className="text-[10px] font-medium text-amber-100/95">Mode brouillon</p>
                  <p className="mt-0.5 text-[9px] leading-snug text-amber-100/65">
                    Cette vidéo n'est pas encore liée à une journée de formation. Créez ou mettez à jour un cours pour
                    enregistrer la ligne en base et débloquer la sauvegarde complète.
                  </p>
                  <Link
                    to="/studio/course-builder"
                    state={{
                      courseBuilderPrefill: {
                        video_url: String(syntheticVideoData.url || ''),
                        video_storage_path: String(syntheticVideoData.storagePath || ''),
                        title: String(syntheticVideoData.title || ''),
                        description: String(syntheticVideoData.description || ''),
                        duration_seconds: Number(syntheticVideoData.duration_seconds) || 0,
                      },
                      ...(designerBackHref ? { returnToDesigner: designerBackHref } : {}),
                    }}
                    className="mt-1 inline-block text-[9px] font-semibold text-amber-400/90 underline-offset-2 hover:underline"
                  >
                    Ouvrir le configurateur de formation →
                  </Link>
                </div>
              ) : null}
              <div className="min-h-0 flex-1 overflow-auto">
                <Suspense
                  fallback={
                    <div className="flex min-h-[16rem] items-center justify-center bg-[#0F1419]">
                      <Loader2 className="h-6 w-6 animate-spin text-[var(--school-accent)]" />
                    </div>
                  }
                >
                  <VideoPostProductionPage
                    contentId={parentId}
                    videoData={syntheticVideoData}
                    onClose={onClose}
                    embeddedUiMode="designer-dock"
                    syncedDockTool={activeTool}
                    onEmbeddedViewChange={onEmbeddedViewChange}
                  />
                </Suspense>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
    {videoStudioOpen && <VideoUploadModal isOpen={true} onClose={() => setVideoStudioOpen(false)} onSave={handleStudioSave} />}
    </>
  );
}
