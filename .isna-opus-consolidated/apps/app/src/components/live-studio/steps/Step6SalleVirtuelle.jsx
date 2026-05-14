import React, { useMemo, useState, useRef, useEffect, useCallback, startTransition } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  MessageSquare,
  Hand,
  Monitor,
  Mic,
  Video,
  CircleDot,
  Shield,
  DoorOpen,
  CheckCircle2,
  Sparkles,
  LayoutPanelLeft,
  Globe,
  Pencil,
  Image as ImageIcon,
  Camera,
  Presentation,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Link as LinkIcon,
  ShoppingCart,
  DollarSign,
  ExternalLink,
  FileText,
  Wand2,
  Download,
  ChevronLeft,
  ChevronRight,
  Check,
  MonitorPlay,
  Info,
  Eye,
  Users,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { resolveArchitectDesignCanvasForApiRequest } from '@/lib/smartboardDesignCanvas';

/** Progression estimée pendant l’appel long à smartboard-ia-generate (pas de streaming serveur). */
function computeSmartboardArchitectProgress(elapsedMs) {
  if (elapsedMs < 20000) {
    const t = elapsedMs / 20000;
    return {
      pct: Math.round(4 + t * 34),
      label: 'Étape 1/2 — Analyse pédagogique (Claude → DeepSeek → Grok)…',
    };
  }
  if (elapsedMs < 70000) {
    const t = (elapsedMs - 20000) / 50000;
    return {
      pct: Math.round(38 + t * 44),
      label: 'Étape 2/2 — Génération du deck SmartBoard (JSON + MasterScript)…',
    };
  }
  const over = Math.min(elapsedMs - 70000, 180000);
  const ease = 1 - Math.exp(-over / 55000);
  return {
    pct: Math.min(93, Math.round(82 + ease * 11)),
    label: 'Finalisation — le modèle termine la structure des slides…',
  };
}
import SlideParallaxStage from '@/components/live-room/SlideParallaxStage';
import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';
import { invokeFunctionWithAuthRetry, runStorageWithAuthRetry } from '@/lib/supabaseResilience';
import {
  buildInfographicTemplateScenes,
  buildMasterScriptFromScenes,
} from '@/lib/smartboardWizardScenes';
import { listScenes } from '@/services/liveProduction/liveScenes';
import { parsePayload, inferUploadedSlideKind, getDocumentEmbedSrc } from '@/lib/liveSceneNormalize';
import { useToast } from '@/components/ui/use-toast';
import { mapIAResponseToDraft } from '@/lib/smartboardIAMapper';
import { mapMindmapCourseResponseToDraft } from '@/lib/mapMindmapCourseToDraft';
import { pushWizardSmartboardToLiveScenes } from '@/lib/pushWizardSmartboardToLiveScenes';
import {
  consumePendingArchitectForLiveStudio,
  consumePendingMasterclassForLiveStudio,
  consumePendingLiriCourseForLiveStudio,
  LIRI_AGENT_PENDING_LIVE_KEY,
} from '@/lib/liriAgentExportToLiveStudio';
import { invokeLongiaGuestLive } from '@/lib/longiaGuestClient';
import {
  buildMasterclassJsonInstruction,
  tryParseMasterclassJson,
  normalizeMasterclassOutput,
  evaluateMasterclassQuality,
  buildMasterclassRepairInstruction,
  buildArchitectSourceFromMasterclass,
} from '@/lib/liri-masterclass/engine';

const GROUPS = [
  {
    key: 'communication',
    title: 'Communication',
    description: 'Canaux de dialogue pendant la session',
    options: [
      { key: 'chat_enabled', label: 'Chat live', desc: 'Messagerie en direct', icon: MessageSquare },
      { key: 'student_audio_enabled', label: 'Micro élèves', desc: 'Les élèves peuvent parler', icon: Mic },
    ],
  },
  {
    key: 'participation',
    title: 'Participation',
    description: 'Engagement et interactions élèves',
    options: [
      { key: 'hand_raise_enabled', label: 'Lever la main', desc: 'Demandes de parole encadrées', icon: Hand },
      { key: 'student_video_enabled', label: 'Caméra élèves', desc: 'Participation vidéo des élèves', icon: Video },
    ],
  },
  {
    key: 'diffusion',
    title: 'Diffusion',
    description: 'Contrôle de la diffusion de contenu',
    options: [
      { key: 'screen_share_enabled', label: "Partage d'écran", desc: 'Diffusion visuelle interactive', icon: Monitor },
      { key: 'recording_enabled', label: 'Enregistrement', desc: 'Archive de la session', icon: CircleDot },
    ],
  },
  {
    key: 'confidentialite',
    title: 'Confidentialité',
    description: 'Protection et contrôle des accès',
    options: [
      { key: 'waiting_room', label: "Salle d'attente", desc: 'Entrées filtrées avant admission', icon: DoorOpen },
      { key: 'manual_approval', label: 'Validation manuelle', desc: 'Validation individuelle des participants', icon: CheckCircle2 },
      { key: 'visibility_mode', label: 'Mode secret classroom', desc: 'Élèves invisibles entre eux', icon: Shield, isModeToggle: true },
    ],
  },
];

const SALLE_SUBSTEP_META = [
  {
    key: 'salle',
    label: 'Salle & interaction',
    description: 'Chat, micro, partage, salle d’attente, mode secret…',
    icon: Users,
  },
  {
    key: 'programme',
    label: 'Programme SmartBoard',
    description: 'Scènes du cours, script, imports Architect / LIRI.',
    icon: FileText,
  },
  {
    key: 'joker',
    label: 'Joker — switch de scènes',
    description: 'Liste des scènes sur l’écran intelligent (type OBS).',
    icon: LayoutPanelLeft,
  },
];

const COACH_PIPELINE_STEPS = [
  { key: 'analyse', label: 'Analyse du texte' },
  { key: 'extract_blocks', label: 'Extraction des blocs de sens' },
  { key: 'create_chapters', label: 'Création des chapitres' },
  { key: 'build_pedagogy', label: 'Assemblage pédagogique' },
  { key: 'build_scripts', label: 'Génération du script' },
  { key: 'build_mindmap', label: 'Construction mindmap / plan' },
  { key: 'quality', label: 'Contrôle qualité' },
  { key: 'repair', label: 'Correction automatique' },
  { key: 'design', label: 'Génération SmartBoard Architect' },
  { key: 'done', label: 'Terminé' },
];

function getCoachPipelineIndex(stageKey) {
  const idx = COACH_PIPELINE_STEPS.findIndex((step) => step.key === stageKey);
  return idx < 0 ? -1 : idx;
}

function getCoachPipelinePercent(stageKey) {
  const idx = getCoachPipelineIndex(stageKey);
  if (idx < 0) return 0;
  if (stageKey === 'done') return 100;
  const total = COACH_PIPELINE_STEPS.length;
  return Math.max(4, Math.min(96, Math.round(((idx + 1) / total) * 100)));
}

function compactArchitectSourceText(input, maxChars = 5200) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw.length <= maxChars) return raw;
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  const picked = [];
  let size = 0;
  for (const line of lines) {
    const isPriority =
      /^sujet global:/i.test(line) ||
      /^révélations globales:/i.test(line) ||
      /^thèmes centraux:/i.test(line) ||
      /^chapitre /i.test(line) ||
      /^objectif:/i.test(line) ||
      /^compétence:/i.test(line) ||
      /^connaissance:/i.test(line) ||
      /^révélation:/i.test(line) ||
      /^leçon simple:/i.test(line) ||
      /^leçon développée:/i.test(line) ||
      /^transition:/i.test(line);
    if (!isPriority) continue;
    const nextSize = size + line.length + 1;
    if (nextSize > maxChars) break;
    picked.push(line);
    size = nextSize;
  }
  const compact = picked.join('\n').trim();
  return compact || raw.slice(0, maxChars);
}

function StageReviewScreen({ stageKey, title, items = [], data = {} }) {
  const chips = Array.isArray(items) ? items.filter(Boolean).slice(0, 8) : [];
  const chapters = Array.isArray(data?.chapters) ? data.chapters : [];
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const stats = data?.stats || {};
  const activeStepNumber = Number(data?.stepNumber) || 1;
  const stepTitles = [
    'Texte brut',
    'Analyse IA',
    'Blocs & idées révélées',
    'Construction des chapitres',
    'Pédagogie & activités',
    'Slides SmartBoard',
    'Script & documents',
    'Export multi-formats',
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#7B61FF]/25 bg-[#7B61FF]/[0.08] p-3">
        <div className="mb-2 flex items-center gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
            const done = num < activeStepNumber;
            const active = num === activeStepNumber;
            return (
              <div
                key={num}
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                  active
                    ? 'bg-[#7B61FF] text-white shadow-[0_0_18px_-6px_rgba(123,97,255,0.9)]'
                    : done
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/10 text-gray-500'
                }`}
              >
                {num}
              </div>
            );
          })}
          <span className="ml-1 text-[10px] uppercase tracking-[0.16em] text-[#c4b5fd]">Validation d'étape</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-white">{title || 'Aperçu du rendu'}</p>
        <p className="mt-1 text-[11px] text-gray-300">Écran {activeStepNumber}/8 · {stepTitles[activeStepNumber - 1] || 'Étape'}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-white/10 bg-[#0A101D] p-3">
          <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">
            {stageKey === 'extract_blocks'
              ? 'Blocs & idées révélées'
              : stageKey === 'build_mindmap'
                ? 'Construction des chapitres'
                : stageKey === 'quality'
                  ? 'Pédagogie & activités'
                  : 'Validation avant SmartBoard'}
          </p>
          <div className="space-y-2">
            {chips.length ? chips.map((line, idx) => (
              <div key={`${line}-${idx}`} className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-xs text-gray-200">
                {line}
              </div>
            )) : (
              <p className="text-xs text-gray-500">Aucun élément de résumé disponible.</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-[#0A101D] p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Blocs</p>
              <p className="mt-1 text-xl font-bold text-white">{stats.blocks ?? blocks.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0A101D] p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Chapitres</p>
              <p className="mt-1 text-xl font-bold text-white">{stats.chapters ?? chapters.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0A101D] p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Slides</p>
              <p className="mt-1 text-xl font-bold text-white">{stats.slides ?? 0}</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0A101D] p-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">Checklist de validation</p>
            <div className="space-y-1.5">
              {(stageKey === 'extract_blocks'
                ? ['Sujet global cohérent', 'Blocs ordonnés par progression', 'Idées centrales exploitables']
                : stageKey === 'build_mindmap'
                  ? ['Chapitres clairs', 'Compétences associées', 'Script et mindmap alignés']
                  : stageKey === 'quality'
                    ? ['Contrôle qualité validé', 'Champs pédagogiques complets', 'Plan prêt à designer']
                    : ['Plan confirmé', 'Compétences coach injectées', 'Prêt pour slides Architect']
              ).map((point) => (
                <p key={point} className="flex items-center gap-2 text-xs text-gray-200">
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  {point}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Indicateur 1/3 — 2/3 — 3/3 (navigation uniquement via Précédent / Suivant du wizard) — shell Live Studio */
function Step6SalleSubstepIndicator({ activeIndex, programSceneCount, importedSlideCount }) {
  return (
    <div className="rounded-2xl border border-[#2D3139] bg-[#0d0f14]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
        Étape 6 · Salle virtuelle ·{' '}
        <span className="tabular-nums text-[#7B61FF]">{activeIndex + 1}</span>
        <span className="text-gray-600"> / </span>
        {SALLE_SUBSTEP_META.length}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {SALLE_SUBSTEP_META.map((meta, i) => {
          const Icon = meta.icon;
          const done = i < activeIndex;
          const current = i === activeIndex;
          const pending = i > activeIndex;
          const countBadge =
            meta.key === 'programme' && programSceneCount > 0
              ? programSceneCount
              : meta.key === 'joker' && importedSlideCount > 0
                ? importedSlideCount
                : null;
          return (
            <div
              key={meta.key}
              className={cn(
                'flex gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200',
                current &&
                  'border-[#7B61FF]/45 bg-[#7B61FF]/[0.07] shadow-[0_0_0_1px_rgba(123,97,255,0.15)] ring-1 ring-[#7B61FF]/20',
                done && !current && 'border-emerald-500/25 bg-emerald-500/[0.06]',
                pending && 'border-[#2D3139] bg-[#0a0c10]/80 opacity-[0.72]'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold tabular-nums',
                  current && 'bg-[#7B61FF] text-white shadow-[0_0_12px_-2px_rgba(123,97,255,0.45)]',
                  done && !current && 'bg-emerald-500/20 text-emerald-400',
                  pending && 'bg-[#2A2F38] text-gray-500'
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', current ? 'text-[#7B61FF]' : 'text-gray-500')} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-white">{meta.label}</span>
                  {countBadge != null ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-200">
                      {countBadge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[10px] leading-snug text-gray-500">{meta.description}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 border-t border-[#2D3139]/80 pt-3 text-[10px] leading-relaxed text-gray-600">
        Navigation : <span className="text-gray-400">Précédent</span> ·{' '}
        <span className="text-gray-400">Suivant</span> (trois écrans puis étape 7).
      </p>
    </div>
  );
}

export function Step6SalleVirtuelle({
  draft,
  updateDraft,
  user,
  selectedTeacherId,
  salleSubStepIndex = 0,
  liriAgentImport,
}) {
  const presets = [
    {
      id: 'interactive',
      label: 'Classe interactive',
      config: {
        chat_enabled: true,
        hand_raise_enabled: true,
        screen_share_enabled: true,
        student_audio_enabled: true,
        student_video_enabled: true,
        recording_enabled: false,
        waiting_room: false,
        manual_approval: false,
        visibility_mode: 'public',
      },
    },
    {
      id: 'webinar',
      label: 'Webinaire contrôlé',
      config: {
        chat_enabled: true,
        hand_raise_enabled: true,
        screen_share_enabled: true,
        student_audio_enabled: false,
        student_video_enabled: false,
        recording_enabled: true,
        waiting_room: true,
        manual_approval: true,
        visibility_mode: 'secret',
      },
    },
    {
      id: 'coaching',
      label: 'Coaching privé',
      config: {
        chat_enabled: true,
        hand_raise_enabled: true,
        screen_share_enabled: false,
        student_audio_enabled: true,
        student_video_enabled: true,
        recording_enabled: true,
        waiting_room: true,
        manual_approval: false,
        visibility_mode: 'secret',
      },
    },
  ];

  const recommendations = useMemo(() => {
    const items = [];
    if (draft.session_type === 'conference' && draft.student_audio_enabled) {
      items.push('Pour une conférence fluide, pensez à désactiver le micro des élèves.');
    }
    if (draft.recording_enabled && !draft.waiting_room) {
      items.push("Activez la salle d'attente pour mieux contrôler les entrées durant un enregistrement.");
    }
    if (!draft.chat_enabled && !draft.hand_raise_enabled) {
      items.push("Gardez au moins un canal d'interaction actif pour maintenir l'engagement.");
    }
    if (items.length === 0) {
      items.push("Configuration équilibrée. Vous pouvez passer à l'étape suivante.");
    }
    return items;
  }, [
    draft.chat_enabled,
    draft.hand_raise_enabled,
    draft.recording_enabled,
    draft.waiting_room,
    draft.session_type,
    draft.student_audio_enabled,
  ]);

  const applyPreset = (preset) => {
    updateDraft(preset.config);
  };

  const programSceneCount = Array.isArray(draft.smartboard_element_scenes) ? draft.smartboard_element_scenes.length : 0;
  const importedSlideCount = Array.isArray(draft.smartboard_slides) ? draft.smartboard_slides.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex gap-3 sm:gap-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#7B61FF] bg-[#7B61FF]/12 text-[#7B61FF] shadow-[0_0_16px_-6px_rgba(123,97,255,0.35)]">
          <MonitorPlay className="h-4 w-4 stroke-[2.5]" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-[1.35rem]">Salle virtuelle</h2>
          <p className="mt-1 text-sm text-gray-500">
            Trois écrans — salle & interactions, programme SmartBoard, joker scènes — alignés sur le shell Live Studio.
          </p>
        </div>
      </div>

      <Step6SalleSubstepIndicator
        activeIndex={salleSubStepIndex}
        programSceneCount={programSceneCount}
        importedSlideCount={importedSlideCount}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={salleSubStepIndex}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="mt-4 min-h-0 focus-visible:outline-none"
        >
          {salleSubStepIndex === 0 ? (
            <div className="space-y-5">
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Presets rapides</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  variant="outline"
                  className="rounded-xl border-[#2D3139] bg-[#0a0c10] text-gray-200 hover:border-[#7B61FF]/35 hover:bg-[#7B61FF]/[0.06]"
                  onClick={() => applyPreset(preset)}
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5 text-[#7B61FF]" />
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {GROUPS.map((group, groupIndex) => (
              <motion.div
                key={group.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: groupIndex * 0.04 }}
                className="rounded-2xl border border-[#2D3139] bg-[#0d0f14]/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:p-5"
              >
                <div className="mb-4">
                  <h3 className="text-white font-semibold">{group.title}</h3>
                  <p className="text-xs text-gray-500">{group.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.options.map(({ key, label, desc, icon: Icon, isModeToggle }) => {
                    const isEnabled = isModeToggle ? draft.visibility_mode === 'secret' : Boolean(draft[key]);
                    return (
                      <motion.div
                        key={key}
                        layout
                        className={cn(
                          'rounded-2xl border p-4 transition-all duration-200',
                          isEnabled
                            ? 'border-[#7B61FF]/45 bg-[#7B61FF]/[0.08] shadow-[0_0_0_1px_rgba(123,97,255,0.12)]'
                            : 'border-[#2D3139] bg-[#0a0c10]/70'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-xl',
                              isEnabled ? 'bg-[#7B61FF]/20 text-[#7B61FF]' : 'bg-[#2A2F38] text-gray-500'
                            )}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-white">{label}</h4>
                              <p className="text-xs text-gray-500 mt-1">{desc}</p>
                            </div>
                          </div>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(value) => {
                              if (isModeToggle) {
                                updateDraft({ visibility_mode: value ? 'secret' : 'public' });
                              } else {
                                updateDraft({ [key]: value });
                              }
                            }}
                            className="data-[state=checked]:bg-[#7B61FF]"
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#2D3139] bg-[#12141a]/70 p-4 md:p-5">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7B61FF]/95">
              Conseils intelligents
            </h4>
            <div className="space-y-1.5">
              {recommendations.map((tip) => (
                <p key={tip} className="text-sm text-gray-300">
                  {tip}
                </p>
              ))}
            </div>
          </div>
            </div>
          ) : salleSubStepIndex === 1 ? (
            <div className="space-y-4">
              <SmartboardProgramStudioSection
                draft={draft}
                updateDraft={updateDraft}
                user={user}
                selectedTeacherId={selectedTeacherId}
                liriAgentImport={liriAgentImport}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <SmartBoardScenesConfig draft={draft} updateDraft={updateDraft} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function mapLiveSceneRowToDraftScene(row, index = 0) {
  const trimmed = typeof row.name === 'string' ? row.name.trim() : '';
  const name = trimmed || `Scène ${index + 1}`;
  const order_index =
    typeof row.order_index === 'number' && !Number.isNaN(row.order_index)
      ? row.order_index
      : index;
  return {
    id: row.id,
    name,
    order_index,
    scene_type: row.scene_type,
    content_payload_json: parsePayload(row.content_payload_json),
    is_preset: row.is_preset ?? false,
    preset_name: row.preset_name ?? null,
    is_active: row.is_active ?? false,
  };
}

function formatSessionOptionLabel(row) {
  const raw = row.scheduled_at || row.created_at;
  const d = raw ? new Date(raw) : null;
  const dateStr = d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const title = (row.title || 'Sans titre').slice(0, 80);
  return `${title} · ${dateStr}`;
}

function buildMindmapMermaidFromMasterclass(masterclass) {
  const chapters = Array.isArray(masterclass?.chapters) ? masterclass.chapters : [];
  const root = String(masterclass?.analysis_output?.global_subject || 'Masterclass').trim() || 'Masterclass';
  const safe = (value) => String(value || '').replace(/"/g, "'").trim();
  const lines = ['mindmap', `  root(("${safe(root)}"))`];
  chapters.slice(0, 14).forEach((chapter, idx) => {
    const title = safe(chapter?.title || `Chapitre ${idx + 1}`) || `Chapitre ${idx + 1}`;
    const skill = safe(chapter?.skill_to_acquire || chapter?.knowledge_to_transmit || '');
    lines.push(`    ("${idx + 1}. ${title}")`);
    if (skill) lines.push(`      ("Compétence: ${skill}")`);
  });
  return lines.join('\n');
}

function buildMindmapSectionsFromMasterclass(masterclass) {
  const chapters = Array.isArray(masterclass?.chapters) ? masterclass.chapters : [];
  return chapters.map((chapter, idx) => {
    const analogies = Array.isArray(chapter?.analogies) ? chapter.analogies : [];
    const examples = Array.isArray(chapter?.examples) ? chapter.examples : [];
    const testQuestions = Array.isArray(chapter?.understanding_test) ? chapter.understanding_test : [];
    const keyPoints = [
      chapter?.objective,
      chapter?.skill_to_acquire,
      chapter?.knowledge_to_transmit,
      chapter?.main_revelation || chapter?.revelation_moment,
    ]
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 6);

    return {
      title: String(chapter?.title || `Chapitre ${idx + 1}`).trim(),
      subtitle: String(chapter?.knowledge_to_transmit || chapter?.objective || '').trim(),
      summary: String(chapter?.simple_lesson || chapter?.deep_lesson || chapter?.objective || '').trim(),
      key_points: keyPoints,
      oral_script: [
        chapter?.simple_lesson,
        chapter?.deep_lesson,
        chapter?.reformulation,
      ]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .join('\n\n'),
      pedagogical_phase: String(chapter?.difficulty || 'masterclass').trim(),
      teacher_intention: String(chapter?.objective || '').trim(),
      questions_for_class: testQuestions.map((item) => String(item?.question || '').trim()).filter(Boolean).slice(0, 4),
      refutation_or_limits: String(chapter?.deep_error || chapter?.pedagogical_tension || '').trim(),
      student_understanding: String(chapter?.knowledge_to_transmit || '').trim(),
      transition: String(chapter?.transition_to_next || '').trim(),
      illustration_hint: [
        chapter?.real_life_situation,
        analogies.map((item) => item?.content).filter(Boolean).join(' | '),
        examples.map((item) => item?.content).filter(Boolean).join(' | '),
      ]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .join(' — '),
    };
  });
}

/** Programme diaporama + script maître (brouillon → config → LIRI si pas de live_scenes) */
function SmartboardProgramStudioSection({ draft, updateDraft, user, selectedTeacherId, liriAgentImport }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [coursePaste, setCoursePaste] = useState('');
  const scenes = draft.smartboard_element_scenes || [];
  const canLoadSessions = Boolean(user?.id);
  const liriImportAppliedRef = useRef(false);
  const architectFromLiriAppliedRef = useRef(false);
  const masterclassAutoLaunchRef = useRef(false);

  useEffect(() => {
    if (liriImportAppliedRef.current) return;
    const fromRouter =
      liriAgentImport && typeof liriAgentImport.text === 'string' && liriAgentImport.text.trim()
        ? {
            title: String(liriAgentImport.title || 'Cours LIRI').trim(),
            text: liriAgentImport.text,
            masterclass: liriAgentImport?.masterclass && typeof liriAgentImport.masterclass === 'object'
              ? liriAgentImport.masterclass
              : null,
          }
        : null;
    const pending = fromRouter || consumePendingMasterclassForLiveStudio() || consumePendingLiriCourseForLiveStudio();
    if (!pending?.text) return;
    liriImportAppliedRef.current = true;
    setCoursePaste(pending.text);
    if (pending.masterclass) {
      setMasterclassArtifacts(pending.masterclass);
      setCoachPipelineStage('done');
      masterclassAutoLaunchRef.current = true;
    }
    updateDraft((d) => {
      const t = String(d.title || '').trim();
      if (t) return d;
      return { ...d, title: pending.title };
    });
    toast({
      title: pending.masterclass ? 'Masterclass importée dans le Studio Live' : 'Cours importé depuis l’Agent LIRI',
      description: pending.masterclass
        ? 'Texte + compétences coach préchargés. Vous pouvez lancer SmartBoard Architect.'
        : 'Texte prêt — lancez SmartBoard Architect ou la mindmap IA.',
    });
    if (fromRouter) {
      try {
        localStorage.removeItem(LIRI_AGENT_PENDING_LIVE_KEY);
      } catch {
        /* ignore */
      }
      navigate('/studio/live', { replace: true, state: {} });
    }
  }, [liriAgentImport, toast, updateDraft, navigate]);

  const [recentSessions, setRecentSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);
  const [importSessionId, setImportSessionId] = useState('');
  const [importScenesLoading, setImportScenesLoading] = useState(false);
  const [importScenesError, setImportScenesError] = useState(null);
  const [syncPushSessionId, setSyncPushSessionId] = useState('');
  const [syncPushBusy, setSyncPushBusy] = useState(false);
  const [syncForceReplace, setSyncForceReplace] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setRecentSessions([]);
      setImportSessionId('');
      setSessionsError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setSessionsLoading(true);
      setSessionsError(null);
      let q = supabase
        .from('live_sessions')
        .select('id, title, scheduled_at, created_at')
        .order('scheduled_at', { ascending: false, nullsFirst: false })
        .limit(50);
      if (selectedTeacherId) {
        q = q.eq('teacher_id', selectedTeacherId);
      }
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        setSessionsError(error.message || 'Impossible de charger les sessions.');
        setRecentSessions([]);
      } else {
        setRecentSessions(data || []);
      }
      setSessionsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, selectedTeacherId]);

  const importScenesFromSession = async () => {
    if (!importSessionId) return;
    if (scenes.length > 0) {
      const ok = window.confirm(
        'Un programme est déjà présent dans le brouillon. Remplacer par les scènes importées depuis la session sélectionnée ?'
      );
      if (!ok) return;
    }
    setImportScenesLoading(true);
    setImportScenesError(null);
    const { data, error } = await listScenes(importSessionId);
    if (error) {
      const msg = error.message || 'Impossible de charger les scènes.';
      setImportScenesError(msg);
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
      setImportScenesLoading(false);
      return;
    }
    const rows = [...(data || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    if (!rows.length) {
      const msg = 'Cette session ne contient aucune scène en base.';
      setImportScenesError(msg);
      setImportScenesLoading(false);
      return;
    }
    const mapped = rows.map((r, i) => mapLiveSceneRowToDraftScene(r, i));
    updateDraft({
      smartboard_element_scenes: mapped,
      smartboard_master_script_sections: buildMasterScriptFromScenes(mapped),
    });
    setImportScenesLoading(false);
  };

  const applyInfographicTemplate = () => {
    const title = draft.title?.trim() || 'Votre cours';
    const next = buildInfographicTemplateScenes(title);
    updateDraft({
      smartboard_element_scenes: next,
      smartboard_master_script_sections: buildMasterScriptFromScenes(next),
    });
  };

  // ── SmartBoard Architect (API smartboard-ia-generate) ──────────────────
  const [iaGenerating, setIaGenerating] = useState(false);
  const [iaError, setIaError] = useState(null);
  const [iaGenProgress, setIaGenProgress] = useState(0);
  const [iaGenLabel, setIaGenLabel] = useState('');
  const iaProgressHaltRef = useRef(false);
  const [architectOpen, setArchitectOpen] = useState(false);
  /** pending = aperçu slides IA ; audio_setup = édition audio LIRI optionnelle ; draft = brouillon déjà enregistré */
  const [architectMode, setArchitectMode] = useState('pending');
  const [pendingApiData, setPendingApiData] = useState(null);
  const [architectSlideIdx, setArchitectSlideIdx] = useState(0);
  /** Par slide IA : audio jamais rempli par l’agent — uniquement si l’utilisateur renseigne (étape audio_setup). */
  const [architectAudioByIndex, setArchitectAudioByIndex] = useState([]);
  const [architectAudioUploadBusy, setArchitectAudioUploadBusy] = useState(false);
  const architectAudioFileRef = useRef(null);
  const architectAudioUploadIdxRef = useRef(null);
  const coursePasteTextareaRef = useRef(null);
  /** Si true à la validation audio : ajoute les pistes saisies aux liri_audio_scenes existantes (ids dupliqués renommés). Sinon remplace le bloc. */
  const [architectLiriMergeExisting, setArchitectLiriMergeExisting] = useState(false);

  const [mindmapGenerating, setMindmapGenerating] = useState(false);
  const [mindmapError, setMindmapError] = useState(null);
  const [coachRefineBusy, setCoachRefineBusy] = useState(false);
  const [coachPipelineStage, setCoachPipelineStage] = useState('idle');
  const [masterclassArtifacts, setMasterclassArtifacts] = useState(null);
  const [coachHelpOpen, setCoachHelpOpen] = useState(false);
  const [coachHelpTopic, setCoachHelpTopic] = useState('onglet');
  const [coachHelpQuestion, setCoachHelpQuestion] = useState('');
  const [coachHelpLoading, setCoachHelpLoading] = useState(false);
  const [coachHelpAnswer, setCoachHelpAnswer] = useState('');
  const [coachHelpError, setCoachHelpError] = useState('');
  const [planValidatedPulse, setPlanValidatedPulse] = useState(false);
  const [validatedPlanHistory, setValidatedPlanHistory] = useState([]);
  const [stageReviewModal, setStageReviewModal] = useState({
    open: false,
    stageKey: '',
    title: '',
    items: [],
    data: {},
  });
  const stageReviewResolverRef = useRef(null);

  const requestStageApproval = useCallback((payload) => {
    return new Promise((resolve) => {
      stageReviewResolverRef.current = resolve;
      setStageReviewModal({
        open: true,
        stageKey: String(payload?.stageKey || ''),
        title: String(payload?.title || 'Validation étape'),
        items: Array.isArray(payload?.items) ? payload.items : [],
        data: payload?.data && typeof payload.data === 'object' ? payload.data : {},
      });
    });
  }, []);

  const closeStageReview = useCallback((approved) => {
    const resolve = stageReviewResolverRef.current;
    stageReviewResolverRef.current = null;
    setStageReviewModal((prev) => ({ ...prev, open: false }));
    if (typeof resolve === 'function') resolve(Boolean(approved));
  }, []);

  useEffect(() => {
    if (architectFromLiriAppliedRef.current) return;
    const apiData = consumePendingArchitectForLiveStudio();
    if (!apiData?.slides?.length) return;
    architectFromLiriAppliedRef.current = true;
    startTransition(() => {
      setPendingApiData(apiData);
      setArchitectOpen(true);
      setArchitectMode('pending');
      setArchitectSlideIdx(0);
      setArchitectAudioByIndex([]);
      setArchitectLiriMergeExisting(false);
    });
    toast({
      title: 'SmartBoard Architect',
      description: `${apiData.slides.length} slide(s) — généré depuis l’Agent LIRI. Aperçu ci-dessous ; intégrez au brouillon quand vous êtes prêt.`,
    });
  }, [toast]);

  useEffect(() => {
    if (!iaGenerating) {
      iaProgressHaltRef.current = false;
      setIaGenProgress(0);
      setIaGenLabel('');
      return;
    }
    iaProgressHaltRef.current = false;
    const t0 = Date.now();
    const tick = () => {
      if (iaProgressHaltRef.current) return;
      const { pct, label } = computeSmartboardArchitectProgress(Date.now() - t0);
      setIaGenProgress(pct);
      setIaGenLabel(label);
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [iaGenerating]);

  const runArchitectGeneration = useCallback(async (inputText) => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.access_token) {
      throw new Error(
        'Connexion requise — connectez-vous à PRORASCIENCE puis relancez SmartBoard Architect.',
      );
    }
    const designCanvas = resolveArchitectDesignCanvasForApiRequest({
      marginX: 120,
      marginY: 180,
      minWidth: 960,
      minHeight: 540,
      maxWidth: 2560,
      maxHeight: 1440,
    });
    const sourceText = String(inputText || coursePaste || '').trim();
    const { data, error } = await invokeFunctionWithAuthRetry(supabase, 'smartboard-ia-generate', {
      body: {
        sourceText,
        lang: 'fr',
        /** Une seule requête IA jusqu’à ~4k car. (évite le double appel analyse+JSON). */
        fast: true,
        output_mode: 'immersive',
        responsive_targets: ['web', 'desktop'],
        prefer_transparent_background: true,
        ...(designCanvas ? { designCanvas } : {}),
      },
    });
    if (error) {
      const msg = await getSupabaseFunctionErrorMessage(error);
      throw new Error(
        /fetch|network|timed out|timeout/i.test(msg)
          ? 'Délai dépassé ou réseau. Réessayez — les Edge Functions Supabase tolèrent des exécutions plus longues qu’anciennement sur Netlify.'
          : msg
      );
    }
    if (!data?.slides?.length) {
      throw new Error(data?.error || 'Aucune slide générée par le moteur IA.');
    }
    const normalizedSlides = (data.slides || []).map((slide) => ({
      ...slide,
      background: 'transparent',
      background_color: 'transparent',
      background_style: 'none',
      theme: {
        ...(slide.theme || {}),
        background: 'transparent',
        backgroundColor: 'transparent',
      },
      meta: {
        ...(slide.meta || {}),
        immersive: true,
        responsiveTargets: ['web', 'desktop'],
        transparentBackground: true,
      },
      ...(designCanvas && !slide.design_canvas ? { design_canvas: designCanvas } : {}),
    }));
    return {
      ...data,
      slides: normalizedSlides,
      meta: {
        ...(data.meta || {}),
        immersive: true,
        responsiveTargets: ['web', 'desktop'],
        transparentBackground: true,
      },
      ...(designCanvas ? { format: designCanvas } : {}),
    };
  }, [coursePaste]);

  const runArchitectGenerationWithFallback = useCallback(async (inputText) => {
    try {
      return await runArchitectGeneration(inputText);
    } catch (err) {
      const msg = String(err?.message || '');
      const retryable = /fetch|network|timed out|timeout|payload too large|413/i.test(msg);
      if (!retryable) throw err;
      const compact = compactArchitectSourceText(inputText, 4200);
      if (!compact || compact === String(inputText || '').trim()) throw err;
      toast({
        title: 'Relance SmartBoard Architect',
        description: 'Le plan est trop lourd/réseau instable. Nouvelle tentative avec une version compactée.',
      });
      return runArchitectGeneration(compact);
    }
  }, [runArchitectGeneration, toast]);

  const refineCoursePasteWithCoach = useCallback(async () => {
    const raw = coursePaste.trim();
    if (!raw) return { architectSource: '', masterclass: null };
    if (raw.length < 30) {
      setCoachPipelineStage('error');
      throw new Error("Texte trop court pour le coach. Donnez au moins 30 caractères (idée + objectif + angle).");
    }
    setCoachRefineBusy(true);
    setCoachPipelineStage('analyse');
    try {
      const data = await invokeLongiaGuestLive(supabase, {
        timeoutMs: 70000,
        messages: [
          {
            role: 'user',
            content: buildMasterclassJsonInstruction(raw),
          },
        ],
        studentState: { role: 'host', coach_panel: true },
        sessionContext: {
          surface: 'live_studio_step6',
          tab: 'programme_smartboard',
          action: 'masterclass_json_before_architect',
        },
        uiAction: 'masterclass_json_before_architect',
      });
      const firstPassRaw = [data?.message, data?.summary, data?.explanation]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .join('\n\n')
        .trim();
      const firstParsed = tryParseMasterclassJson(firstPassRaw);
      setCoachPipelineStage('extract_blocks');
      let normalized = normalizeMasterclassOutput(firstParsed, raw);
      {
        const blocks = Array.isArray(normalized?.analysis_output?.segments) ? normalized.analysis_output.segments : [];
        const ok = await requestStageApproval({
          stageKey: 'extract_blocks',
          title: 'Étape validée : Analyse & extraction des blocs',
          items: [
            `Sujet: ${normalized?.analysis_output?.global_subject || '—'}`,
            `Blocs détectés: ${blocks.length}`,
            ...blocks.slice(0, 4).map((seg, idx) => `${idx + 1}. ${String(seg?.core_idea || seg?.title || 'Bloc').slice(0, 90)}`),
          ],
          data: {
            blocks,
            stats: { blocks: blocks.length, chapters: 0, slides: 0 },
            stepNumber: 3,
          },
        });
        if (!ok) throw new Error('Pipeline interrompu par validation utilisateur (blocs).');
      }
      setCoachPipelineStage('create_chapters');
      setCoachPipelineStage('build_pedagogy');
      setCoachPipelineStage('build_scripts');
      setCoachPipelineStage('build_mindmap');
      {
        const chapters = Array.isArray(normalized?.chapters) ? normalized.chapters : [];
        const ok = await requestStageApproval({
          stageKey: 'build_mindmap',
          title: 'Étape validée : Chapitres / pédagogie / script / mindmap',
          items: [
            `Chapitres: ${chapters.length}`,
            ...chapters.slice(0, 5).map((ch, idx) => `${idx + 1}. ${String(ch?.title || `Chapitre ${idx + 1}`)} — ${String(ch?.skill_to_acquire || 'compétence à compléter').slice(0, 80)}`),
          ],
          data: {
            chapters,
            stats: { blocks: Array.isArray(normalized?.analysis_output?.segments) ? normalized.analysis_output.segments.length : 0, chapters: chapters.length, slides: 0 },
            stepNumber: 5,
          },
        });
        if (!ok) throw new Error('Pipeline interrompu par validation utilisateur (chapitres).');
      }
      setCoachPipelineStage('quality');
      let quality = evaluateMasterclassQuality(normalized);

      if (!quality.valid) {
        setCoachPipelineStage('repair');
        const repair = await invokeLongiaGuestLive(supabase, {
          messages: [{ role: 'user', content: buildMasterclassRepairInstruction(normalized) }],
          studentState: { role: 'host', coach_panel: true },
          sessionContext: {
            surface: 'live_studio_step6',
            tab: 'programme_smartboard',
            action: 'masterclass_json_repair',
            missing: quality.missing_requirements,
          },
          uiAction: 'masterclass_json_repair',
        });
        const repairedRaw = [repair?.message, repair?.summary, repair?.explanation]
          .map((x) => String(x || '').trim())
          .filter(Boolean)
          .join('\n\n')
          .trim();
        const repairedParsed = tryParseMasterclassJson(repairedRaw);
        normalized = normalizeMasterclassOutput(repairedParsed || normalized, raw);
        quality = evaluateMasterclassQuality(normalized);
      }

      const finalMasterclass = {
        ...normalized,
        quality_check: quality.quality_check,
        missing_requirements: quality.missing_requirements,
      };
      {
        const ok = await requestStageApproval({
          stageKey: 'quality',
          title: 'Étape validée : Contrôle qualité masterclass',
          items: quality.valid
            ? ['Quality gate validé', 'Toutes les sections requises sont présentes.']
            : [`Sections à corriger: ${quality.missing_requirements.slice(0, 8).join(' | ')}`],
          data: {
            chapters: Array.isArray(finalMasterclass?.chapters) ? finalMasterclass.chapters : [],
            stats: {
              blocks: Array.isArray(finalMasterclass?.analysis_output?.segments) ? finalMasterclass.analysis_output.segments.length : 0,
              chapters: Array.isArray(finalMasterclass?.chapters) ? finalMasterclass.chapters.length : 0,
              slides: 0,
            },
            stepNumber: 7,
          },
        });
        if (!ok) throw new Error('Pipeline interrompu par validation utilisateur (quality).');
      }
      setMasterclassArtifacts(finalMasterclass);
      setCoachPipelineStage('done');

      if (!quality.valid) {
        toast({
          title: 'Coach Masterclass partiel',
          description: `Certaines sections restent incomplètes (${quality.missing_requirements.slice(0, 3).join(', ')}). Génération poursuivie avec fallback.`,
          variant: 'destructive',
        });
      }

      const architectSource = buildArchitectSourceFromMasterclass(finalMasterclass).trim();
      return { architectSource: architectSource || raw, masterclass: finalMasterclass };
    } catch {
      setCoachPipelineStage('error');
      return { architectSource: raw, masterclass: null };
    } finally {
      setCoachRefineBusy(false);
    }
  }, [coursePaste, toast, requestStageApproval]);

  const architectScenes = useMemo(() => {
    if (!architectOpen) return [];
    if ((architectMode === 'pending' || architectMode === 'audio_setup') && pendingApiData) {
      const m = mapIAResponseToDraft(pendingApiData, {});
      return m.smartboard_element_scenes || [];
    }
    if (architectMode === 'draft') {
      return (draft.smartboard_element_scenes || []).filter((s) => s.ia_data);
    }
    return [];
  }, [architectOpen, architectMode, pendingApiData, draft.smartboard_element_scenes]);

  const masterclassQuickSummary = useMemo(() => {
    if (!masterclassArtifacts) return null;
    const analysis = masterclassArtifacts.analysis_output || {};
    const chapters = Array.isArray(masterclassArtifacts.chapters) ? masterclassArtifacts.chapters : [];
    const firstChapter = chapters[0] || null;
    const objective = String(firstChapter?.objective || analysis.global_subject || '').trim();
    const promise = String(firstChapter?.main_revelation || firstChapter?.revelation_moment || '').trim();
    const planLines = chapters
      .slice(0, 6)
      .map((ch, idx) => {
        const title = String(ch?.title || `Chapitre ${idx + 1}`).trim();
        const focus = String(ch?.skill_to_acquire || ch?.knowledge_to_transmit || '').trim();
        return focus ? `${idx + 1}. ${title} - ${focus}` : `${idx + 1}. ${title}`;
      });
    if (chapters.length > 6) {
      planLines.push(`+${chapters.length - 6} autre(s) chapitre(s)`);
    }
    return {
      objective: objective || 'Objectif en cours de consolidation par le coach.',
      promise: promise || 'Promesse non explicite, utilisez "Copier JSON" pour ajuster la révélation centrale.',
      planLines,
      themes: Array.isArray(analysis.central_themes) ? analysis.central_themes.slice(0, 3) : [],
    };
  }, [masterclassArtifacts]);

  const coachCompetences = useMemo(() => {
    if (!masterclassArtifacts) return [];
    const chapters = Array.isArray(masterclassArtifacts.chapters) ? masterclassArtifacts.chapters : [];
    const unique = [];
    const seen = new Set();
    for (const chapter of chapters) {
      const value = String(chapter?.skill_to_acquire || chapter?.knowledge_to_transmit || '').trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(value);
      if (unique.length >= 8) break;
    }
    return unique;
  }, [masterclassArtifacts]);

  const buildArchitectSourceWithCoachCompetences = useCallback((text) => {
    const base = String(text || '').trim();
    if (!base) return '';
    if (!coachCompetences.length) return base;
    const coachBlock = [
      '### COMPETENCES COACH A PRIORISER',
      ...coachCompetences.map((item, index) => `${index + 1}. ${item}`),
    ].join('\n');
    return `${base}\n\n${coachBlock}`.trim();
  }, [coachCompetences]);

  const architectSlideSafeIdx = Math.min(
    architectSlideIdx,
    Math.max(0, architectScenes.length - 1)
  );
  const architectCurrentScene = architectScenes[architectSlideSafeIdx];
  const previewSlide = architectCurrentScene?.ia_data
    ? { id: architectCurrentScene.id, ia_data: architectCurrentScene.ia_data }
    : null;

  const handleArchitectOpenChange = (open) => {
    if (!open) {
      if (architectMode === 'pending' || architectMode === 'audio_setup') setPendingApiData(null);
      setArchitectSlideIdx(0);
      setArchitectMode('pending');
      setArchitectAudioByIndex([]);
      setArchitectLiriMergeExisting(false);
    }
    setArchitectOpen(open);
  };

  const patchArchitectAudioRow = (idx, partial) => {
    setArchitectAudioByIndex((rows) => {
      const next = [...rows];
      next[idx] = { ...next[idx], ...partial };
      return next;
    });
  };

  const goToArchitectAudioSetup = () => {
    if (!pendingApiData) return;
    const m = mapIAResponseToDraft(pendingApiData, {});
    const list = m.smartboard_element_scenes || [];
    setArchitectAudioByIndex(list.map(() => ({ audioUrl: '', volume: 0.35, loop: true })));
    setArchitectLiriMergeExisting(false);
    setArchitectMode('audio_setup');
    setArchitectSlideIdx(0);
  };

  const handleArchitectAudioFile = async (e) => {
    const file = e.target.files?.[0];
    const idx = architectAudioUploadIdxRef.current;
    architectAudioUploadIdxRef.current = null;
    e.target.value = '';
    if (!file || idx == null || idx < 0) return;
    setArchitectAudioUploadBusy(true);
    try {
      const path = `liri-architect/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
      const { error } = await supabase.storage.from('videos').upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path);
      if (urlData?.publicUrl) patchArchitectAudioRow(idx, { audioUrl: urlData.publicUrl });
    } catch (err) {
      console.error('[architect-audio] upload', err);
      toast({
        title: 'Upload audio impossible',
        description: err?.message || 'Erreur inconnue',
        variant: 'destructive',
      });
    } finally {
      setArchitectAudioUploadBusy(false);
    }
  };

  /**
   * @param {{ withOptionalLiriAudio?: boolean }} opts
   * `withOptionalLiriAudio` : true uniquement après l’étape « paramétrage audio » — construit liri_audio_scenes à partir des champs saisis (jamais automatique).
   */
  const applyPendingArchitectToDraft = (opts = {}) => {
    const { withOptionalLiriAudio = false } = opts;
    if (!pendingApiData) return;
    const slideCount = pendingApiData.slides?.length || 0;
    const nextDraft = mapIAResponseToDraft(pendingApiData, draft);
    const patch = {
      smartboard_element_scenes: nextDraft.smartboard_element_scenes,
      smartboard_master_script_sections: nextDraft.smartboard_master_script_sections,
    };
    if (!String(draft.title || '').trim() && nextDraft.title) {
      patch.title = nextDraft.title;
    }
    let liriAddedCount = 0;
    const prevLiriCount = Array.isArray(draft.liri_audio_scenes) ? draft.liri_audio_scenes.length : 0;
    const mergeLiriChosen = architectLiriMergeExisting;
    if (withOptionalLiriAudio) {
      const sbScenes = nextDraft.smartboard_element_scenes || [];
      const liriList = [];
      for (let i = 0; i < sbScenes.length; i++) {
        const url = (architectAudioByIndex[i]?.audioUrl || '').trim();
        if (!url) continue;
        const s = sbScenes[i];
        const rawId = String(s?.id || `slide_${i}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 72);
        liriList.push({
          id: `liri_${rawId}_${i}`,
          name: s?.name || `Slide ${i + 1}`,
          audioUrl: url,
          volume: typeof architectAudioByIndex[i]?.volume === 'number' ? architectAudioByIndex[i].volume : 0.35,
          loop: architectAudioByIndex[i]?.loop !== false,
        });
      }
      if (liriList.length > 0) {
        patch.liri_audio_enabled = true;
        if (mergeLiriChosen) {
          const existing = Array.isArray(draft.liri_audio_scenes) ? [...draft.liri_audio_scenes] : [];
          const idSet = new Set(existing.map((x) => x?.id).filter(Boolean));
          const appended = liriList.map((item) => {
            let id = item.id;
            if (idSet.has(id)) {
              let n = 0;
              let candidate = `${id}_arch_${n}`;
              while (idSet.has(candidate)) {
                n += 1;
                candidate = `${id}_arch_${n}`;
              }
              id = candidate;
            }
            idSet.add(id);
            return { ...item, id };
          });
          patch.liri_audio_scenes = [...existing, ...appended];
        } else {
          patch.liri_audio_scenes = liriList;
        }
        liriAddedCount = liriList.length;
      }
    }
    updateDraft(patch);
    setPendingApiData(null);
    setArchitectAudioByIndex([]);
    setArchitectLiriMergeExisting(false);
    setArchitectOpen(false);
    setArchitectSlideIdx(0);
    setArchitectMode('pending');
    let toastDescription;
    if (liriAddedCount > 0) {
      if (mergeLiriChosen && prevLiriCount > 0) {
        toastDescription = `${slideCount} scène(s) SmartBoard — fusion LIRI : ${liriAddedCount} piste(s) ajoutée(s), ${prevLiriCount} conservée(s) dans le brouillon.`;
      } else if (mergeLiriChosen && prevLiriCount === 0) {
        toastDescription = `${slideCount} scène(s) SmartBoard — ${liriAddedCount} piste(s) LIRI (fusion : aucune piste antérieure dans le brouillon).`;
      } else {
        toastDescription = `${slideCount} scène(s) SmartBoard — ${liriAddedCount} piste(s) LIRI (bloc audio du brouillon remplacé).`;
      }
    } else {
      toastDescription = `${slideCount} scène(s) SmartBoard — sans nouvelle piste LIRI (réglages audio inchangés si vous en aviez déjà).`;
    }
    toast({
      title: 'Programme intégré au brouillon',
      description: toastDescription,
    });
  };

  const openDraftArchitect = () => {
    const progressive = (draft.smartboard_element_scenes || []).filter((s) => s.ia_data);
    if (!progressive.length) {
      toast({
        title: 'Aucune scène à prévisualiser',
        description: 'Générez d’abord avec SmartBoard Architect ou le mode carte mentale (IA).',
        variant: 'destructive',
      });
      return;
    }
    setArchitectMode('draft');
    setArchitectSlideIdx(0);
    setArchitectOpen(true);
  };

  const regenerateInArchitect = async () => {
    if (!coursePaste.trim()) {
      toast({ title: 'Texte requis', description: 'Collez du texte source pour régénérer.', variant: 'destructive' });
      return;
    }
    setIaGenerating(true);
    setIaError(null);
    try {
      const data = await runArchitectGenerationWithFallback(coursePaste);
      iaProgressHaltRef.current = true;
      setIaGenProgress(100);
      setIaGenLabel('Terminé !');
      await new Promise((r) => setTimeout(r, 450));
      startTransition(() => {
        setPendingApiData(data);
        setArchitectAudioByIndex([]);
        setArchitectMode('pending');
        setArchitectSlideIdx(0);
        setArchitectOpen(true);
      });
      toast({
        title: '🧠 SmartBoard Architect',
        description: `${data.slides.length} slide(s) — ${data.provider || 'ia'}`,
      });
    } catch (err) {
      const msg = err?.message || 'Erreur inconnue';
      setIaError(msg);
      toast({ title: 'Erreur SmartBoard Architect', description: msg, variant: 'destructive' });
    } finally {
      setIaGenerating(false);
      setIaGenProgress(0);
      setIaGenLabel('');
    }
  };

  const generateWithGptIA = useCallback(async () => {
    if (!coursePaste.trim()) {
      toast({ title: 'Texte requis', description: 'Collez un cours ou des notes dans la zone de texte.', variant: 'destructive' });
      return;
    }
    let coached;
    try {
      coached = await refineCoursePasteWithCoach();
    } catch (err) {
      const msg = err?.message || 'Le coach LONGIA a échoué.';
      setIaError(msg);
      toast({ title: 'Erreur Coach LONGIA', description: msg, variant: 'destructive' });
      setCoachPipelineStage('error');
      return;
    }
    const coachedText = coached?.architectSource || coursePaste;
    const architectReadyText = buildArchitectSourceWithCoachCompetences(coachedText);
    if (architectReadyText && architectReadyText !== coursePaste) {
      setCoursePaste(architectReadyText);
    }
    setIaGenerating(true);
    setIaError(null);
    try {
      setCoachPipelineStage('design');
      const data = await runArchitectGenerationWithFallback(architectReadyText || coursePaste);
      iaProgressHaltRef.current = true;
      setIaGenProgress(100);
      setIaGenLabel('Terminé !');
      await new Promise((r) => setTimeout(r, 450));
      startTransition(() => {
        setPendingApiData(data);
        setArchitectAudioByIndex([]);
        setArchitectMode('pending');
        setArchitectSlideIdx(0);
        setArchitectOpen(true);
      });
      toast({
        title: '🧠 SmartBoard Architect',
        description: `${data.slides.length} slide(s) — texte d’abord enrichi par LONGIA, puis design immersif responsive web/PC.`,
      });
      setCoachPipelineStage('done');
    } catch (err) {
      const msg = err?.message || 'Erreur inconnue';
      setIaError(msg);
      toast({ title: 'Erreur SmartBoard Architect', description: msg, variant: 'destructive' });
      setCoachPipelineStage('error');
    } finally {
      setIaGenerating(false);
      setIaGenProgress(0);
      setIaGenLabel('');
    }
  }, [coursePaste, runArchitectGenerationWithFallback, toast, refineCoursePasteWithCoach, buildArchitectSourceWithCoachCompetences]);

  const launchDesignFromMasterclass = useCallback(async () => {
    if (!masterclassArtifacts) {
      toast({ title: 'Masterclass indisponible', description: 'Lancez d’abord le coach LONGIA.', variant: 'destructive' });
      return;
    }
    const sourceFromMasterclass = buildArchitectSourceFromMasterclass(masterclassArtifacts).trim();
    if (!sourceFromMasterclass) {
      toast({ title: 'Source vide', description: 'Le plan masterclass est incomplet.', variant: 'destructive' });
      return;
    }
    const architectReadyText = buildArchitectSourceWithCoachCompetences(sourceFromMasterclass);
    setValidatedPlanHistory((prev) => {
      const entry = {
        id: `${Date.now()}`,
        at: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        objective: masterclassQuickSummary?.objective || 'Objectif non renseigne',
        promise: masterclassQuickSummary?.promise || 'Promesse non renseignee',
        lines: Array.isArray(masterclassQuickSummary?.planLines) ? masterclassQuickSummary.planLines.slice(0, 3) : [],
        sourceText: architectReadyText,
      };
      return [entry, ...prev].slice(0, 3);
    });
    setCoursePaste(architectReadyText);
    setIaGenerating(true);
    setIaError(null);
    setPlanValidatedPulse(true);
    try {
      await new Promise((r) => setTimeout(r, 700));
      setCoachHelpOpen(false);
      setCoachPipelineStage('design');
      const data = await runArchitectGenerationWithFallback(architectReadyText);
      iaProgressHaltRef.current = true;
      setIaGenProgress(100);
      setIaGenLabel('Terminé !');
      await new Promise((r) => setTimeout(r, 450));
      startTransition(() => {
        setPendingApiData(data);
        setArchitectAudioByIndex([]);
        setArchitectMode('pending');
        setArchitectSlideIdx(0);
        setArchitectOpen(true);
      });
      toast({
        title: '🧠 SmartBoard Architect',
        description: `${data.slides.length} slide(s) — design lance depuis le plan masterclass valide.`,
      });
      setCoachPipelineStage('done');
    } catch (err) {
      const msg = err?.message || 'Erreur inconnue';
      setIaError(msg);
      toast({ title: 'Erreur SmartBoard Architect', description: msg, variant: 'destructive' });
      setCoachPipelineStage('error');
    } finally {
      setPlanValidatedPulse(false);
      setIaGenerating(false);
      setIaGenProgress(0);
      setIaGenLabel('');
    }
  }, [masterclassArtifacts, masterclassQuickSummary, runArchitectGenerationWithFallback, toast, buildArchitectSourceWithCoachCompetences]);

  useEffect(() => {
    if (!masterclassAutoLaunchRef.current) return;
    if (!coursePaste.trim()) return;
    if (iaGenerating || coachRefineBusy || mindmapGenerating) return;
    masterclassAutoLaunchRef.current = false;
    void generateWithGptIA();
  }, [coursePaste, iaGenerating, coachRefineBusy, mindmapGenerating, generateWithGptIA]);

  const restoreValidatedPlan = useCallback((entry) => {
    const sourceText = String(entry?.sourceText || '').trim();
    if (!sourceText) {
      toast({ title: 'Restauration impossible', description: 'Aucune source sauvegardee pour ce plan.', variant: 'destructive' });
      return;
    }
    setCoursePaste(sourceText);
    setCoachHelpOpen(false);
    window.setTimeout(() => {
      const node = coursePasteTextareaRef.current;
      if (!node) return;
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.focus();
    }, 180);
    toast({ title: 'Plan restaure', description: 'Le plan historique a ete recharge dans la zone texte.' });
  }, [toast]);

  const generateMindmapCourseWithIA = useCallback(async (opts = {}) => {
    const { autoLaunchArchitect = false } = opts || {};
    if (!coursePaste.trim()) {
      toast({ title: 'Texte requis', description: 'Collez un cours ou des notes dans la zone de texte.', variant: 'destructive' });
      return;
    }
    if (coursePaste.trim().length < 30) {
      setMindmapError("Texte trop court. Écrivez au moins une intention de cours en 1-2 phrases.");
      toast({ title: 'Carte mentale & script', description: 'Texte trop court pour lancer le pipeline.', variant: 'destructive' });
      return;
    }
    setMindmapGenerating(true);
    setMindmapError(null);
    try {
      setCoachPipelineStage('analyse');
      const coached = await refineCoursePasteWithCoach();
      const masterclass = coached?.masterclass;
      if (!masterclass) {
        throw new Error('Le plan Masterclass n’a pas pu être généré.');
      }
      const sourceFromMasterclass = buildArchitectSourceFromMasterclass(masterclass).trim();
      const architectReadyText = buildArchitectSourceWithCoachCompetences(sourceFromMasterclass || coursePaste);
      setCoursePaste(architectReadyText);

      const body = {
        deck_title: String(masterclass?.analysis_output?.global_subject || draft.title || 'Masterclass').trim(),
        mindmap_mermaid: buildMindmapMermaidFromMasterclass(masterclass),
        sections: buildMindmapSectionsFromMasterclass(masterclass),
      };
      const patch = mapMindmapCourseResponseToDraft(body, draft.title);
      updateDraft(patch);
      setMasterclassArtifacts(masterclass);
      setCoachPipelineStage('done');
      toast({
        title: 'Plan Masterclass généré',
        description: `${body.sections?.length || 0} section(s) — script + mindmap créés depuis Masterclass Factory.`,
      });
      if (autoLaunchArchitect) {
        const ok = await requestStageApproval({
          stageKey: 'design',
          title: 'Plan validé — lancer SmartBoard Architect ?',
          items: [
            `Sections du plan: ${body.sections?.length || 0}`,
            `Mindmap: ${body.mindmap_mermaid ? 'générée' : 'non générée'}`,
            'Vous pouvez modifier le texte dans la zone principale avant de continuer.',
          ],
          data: {
            chapters: Array.isArray(masterclass?.chapters) ? masterclass.chapters : [],
            stats: {
              blocks: Array.isArray(masterclass?.analysis_output?.segments) ? masterclass.analysis_output.segments.length : 0,
              chapters: Array.isArray(masterclass?.chapters) ? masterclass.chapters.length : 0,
              slides: 0,
            },
            stepNumber: 8,
          },
        });
        if (!ok) {
          setCoachPipelineStage('done');
          return;
        }
      }
      if (autoLaunchArchitect) {
        // Fin explicite de la phase "plan" avant de démarrer Architect.
        setMindmapGenerating(false);
        await new Promise((r) => setTimeout(r, 120));

        setIaGenerating(true);
        setIaError(null);
        setCoachPipelineStage('design');
        const data = await runArchitectGenerationWithFallback(architectReadyText);
        iaProgressHaltRef.current = true;
        setIaGenProgress(100);
        setIaGenLabel('Terminé !');
        await new Promise((r) => setTimeout(r, 450));
        startTransition(() => {
          setPendingApiData(data);
          setArchitectAudioByIndex([]);
          setArchitectMode('pending');
          setArchitectSlideIdx(0);
          setArchitectOpen(true);
        });
        toast({
          title: '🧠 SmartBoard Architect',
          description: `${data.slides.length} slide(s) — générées à partir du plan Masterclass.`,
        });
      } else {
        toast({
          title: 'Plan prêt',
          description: 'Le plan Masterclass est généré. Cliquez sur "Lancer SmartBoard Architect" quand vous voulez.',
        });
      }
      setCoachPipelineStage('done');
    } catch (err) {
      const msg = err?.message || 'Erreur inconnue';
      setMindmapError(msg);
      toast({ title: 'Carte mentale & script', description: msg, variant: 'destructive' });
      if (coachPipelineStage !== 'idle') setCoachPipelineStage('error');
    } finally {
      setIaGenerating(false);
      setIaGenProgress(0);
      setIaGenLabel('');
      setMindmapGenerating(false);
    }
  }, [
    coursePaste,
    draft.title,
    toast,
    updateDraft,
    refineCoursePasteWithCoach,
    buildArchitectSourceWithCoachCompetences,
    runArchitectGenerationWithFallback,
    coachPipelineStage,
    requestStageApproval,
  ]);

  const clearProgram = () => {
    updateDraft({
      smartboard_element_scenes: [],
      smartboard_master_script_sections: [],
      smartboard_course_mindmap_mermaid: '',
    });
  };

  const askCoachHelp = useCallback(async () => {
    const custom = coachHelpQuestion.trim();
    const topicLabel =
      coachHelpTopic === 'champ'
        ? 'un champ'
        : coachHelpTopic === 'action'
          ? 'une action'
          : 'cet onglet';
    const prompt = custom || `Explique ${topicLabel} de l'étape "Programme SmartBoard" et dis quoi faire maintenant en 4 points max.`;
    setCoachHelpLoading(true);
    setCoachHelpError('');
    setCoachHelpAnswer('');
    try {
      const data = await invokeLongiaGuestLive(supabase, {
        messages: [
          {
            role: 'user',
            content: `Contexte: Live Studio > Étape 6 > Programme SmartBoard.\nQuestion: ${prompt}`,
          },
        ],
        studentState: { role: 'host', coach_panel: true },
        sessionContext: {
          surface: 'live_studio_step6',
          tab: 'programme_smartboard',
          scenesCount: scenes.length,
          hasCoursePaste: Boolean(coursePaste.trim()),
          title: draft?.title || null,
        },
        uiAction: 'explain_live_studio_step6',
      });
      const text = [data?.message, data?.summary, data?.explanation]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .join('\n\n');
      setCoachHelpAnswer(text || 'Aucune réponse du coach pour le moment.');
    } catch (e) {
      const msg = e?.message || 'Coach indisponible pour le moment.';
      setCoachHelpError(msg);
      toast({ title: 'Coach', description: msg, variant: 'destructive' });
    } finally {
      setCoachHelpLoading(false);
    }
  }, [coachHelpQuestion, coachHelpTopic, scenes.length, coursePaste, draft?.title, toast]);

  const pushDraftToLiveScenes = async () => {
    const sid = syncPushSessionId.trim();
    if (!sid) {
      toast({ title: 'Session requise', description: 'Choisissez ou collez l’UUID d’une session live existante.', variant: 'destructive' });
      return;
    }
    if (!scenes.length) {
      toast({ title: 'Rien à pousser', description: 'Générez ou importez d’abord un programme SmartBoard dans le brouillon.', variant: 'destructive' });
      return;
    }
    if (syncForceReplace) {
      const ok = window.confirm(
        'Toutes les scènes de production de cette session seront supprimées, puis remplacées par votre brouillon actuel. Cette action est irréversible. Continuer ?'
      );
      if (!ok) return;
    }
    setSyncPushBusy(true);
    const r = await pushWizardSmartboardToLiveScenes(sid, scenes, { replaceExisting: syncForceReplace });
    setSyncPushBusy(false);
    if (r.ok) {
      toast({
        title: r.replaced ? 'Scènes remplacées' : 'Programme copié en production',
        description: r.replaced
          ? `${r.inserted} scène(s) importées — l’ancien déroulé production a été supprimé.`
          : `${r.inserted} scène(s) enregistrée(s) pour l’Arena (priorité sur la seule config JSON).`,
      });
      return;
    }
    if (r.reason === 'scenes_exist') {
      toast({
        title: 'Scènes déjà présentes',
        description: 'Cette session a déjà des lignes dans « Scènes » en base. Ouvrez le studio préparation pour les modifier ou supprimez-les avant de repousser le brouillon.',
        variant: 'destructive',
      });
      return;
    }
    if (r.error) {
      toast({ title: 'Échec de la copie', description: r.error.message, variant: 'destructive' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 rounded-2xl border border-[#2D3139] bg-[#0d0f14]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#7B61FF]/25 bg-[#7B61FF]/10">
          <FileText className="h-5 w-5 text-[#7B61FF]" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Programme SmartBoard & script</h3>
        </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 border-white/15 px-2 text-[10px] text-white/75 hover:bg-white/10"
          onClick={() => setCoachHelpOpen(true)}
        >
          <HelpCircle className="mr-1 h-3.5 w-3.5" />
          ?
        </Button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Pousser le brouillon vers une session existante</p>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Switch checked={syncForceReplace} onCheckedChange={setSyncForceReplace} className="data-[state=checked]:bg-rose-600/80" />
          <span className="text-[11px] text-rose-200/90">
            Remplacer toutes les scènes existantes (suppression puis import du brouillon)
          </span>
        </label>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1 min-w-0 space-y-1">
            <label className="text-[10px] text-gray-500" htmlFor="sync-push-session">
              Session destination (où envoyer le brouillon)
            </label>
            <select
              id="sync-push-session"
              value={recentSessions.some((s) => s.id === syncPushSessionId) ? syncPushSessionId : ''}
              onChange={(e) => setSyncPushSessionId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl text-sm text-gray-200 h-9 px-2"
              disabled={!canLoadSessions || recentSessions.length === 0}
            >
              <option value="">— Choisir la session destination —</option>
              {recentSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatSessionOptionLabel(s)}
                </option>
              ))}
            </select>
            <Input
              value={recentSessions.some((s) => s.id === syncPushSessionId) ? '' : syncPushSessionId}
              onChange={(e) => setSyncPushSessionId(e.target.value)}
              placeholder="Ou coller l’UUID de la session destination"
              className="h-9 bg-black/30 border-white/10 text-xs"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-cyan-500/35 text-cyan-200 hover:bg-cyan-500/10 shrink-0"
            disabled={syncPushBusy || !scenes.length || !syncPushSessionId.trim()}
            onClick={() => void pushDraftToLiveScenes()}
          >
            {syncPushBusy ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-2" />}
            {syncForceReplace ? 'Remplacer la session destination' : 'Copier vers session destination'}
          </Button>
        </div>
        {syncPushSessionId.trim() && (
          <Button type="button" variant="ghost" size="sm" className="text-[10px] text-gray-500 h-7" asChild>
            <Link to={`/studio/live-preparation/${syncPushSessionId.trim()}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-1" />
              Ouvrir le studio préparation de cette session
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="bg-[#7B61FF] text-white hover:bg-[#9485ff]"
          onClick={applyInfographicTemplate}
        >
          <Wand2 className="w-3.5 h-3.5 mr-2" />
          Modèle infographique (4 scènes)
        </Button>
        <Button type="button" variant="outline" className="border-white/15 text-gray-200" asChild>
          <Link to="/studio/live-preparation" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3.5 h-3.5 mr-2" />
            Studio SmartBoard (nouvel onglet)
          </Link>
        </Button>
        {scenes.length > 0 && (
          <Button type="button" variant="ghost" className="text-gray-400 hover:text-red-300" onClick={clearProgram}>
            Effacer le programme
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/25 p-3 space-y-3">
        <p className="text-xs uppercase tracking-wider text-[#7B61FF]/90 font-semibold">
          Importer les scènes d&apos;une session existante
        </p>
        {!canLoadSessions && (
          <p className="text-xs text-gray-500">Connectez-vous pour charger les sessions accessibles.</p>
        )}
        {canLoadSessions && sessionsLoading && (
          <p className="text-xs text-gray-500 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            Chargement des sessions…
          </p>
        )}
        {sessionsError && (
          <p className="text-xs text-red-400">{sessionsError}</p>
        )}
        {canLoadSessions && !sessionsLoading && !sessionsError && recentSessions.length === 0 && (
          <p className="text-xs text-gray-500">Aucune session n&apos;est accessible selon vos droits.</p>
        )}
        {canLoadSessions && recentSessions.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex-1 min-w-0 space-y-1">
              <label className="text-[10px] text-gray-500" htmlFor="import-live-session">
                Session source (d’où importer les scènes)
              </label>
              <select
                id="import-live-session"
                value={importSessionId}
                onChange={(e) => {
                  setImportSessionId(e.target.value);
                  setImportScenesError(null);
                }}
                className="w-full bg-black/40 border border-white/10 rounded-xl text-sm text-gray-200 h-9 px-2"
              >
                <option value="">— Choisir la session source —</option>
                {recentSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatSessionOptionLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-[#7B61FF]/40 text-[#7B61FF] hover:bg-[#7B61FF]/10 shrink-0"
              disabled={!importSessionId || importScenesLoading}
              onClick={importScenesFromSession}
            >
              {importScenesLoading ? (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-2" />
              )}
              Importer depuis session source
            </Button>
          </div>
        )}
        {importScenesError && (
          <p className="text-xs text-red-400">{importScenesError}</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs uppercase tracking-wider text-gray-500">Coller un cours (plan texte)</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 border-white/15 px-2 text-[10px] text-white/75 hover:bg-white/10"
            onClick={() => setCoachHelpOpen(true)}
          >
            <HelpCircle className="mr-1 h-3.5 w-3.5" />
            ?
          </Button>
        </div>
        <textarea
          ref={coursePasteTextareaRef}
          value={coursePaste}
          onChange={(e) => setCoursePaste(e.target.value)}
          rows={6}
          placeholder="Collez votre cours ou vos notes brutes"
          className="w-full rounded-xl border border-white/10 bg-black/30 text-sm text-gray-200 placeholder:text-gray-600 p-3 resize-y min-h-[120px]"
        />
        {(coachRefineBusy || iaGenerating || coachPipelineStage !== 'idle') && (
          <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-gray-300">
            <span className="font-semibold text-[#7B61FF]">Pipeline:</span>{' '}
            {coachPipelineStage === 'analyse' && 'Analyse du texte'}
            {coachPipelineStage === 'extract_blocks' && 'Extraction des blocs de sens'}
            {coachPipelineStage === 'create_chapters' && 'Création des chapitres'}
            {coachPipelineStage === 'build_pedagogy' && 'Assemblage pédagogique'}
            {coachPipelineStage === 'build_scripts' && 'Génération du script'}
            {coachPipelineStage === 'build_mindmap' && 'Construction mindmap / plan'}
            {coachPipelineStage === 'quality' && 'Contrôle qualité'}
            {coachPipelineStage === 'repair' && 'Correction automatique des sections manquantes'}
            {coachPipelineStage === 'design' && 'Génération SmartBoard Architect'}
            {coachPipelineStage === 'done' && 'Terminé'}
            {coachPipelineStage === 'error' && 'Erreur'}
            {(coachPipelineStage === 'idle' && (coachRefineBusy || iaGenerating)) && 'Traitement…'}
            {coachPipelineStage !== 'idle' && coachPipelineStage !== 'error' ? (
              <div className="mt-2 space-y-2">
                <div className="rounded-md border border-white/10 bg-black/20 px-2 py-2">
                  <div className="mb-1 flex items-center justify-between text-[10px]">
                    <span className="text-white/65">Progression globale</span>
                    <span className="font-semibold text-[#c4b5fd]">
                      {getCoachPipelinePercent(coachPipelineStage)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#312e81] via-[#7B61FF] to-[#c4b5fd] transition-[width] duration-300 ease-out"
                      style={{ width: `${getCoachPipelinePercent(coachPipelineStage)}%` }}
                    />
                  </div>
                </div>
                {COACH_PIPELINE_STEPS.map((step) => {
                  const currentIdx = getCoachPipelineIndex(coachPipelineStage);
                  const stepIdx = getCoachPipelineIndex(step.key);
                  const done = currentIdx > -1 && stepIdx < currentIdx;
                  const active = coachPipelineStage === step.key;
                  return (
                    <div key={step.key} className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                          done
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : active
                              ? 'bg-[#7B61FF]/25 text-[#c4b5fd]'
                              : 'bg-white/10 text-gray-500'
                        }`}
                      >
                        {done ? <Check className="h-3 w-3" strokeWidth={2.8} /> : '•'}
                      </span>
                      <span className={active ? 'text-[#d6ccff]' : done ? 'text-gray-200' : 'text-gray-500'}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}

        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-semibold">
            Avec IA · Carte mentale &amp; plan de cours
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/15 sm:w-auto"
            onClick={() => void generateMindmapCourseWithIA({ autoLaunchArchitect: false })}
            disabled={mindmapGenerating || iaGenerating || coachRefineBusy}
          >
            {mindmapGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {mindmapGenerating ? 'Génération carte mentale…' : 'Générer le plan (mindmap + script)'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start border-emerald-400/50 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 sm:w-auto"
            onClick={() => void generateMindmapCourseWithIA({ autoLaunchArchitect: true })}
            disabled={mindmapGenerating || iaGenerating || coachRefineBusy}
          >
            {mindmapGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {mindmapGenerating ? 'Plan + Architect en cours…' : 'Plan + SmartBoard Architect'}
          </Button>
          {mindmapError && (
            <p className="text-xs text-red-400 flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0">⚠</span>
              {mindmapError}
            </p>
          )}
        </div>

        {/* ── SmartBoard Architect ── */}
        <div className="rounded-xl border border-[#7B61FF]/25 bg-[#7B61FF]/[0.06] p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-[#7B61FF]/80 font-semibold">
            Avec IA · SmartBoard Architect
          </p>
          {coachCompetences.length > 0 ? (
            <div className="rounded-lg border border-[#7B61FF]/25 bg-black/25 p-2.5">
              <p className="text-[10px] uppercase tracking-widest text-[#c4b5fd] font-semibold">
                Compétences coach injectées avant génération
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {coachCompetences.map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] text-gray-200">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <Button
            type="button"
            className="bg-gradient-to-r from-[#6366f1] to-[#7B61FF] text-white font-bold hover:from-[#8b7cff] hover:to-[#6d5acf] shadow-[0_0_18px_rgba(123,97,255,0.35)]"
            onClick={generateWithGptIA}
            disabled={iaGenerating || mindmapGenerating || coachRefineBusy}
          >
            {iaGenerating || coachRefineBusy ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {coachRefineBusy ? 'Coach LONGIA organise le cours…' : iaGenerating ? 'Génération en cours…' : 'Lancer SmartBoard Architect'}
          </Button>
          {iaGenerating && (
            <div
              className="space-y-2 rounded-xl border border-[#7B61FF]/20 bg-black/35 p-3"
              role="status"
              aria-live="polite"
              aria-valuenow={iaGenProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="flex justify-between gap-3 text-[11px] text-gray-400">
                <span className="leading-snug min-w-0">{iaGenLabel || 'Connexion au service…'}</span>
                <span className="tabular-nums text-[#7B61FF] font-semibold shrink-0">{iaGenProgress}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden ring-1 ring-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#312e81] via-[#7B61FF] to-[#c4b5fd] transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, iaGenProgress))}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Avancement estimé sur la durée (analyse puis JSON). Si le serveur coupe avant la fin, raccourcissez le texte ou allongez le timeout Netlify de cette fonction.
              </p>
            </div>
          )}
          {iaError && (
            <p className="text-xs text-red-400 flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0">⚠</span>
              {iaError}
            </p>
          )}
        </div>
      </div>

      {scenes.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/25 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-[#7B61FF] font-semibold">{scenes.length} scène(s) dans le brouillon</p>
            {scenes.some((s) => s.ia_data) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[#7B61FF]/40 text-[#7B61FF] hover:bg-[#7B61FF]/10 h-8 text-xs"
                onClick={openDraftArchitect}
              >
                <MonitorPlay className="w-3.5 h-3.5 mr-1.5" />
                Atelier plein écran (déroulé progressif)
              </Button>
            )}
          </div>
          <ul className="space-y-1 max-h-32 overflow-y-auto text-xs text-gray-400">
            {scenes.map((s, i) => (
              <li key={s.id || i}>• {s.name || `Scène ${i + 1}`}</li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        open={stageReviewModal.open}
        onOpenChange={(open) => {
          if (!open) closeStageReview(false);
        }}
      >
        <DialogContent className="max-w-2xl border-white/15 bg-[#10131d] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              {stageReviewModal.title || 'Validation de l’étape'}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Vérifiez le résultat avant de passer à l’étape suivante.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[62vh] overflow-y-auto">
            <StageReviewScreen
              stageKey={stageReviewModal.stageKey}
              title={stageReviewModal.title}
              items={stageReviewModal.items}
              data={stageReviewModal.data}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="border-white/20" onClick={() => closeStageReview(false)}>
              Modifier d’abord
            </Button>
            <Button type="button" className="bg-[#7B61FF] hover:bg-[#8d79ff]" onClick={() => closeStageReview(true)}>
              Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={coachHelpOpen} onOpenChange={setCoachHelpOpen}>
        <DialogContent className="max-w-xl border-white/15 bg-[#11131a] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-[#7B61FF]" />
              Aide rapide — Coach
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Pose une question sur cet onglet, un champ, ou l’action à faire maintenant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400" htmlFor="coach-help-topic">Sujet</label>
              <select
                id="coach-help-topic"
                value={coachHelpTopic}
                onChange={(e) => setCoachHelpTopic(e.target.value)}
                className="w-full h-9 rounded-lg border border-white/10 bg-black/35 px-2 text-sm text-gray-200"
              >
                <option value="onglet">Expliquer cet onglet</option>
                <option value="champ">Expliquer un champ</option>
                <option value="action">Que dois-je faire maintenant ?</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400" htmlFor="coach-help-question">Question (optionnel)</label>
              <Input
                id="coach-help-question"
                value={coachHelpQuestion}
                onChange={(e) => setCoachHelpQuestion(e.target.value)}
                placeholder="Ex: différence entre copie et remplacement ?"
                className="h-9 border-white/10 bg-black/35 text-sm"
              />
            </div>
            <Button
              type="button"
              onClick={() => void askCoachHelp()}
              disabled={coachHelpLoading}
              className="bg-[#7B61FF] text-white hover:bg-[#8d79ff]"
            >
              {coachHelpLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HelpCircle className="mr-2 h-4 w-4" />}
              Demander au coach
            </Button>
            {coachHelpError ? (
              <p className="text-xs text-red-400">{coachHelpError}</p>
            ) : null}
            {coachHelpAnswer ? (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-3 text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
                {coachHelpAnswer}
              </div>
            ) : null}
            {masterclassArtifacts ? (
              <div className="space-y-2 rounded-lg border border-[#7B61FF]/25 bg-[#7B61FF]/[0.06] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#c4b5fd]">Artefacts Masterclass (dernier run)</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] text-white/80"
                    onClick={() => {
                      const payload = JSON.stringify(masterclassArtifacts, null, 2);
                      void navigator.clipboard?.writeText(payload);
                      toast({ title: 'Copié', description: 'JSON Masterclass copié.' });
                    }}
                  >
                    Copier JSON
                  </Button>
                </div>
                <p className="text-[11px] text-gray-300">
                  Chapitres: <span className="text-white">{masterclassArtifacts.chapters?.length || 0}</span> ·
                  Segments: <span className="text-white">{masterclassArtifacts.analysis_output?.segments?.length || 0}</span>
                </p>
                {Array.isArray(masterclassArtifacts.missing_requirements) && masterclassArtifacts.missing_requirements.length > 0 ? (
                  <p className="text-[11px] text-amber-300">
                    Manquants: {masterclassArtifacts.missing_requirements.slice(0, 5).join(' | ')}
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-300">Quality gate validé.</p>
                )}
              </div>
            ) : null}
            {masterclassQuickSummary ? (
              <div className="space-y-2 rounded-lg border border-emerald-400/20 bg-emerald-500/[0.06] p-3">
                <p className="text-xs font-semibold text-emerald-300">Resume pedagogique pret a valider</p>
                <p className="text-[11px] text-gray-200">
                  <span className="text-emerald-200/90">Objectif:</span> {masterclassQuickSummary.objective}
                </p>
                <p className="text-[11px] text-gray-200">
                  <span className="text-emerald-200/90">Promesse:</span> {masterclassQuickSummary.promise}
                </p>
                {masterclassQuickSummary.themes.length > 0 ? (
                  <p className="text-[11px] text-gray-300">
                    Themes: {masterclassQuickSummary.themes.join(' | ')}
                  </p>
                ) : null}
                <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">Plan (6 lignes max)</p>
                  <ul className="space-y-1 text-[11px] text-gray-200">
                    {masterclassQuickSummary.planLines.map((line, idx) => (
                      <li key={`${line}-${idx}`}>{line}</li>
                    ))}
                  </ul>
                </div>
                <Button
                  type="button"
                  onClick={() => void launchDesignFromMasterclass()}
                  disabled={iaGenerating || coachRefineBusy}
                  className="h-8 w-full bg-emerald-600/90 text-xs text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {iaGenerating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                  Valider ce plan et lancer le design
                </Button>
                {planValidatedPulse ? (
                  <p className="flex items-center justify-center gap-1 text-[11px] text-emerald-300">
                    <Check className="h-3.5 w-3.5" />
                    Plan valide, fermeture du panneau...
                  </p>
                ) : null}
              </div>
            ) : null}
            {validatedPlanHistory.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Historique local (3 max)</p>
                <div className="space-y-2">
                  {validatedPlanHistory.map((item) => (
                    <div key={item.id} className="rounded-md border border-white/10 bg-black/30 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-gray-400">{item.at}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-white/80 hover:bg-white/10"
                          onClick={() => restoreValidatedPlan(item)}
                        >
                          Restaurer ce plan
                        </Button>
                      </div>
                      <p className="text-[11px] text-gray-200">{item.objective}</p>
                      <p className="text-[11px] text-gray-300">{item.promise}</p>
                      {item.lines?.length ? (
                        <p className="text-[10px] text-gray-400">{item.lines.join(' | ')}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={architectOpen} onOpenChange={handleArchitectOpenChange}>
        <DialogContent
          overlayClassName="z-[2200]"
          className={cn(
            '!z-[2200]',
            '!fixed !inset-3 md:!inset-5 !left-3 !top-3 !right-3 !bottom-3 md:!left-5 md:!top-5 md:!right-5 md:!bottom-5',
            '!translate-x-0 !translate-y-0 !max-w-none w-auto h-auto p-0 gap-0 flex flex-col overflow-hidden',
            'rounded-2xl border border-[#7B61FF]/30 bg-gradient-to-b from-[#080d14] via-[#0a1018] to-[#05080c] shadow-[0_0_0_1px_rgba(123,97,255,0.08),0_24px_80px_rgba(0,0,0,0.65)]'
          )}
        >
          <DialogHeader className="px-5 py-4 border-b border-white/[0.08] bg-black/30 shrink-0 text-left space-y-1">
            <DialogTitle className="text-lg md:text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#7B61FF]" />
              {architectMode === 'audio_setup' ? (
                <>SmartBoard Architect — audio LIRI (optionnel)</>
              ) : (
                <>SmartBoard Architect — atelier de prévisualisation</>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 max-w-3xl">
              {architectMode === 'audio_setup' ? (
                <>
                  <strong className="text-[#7B61FF]/90">Audio LIRI optionnel.</strong> L’agent ne fournit pas de pistes audio :
                  seules les URLs ou fichiers que vous ajoutez ici seront enregistrées dans le moteur de scènes audio (étape 7
                  reste disponible pour affiner ensuite).
                </>
              ) : (
                <>
                  Parcourez chaque slide et avancez les phases (titre → idée → développement → synthèse) comme en live.
                  {architectMode === 'pending'
                    ? ' Intégrez le programme sans toucher à l’audio, ou ouvrez le paramétrage audio avant validation.'
                    : ' Aperçu du brouillon actuel — fermez pour revenir à l’édition.'}
                </>
              )}
            </DialogDescription>
            {architectMode === 'pending' && pendingApiData && !iaGenerating && (
              <p className="text-[10px] text-[#7B61FF]/80 font-medium pt-1">
                Pipeline : {pendingApiData.provider || 'ia'}
                {pendingApiData.pipeline ? ` · ${pendingApiData.pipeline}` : ''} · {pendingApiData.slides?.length || 0} slide(s)
              </p>
            )}
            {iaGenerating && (
              <div className="pt-2 space-y-1.5" role="status" aria-live="polite">
                <div className="flex justify-between gap-2 text-[11px] text-gray-400">
                  <span className="leading-snug min-w-0">{iaGenLabel || 'Génération…'}</span>
                  <span className="tabular-nums text-[#7B61FF] font-semibold shrink-0">{iaGenProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#312e81] via-[#7B61FF] to-[#c4b5fd] transition-[width] duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, iaGenProgress))}%` }}
                  />
                </div>
              </div>
            )}
          </DialogHeader>

          {architectMode === 'audio_setup' ? (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              <input
                ref={architectAudioFileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(ev) => void handleArchitectAudioFile(ev)}
              />
              <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 space-y-4">
                <p className="text-[11px] text-gray-500 leading-relaxed border border-white/10 rounded-xl bg-black/25 px-3 py-2 space-y-2">
                  <span className="block">
                    Aucun fichier n’est ajouté automatiquement par l’IA. Renseignez une URL ou uploadez un MP3 uniquement pour les
                    slides concernées. Sans piste renseignée, le bloc LIRI du brouillon n’est pas modifié.
                  </span>
                  <label className="flex items-start gap-2 cursor-pointer select-none text-[#c4b5fd]/90">
                    <input
                      type="checkbox"
                      checked={architectLiriMergeExisting}
                      onChange={(e) => setArchitectLiriMergeExisting(e.target.checked)}
                      className="mt-0.5 rounded border-[#7B61FF]/40"
                    />
                    <span>
                      <strong className="text-[#7B61FF]">Fusionner</strong> avec les pistes LIRI déjà dans le brouillon (étape 7,
                      etc.) — les nouvelles s’ajoutent à la fin ; si un <code className="text-[10px]">id</code> existe déjà, il est
                      renommé automatiquement. Décoché = le bloc LIRI est <strong>remplacé</strong> par les seules pistes saisies
                      ci‑dessous.
                    </span>
                  </label>
                </p>
                {architectScenes.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucune slide.</p>
                ) : (
                  architectScenes.map((s, i) => (
                    <div
                      key={s.id || i}
                      className="rounded-xl border border-white/[0.1] bg-black/30 p-3 md:p-4 space-y-2"
                    >
                      <p className="text-sm font-medium text-white">
                        <span className="text-[#7B61FF] tabular-nums">{i + 1}.</span> {s.name || `Slide ${i + 1}`}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          value={architectAudioByIndex[i]?.audioUrl ?? ''}
                          onChange={(e) => patchArchitectAudioRow(i, { audioUrl: e.target.value })}
                          placeholder="URL audio (https://… MP3) — optionnel"
                          className="bg-black/40 border-white/10 text-xs font-mono h-9 flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-white/15 h-9 shrink-0"
                          disabled={architectAudioUploadBusy}
                          onClick={() => {
                            architectAudioUploadIdxRef.current = i;
                            architectAudioFileRef.current?.click();
                          }}
                        >
                          {architectAudioUploadBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5 mr-1" />
                          )}
                          Fichier
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
                        <label className="flex items-center gap-2">
                          Volume
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round((architectAudioByIndex[i]?.volume ?? 0.35) * 100)}
                            onChange={(e) =>
                              patchArchitectAudioRow(i, { volume: Number(e.target.value) / 100 })
                            }
                            className="w-24 h-1 accent-[#7B61FF]"
                          />
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={architectAudioByIndex[i]?.loop !== false}
                            onChange={(e) => patchArchitectAudioRow(i, { loop: e.target.checked })}
                            className="rounded border-white/20"
                          />
                          Boucle
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
              <aside className="w-full lg:w-[min(280px,32vw)] shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-black/20 flex flex-col max-h-[40vh] lg:max-h-none">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 px-4 pt-3 pb-2">Slides</p>
                <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
                  {architectScenes.length === 0 ? (
                    <p className="text-xs text-gray-500 px-2">Aucune scène à afficher.</p>
                  ) : (
                    architectScenes.map((s, i) => (
                      <button
                        key={s.id || i}
                        type="button"
                        onClick={() => setArchitectSlideIdx(i)}
                        className={cn(
                          'w-full text-left rounded-xl px-3 py-2.5 text-xs transition-colors border',
                          i === architectSlideSafeIdx
                            ? 'bg-[#7B61FF]/15 border-[#7B61FF]/40 text-white'
                            : 'border-transparent text-gray-400 hover:bg-white/[0.06] hover:text-gray-200'
                        )}
                      >
                        <span className="font-semibold text-[#7B61FF]/90 tabular-nums">{i + 1}.</span>{' '}
                        {s.name || `Slide ${i + 1}`}
                      </button>
                    ))
                  )}
                </div>
                <div className="px-3 pb-3 pt-1 border-t border-white/[0.06]">
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    En session live, le public voit le contenu apparaître phase par phase — testez ici avant de valider.
                  </p>
                </div>
              </aside>

              <div className="flex-1 min-h-0 flex flex-col p-3 md:p-5">
                <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-gray-300 hover:text-white"
                      disabled={architectSlideSafeIdx <= 0}
                      onClick={() => setArchitectSlideIdx((x) => Math.max(0, x - 1))}
                      aria-label="Slide précédente"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <span className="text-xs text-gray-500 tabular-nums min-w-[4.5rem] text-center">
                      {architectScenes.length ? architectSlideSafeIdx + 1 : 0} / {architectScenes.length}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-gray-300 hover:text-white"
                      disabled={architectSlideSafeIdx >= architectScenes.length - 1}
                      onClick={() => setArchitectSlideIdx((x) => Math.min(architectScenes.length - 1, x + 1))}
                      aria-label="Slide suivante"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="border-white/15 text-gray-300 h-8 text-xs" asChild>
                    <Link to="/studio/live-preparation" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 mr-1.5" />
                      Studio préparation
                    </Link>
                  </Button>
                </div>

                <div className="flex-1 min-h-0 flex items-center justify-center">
                  {previewSlide ? (
                    <div className="w-full h-full min-h-[280px] max-h-[min(72vh,calc(100vh-14rem))] flex items-center justify-center">
                      <div
                        className="relative w-full max-w-[min(100%,56rem)] aspect-[1037/750] max-h-full rounded-2xl overflow-hidden border border-white/12 shadow-[0_20px_60px_rgba(0,0,0,0.5)] ring-1 ring-[#7B61FF]/10"
                      >
                        <SlideParallaxStage key={previewSlide.id} slide={previewSlide} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center px-6">
                      Cette scène n’a pas de données « progressive build » (ia_data).
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="px-5 py-4 border-t border-white/[0.08] bg-black/35 shrink-0 flex flex-row flex-wrap items-center justify-between gap-3 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {architectMode === 'pending' && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/20 text-gray-200"
                    onClick={() => handleArchitectOpenChange(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#7B61FF]/45 text-[#7B61FF] hover:bg-[#7B61FF]/10"
                    disabled={iaGenerating}
                    onClick={regenerateInArchitect}
                  >
                    {iaGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Régénérer
                  </Button>
                </>
              )}
              {architectMode === 'audio_setup' && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/20 text-gray-200"
                  onClick={() => setArchitectMode('pending')}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Retour à l&apos;aperçu
                </Button>
              )}
              {architectMode === 'draft' && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/20 text-gray-200"
                  onClick={() => handleArchitectOpenChange(false)}
                >
                  Fermer
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {architectMode === 'pending' && pendingApiData && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#7B61FF]/40 text-[#c4b5fd] hover:bg-[#7B61FF]/10"
                    onClick={goToArchitectAudioSetup}
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    Paramétrer l&apos;audio LIRI (optionnel)
                  </Button>
                  <Button
                    type="button"
                    className="bg-gradient-to-r from-[#6366f1] to-[#7B61FF] text-white font-semibold hover:from-[#8b7cff] hover:to-[#6d5acf] shadow-[0_0_20px_rgba(123,97,255,0.35)]"
                    onClick={() => applyPendingArchitectToDraft({ withOptionalLiriAudio: false })}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Intégrer sans audio LIRI
                  </Button>
                </>
              )}
              {architectMode === 'audio_setup' && pendingApiData && (
                <Button
                  type="button"
                  className="bg-gradient-to-r from-[#6366f1] to-[#7B61FF] text-white font-semibold hover:from-[#8b7cff] hover:to-[#6d5acf] shadow-[0_0_20px_rgba(123,97,255,0.35)]"
                  onClick={() => applyPendingArchitectToDraft({ withOptionalLiriAudio: true })}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Intégrer au brouillon
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ── SmartBoard scenes configuration ─────────────────────────────────────────
const SCENE_DEFS = [
  { id: 'smartboard', label: 'SmartBoard natif', icon: Sparkles, desc: 'Programme LIRI (IA, slides progressifs) — distinct des fichiers importés ci-dessous' },
  { id: 'diapo',   label: 'Diaporama importé', icon: Presentation, desc: 'Images, PDF, exports PowerPoint / Gamma / etc. (pas le moteur SmartBoard interne)' },
  { id: 'screen',  label: 'Partage d\'écran', icon: Monitor,      desc: 'Écran Mac ou autre source (téléphone en partage d’écran via le navigateur / OS)' },
  { id: 'browser', label: 'Navigateur web',   icon: Globe,        desc: 'Iframe intégrée avec URL configurable' },
  { id: 'embed',   label: 'Embed / lien',     icon: LinkIcon,     desc: 'Vue iframe secondaire (contenus embeddables)' },
  { id: 'quiz',    label: 'Quiz intégré',     icon: FileText,     desc: 'Scène quiz accessible depuis le joker sur l’écran intelligent' },
  { id: 'board',   label: 'Tableau blanc',    icon: Pencil,       desc: 'Dessin libre, annotations en direct' },
  { id: 'image',   label: 'Images partagées', icon: ImageIcon,    desc: 'Liste d’images : avance manuelle ou boucle sur l’écran intelligent' },
  { id: 'camera2', label: 'Caméra 2',         icon: Camera,       desc: 'Autre webcam (ex. caméra bureau iMac vs FaceTime), téléphone USB, ou flux à choisir au moment du live' },
  { id: 'shop',    label: 'Boutique / Liens', icon: ShoppingCart,  desc: 'Produits, formations, consultations — lien de paiement cliquable en direct' },
];

function SmartBoardScenesConfig({ draft, updateDraft }) {
  const { toast } = useToast();
  const scenes = draft.smartboard_scenes || {};
  const slides = draft.smartboard_slides || [];
  const images = draft.smartboard_shared_images || [];
  const [uploadingSlide, setUploadingSlide] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [slidePreview, setSlidePreview] = useState(null);
  const slideInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const toggleScene = (id, enabled) => {
    updateDraft({ smartboard_scenes: { ...scenes, [id]: enabled } });
  };

  const handleSlideUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingSlide(true);
    const newSlides = [...slides];
    for (const file of files) {
      try {
        const safeName = file.name.replace(/[^\w.\-]+/g, '_');
        const path = `slides/${Date.now()}-${safeName}`;
        const contentType = file.type || (
          /\.pdf$/i.test(file.name) ? 'application/pdf'
            : /\.pptx$/i.test(file.name)
              ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
              : /\.ppt$/i.test(file.name)
                ? 'application/vnd.ms-powerpoint'
                : undefined
        );
        const { error } = await runStorageWithAuthRetry(supabase, () =>
          supabase.storage.from('videos').upload(path, file, {
            contentType: contentType || file.type || 'application/octet-stream',
          })
        );
        if (error) throw error;
        const { data } = supabase.storage.from('videos').getPublicUrl(path);
        const label = file.name.replace(/\.[^.]+$/, '');
        const entry = {
          url: data.publicUrl,
          label,
          mimeType: contentType || file.type || '',
        };
        entry.kind = inferUploadedSlideKind(entry);
        newSlides.push(entry);
      } catch (err) {
        console.error('[slides] upload failed', err);
        toast({
          variant: 'destructive',
          title: 'Import impossible',
          description: err?.message || 'Vérifiez le format, la taille du fichier et les droits du bucket de stockage.',
        });
      }
    }
    updateDraft({ smartboard_slides: newSlides });
    setUploadingSlide(false);
    if (slideInputRef.current) slideInputRef.current.value = '';
  };

  const removeSlide = (idx) => updateDraft({ smartboard_slides: slides.filter((_, i) => i !== idx) });

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingImage(true);
    const newImages = [...images];
    for (const file of files) {
      try {
        const path = `shared-images/${Date.now()}-${file.name}`;
        const { error } = await runStorageWithAuthRetry(supabase, () =>
          supabase.storage.from('videos').upload(path, file, { contentType: file.type })
        );
        if (error) throw error;
        const { data } = supabase.storage.from('videos').getPublicUrl(path);
        newImages.push({ url: data.publicUrl, label: file.name.replace(/\.[^.]+$/, '') });
      } catch (err) {
        console.error('[images] upload failed', err);
      }
    }
    updateDraft({ smartboard_shared_images: newImages });
    setUploadingImage(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeImage = (idx) => updateDraft({ smartboard_shared_images: images.filter((_, i) => i !== idx) });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 rounded-2xl border border-[#2D3139] bg-[#0d0f14]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-5"
    >
      <div className="mb-1 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#7B61FF]/25 bg-[#7B61FF]/10">
          <LayoutPanelLeft className="h-5 w-5 text-[#7B61FF]" />
        </span>
        <div>
          <h3 className="font-semibold text-white">Joker — scènes de l’écran intelligent</h3>
          <p className="text-xs text-gray-500">
            Choisissez quelles scènes seront proposées dans le switch (comme OBS) sur l’écran intelligent. Le{' '}
            <strong className="text-gray-400">SmartBoard natif</strong> correspond au programme défini à l’écran précédent ; le{' '}
            <strong className="text-gray-400">diaporama importé</strong> aux fichiers de la zone « Slides / Diaporama ».
          </p>
        </div>
      </div>

      {/* Scene toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SCENE_DEFS.map(({ id, label, icon: Icon, desc }) => {
          const enabled = scenes[id] !== false;
          return (
            <div
              key={id}
              className={cn(
                'rounded-2xl border p-3 transition-all duration-200',
                enabled
                  ? 'border-[#7B61FF]/40 bg-[#7B61FF]/[0.06]'
                  : 'border-[#2D3139] bg-[#0a0c10]/70 opacity-80'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className={cn(
                    'mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl',
                    enabled ? 'bg-[#7B61FF]/15 text-[#7B61FF]' : 'bg-[#2A2F38] text-gray-500'
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-[11px] text-gray-500">{desc}</p>
                  </div>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => toggleScene(id, v)}
                  className="data-[state=checked]:bg-[#7B61FF]"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Diapo configuration — slides import */}
      <AnimatePresence>
        {scenes.diapo !== false && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-[#7B61FF] font-semibold">Slides / Diaporama</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/10 text-gray-300 h-7 text-xs"
                  onClick={() => slideInputRef.current?.click()}
                  disabled={uploadingSlide}
                >
                  {uploadingSlide ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                  Importer des slides
                </Button>
                <input
                  ref={slideInputRef}
                  type="file"
                  accept="image/*,.pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  multiple
                  className="hidden"
                  onChange={handleSlideUpload}
                />
              </div>
              <p className="text-[10px] text-gray-600">
                PDF : affichage intégré. PowerPoint (.ppt / .pptx) : visionneuse Microsoft (URL publique HTTPS requise). Les anciens fichiers sans extension peuvent être ré-importés pour un meilleur typage.
              </p>
              {slides.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {slides.map((s, i) => {
                    const sk = inferUploadedSlideKind(s);
                    const openPreview = () => setSlidePreview({ url: s.url, label: s.label, kind: sk });
                    return (
                      <div
                        key={`${s.url}-${i}`}
                        role="button"
                        tabIndex={0}
                        title="Cliquer pour prévisualiser"
                        onClick={openPreview}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openPreview();
                          }
                        }}
                        className="relative group rounded-xl border border-white/10 overflow-hidden aspect-video bg-black cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]/60"
                      >
                        {sk === 'image' ? (
                          <img src={s.url} alt="" className="w-full h-full object-cover pointer-events-none" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-zinc-900 to-black p-2 pointer-events-none">
                            {sk === 'pdf' ? (
                              <FileText className="w-8 h-8 text-red-400/90" />
                            ) : (
                              <Presentation className="w-8 h-8 text-orange-400/90" />
                            )}
                            <span className="text-[9px] text-center text-white/50 leading-tight px-1 line-clamp-2">{sk === 'pdf' ? 'PDF' : 'PowerPoint'}</span>
                          </div>
                        )}
                        <div
                          className="absolute top-1 right-1 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            title="Prévisualiser"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPreview();
                            }}
                            className="rounded-lg bg-black/70 p-1.5 text-[#7B61FF] hover:text-[#c4b5fd] hover:bg-black/90"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Supprimer"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSlide(i);
                            }}
                            className="rounded-lg bg-black/70 p-1.5 text-red-400 hover:text-red-300 hover:bg-black/90"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="absolute bottom-0.5 left-0.5 right-0.5 text-[8px] text-white/60 truncate bg-black/60 rounded px-1 pointer-events-none">{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-600 italic">Aucun slide importé. Importez des images, un PDF ou une présentation PowerPoint pour votre diaporama.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Browser default URL */}
      <AnimatePresence>
        {scenes.browser !== false && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider text-[#7B61FF] font-semibold">Navigateur web — URL par défaut</p>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <LinkIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <Input
                    value={draft.smartboard_default_browser_url || ''}
                    onChange={(e) => updateDraft({ smartboard_default_browser_url: e.target.value })}
                    placeholder="https://fr.wikipedia.org"
                    className="bg-black/30 border-white/10 text-sm h-8"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-600">Le navigateur s'ouvrira sur cette URL au démarrage de la scène.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shared images */}
      <AnimatePresence>
        {scenes.image !== false && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-[#7B61FF] font-semibold">Images partagées</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/10 text-gray-300 h-7 text-xs"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                  Ajouter des images
                </Button>
                <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
              </div>
              {images.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img, i) => {
                    const openSharedPreview = () =>
                      setSlidePreview({ url: img.url, label: img.label || `Image ${i + 1}`, kind: 'image' });
                    return (
                      <div
                        key={`${img.url}-${i}`}
                        role="button"
                        tabIndex={0}
                        title="Cliquer pour prévisualiser"
                        onClick={openSharedPreview}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openSharedPreview();
                          }
                        }}
                        className="relative group rounded-xl border border-white/10 overflow-hidden aspect-video bg-black cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]/60"
                      >
                        <img src={img.url} alt="" className="w-full h-full object-cover pointer-events-none" />
                        <div
                          className="absolute top-1 right-1 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            title="Prévisualiser"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSharedPreview();
                            }}
                            className="rounded-lg bg-black/70 p-1.5 text-[#7B61FF] hover:text-[#c4b5fd] hover:bg-black/90"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Supprimer"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(i);
                            }}
                            className="rounded-lg bg-black/70 p-1.5 text-red-400 hover:text-red-300 hover:bg-black/90"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-600 italic">Aucune image. Les images ajoutées seront projetables sur le SmartBoard.</p>
              )}
              {images.length > 0 && (
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
                  <div>
                    <p className="text-xs text-white/80">Défilement automatique (boucle)</p>
                    <p className="text-[10px] text-gray-500">Sur l’écran intelligent : changement d’image selon un intervalle ; sinon avance manuelle uniquement.</p>
                  </div>
                  <Switch
                    checked={draft.smartboard_shared_images_loop === true}
                    onCheckedChange={(v) => updateDraft({ smartboard_shared_images_loop: v })}
                    className="data-[state=checked]:bg-[#7B61FF]"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shop / Boutique products */}
      <AnimatePresence>
        {scenes.shop !== false && (
          <ShopProductsConfig draft={draft} updateDraft={updateDraft} />
        )}
      </AnimatePresence>

      <Dialog open={!!slidePreview} onOpenChange={(open) => { if (!open) setSlidePreview(null); }}>
        <DialogContent
          overlayClassName="z-[2200]"
          className="!z-[2200] max-w-[min(96vw,900px)] w-full max-h-[90vh] flex flex-col rounded-2xl bg-[#0F1419] border-white/10 p-0 gap-0 overflow-hidden"
        >
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-white/10 shrink-0">
            <DialogTitle className="text-white text-base truncate pr-8">{slidePreview?.label || 'Prévisualisation'}</DialogTitle>
            <DialogDescription className="text-gray-500 text-xs">
              {slidePreview?.kind === 'office'
                ? 'Visionneuse Microsoft — le fichier doit être accessible publiquement en HTTPS (bucket public Supabase).'
                : slidePreview?.kind === 'pdf'
                  ? 'Aperçu du PDF — même rendu que sur l’écran intelligent en scène Diaporama.'
                  : 'Aperçu image.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-[50vh] p-3">
            {slidePreview?.kind === 'image' ? (
              <img src={slidePreview.url} alt="" className="w-full h-full max-h-[70vh] object-contain rounded-xl border border-white/10 mx-auto block" />
            ) : (
              <iframe
                title={slidePreview?.label || 'preview'}
                src={slidePreview ? getDocumentEmbedSrc(slidePreview.url, slidePreview.kind === 'office' ? 'office' : 'pdf') : ''}
                className="w-full h-[min(70vh,560px)] rounded-xl border border-white/10 bg-black"
                allowFullScreen
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ── Shop products configurator ──────────────────────────────────────────────
const PRODUCT_CATEGORIES = [
  { id: 'formation', label: 'Formations & Cycles' },
  { id: 'consultation', label: 'Consultations' },
  { id: 'mentorat', label: 'Mentorat' },
  { id: 'service', label: 'Services' },
  { id: 'custom', label: 'Lien personnalisé' },
];

function ShopProductsConfig({ draft, updateDraft }) {
  const products = draft.smartboard_shop_products || [];
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [dbPlans, setDbPlans] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '', description: '', price: '', currency: 'EUR',
    category: 'custom', interval: 'one_time', payUrl: '', badge: '', cta: 'Acheter',
  });

  const loadPlans = async () => {
    setLoadingPlans(true);
    try {
      const { data } = await supabase.from('billing_plans').select('*').eq('active', true).order('name');
      setDbPlans(data || []);
    } catch { /* ignore */ }
    finally { setLoadingPlans(false); }
  };

  const addFromPlan = (plan) => {
    if (products.some((p) => p.planSlug === plan.slug)) return;
    const cat = plan.slug.includes('mentorat') ? 'mentorat'
      : plan.slug.includes('consultation') ? 'consultation'
      : plan.slug.includes('autonome') ? 'formation'
      : 'service';
    const product = {
      id: plan.id,
      planSlug: plan.slug,
      name: plan.name,
      description: plan.meta?.description || '',
      price: plan.price_amount,
      currency: plan.price_currency || 'EUR',
      interval: plan.interval_type,
      category: cat,
      payUrl: `/paiements/payer?plan=${plan.slug}&interval=${plan.interval_type}`,
      badge: plan.interval_type === 'one_time' ? 'Paiement unique' : '',
      cta: 'Souscrire',
      image: plan.meta?.image || '',
    };
    updateDraft({ smartboard_shop_products: [...products, product] });
  };

  const addCustomProduct = () => {
    if (!newProduct.name.trim()) return;
    const product = {
      id: `custom-${Date.now()}`,
      ...newProduct,
      price: newProduct.price ? Number(newProduct.price) : null,
    };
    updateDraft({ smartboard_shop_products: [...products, product] });
    setNewProduct({ name: '', description: '', price: '', currency: 'EUR', category: 'custom', interval: 'one_time', payUrl: '', badge: '', cta: 'Acheter' });
    setShowAddForm(false);
  };

  const removeProduct = (idx) => {
    updateDraft({ smartboard_shop_products: products.filter((_, i) => i !== idx) });
  };

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-3">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#7B61FF] font-semibold flex items-center gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5" /> Boutique en direct
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5">Produits affichés sur le SmartBoard avec lien de paiement cliquable</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-white/10 text-gray-300 h-7 text-xs"
              onClick={() => { loadPlans(); }}
              disabled={loadingPlans}
            >
              {loadingPlans ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <DollarSign className="w-3 h-3 mr-1" />}
              Depuis le catalogue
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/10 text-gray-300 h-7 text-xs"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="w-3 h-3 mr-1" /> Personnalisé
            </Button>
          </div>
        </div>

        {/* DB plans picker */}
        {dbPlans.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-gray-500">Plans actifs — cliquez pour ajouter</p>
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
              {dbPlans.map((plan) => {
                const added = products.some((p) => p.planSlug === plan.slug);
                return (
                  <button
                    key={plan.id}
                    type="button"
                    disabled={added}
                    onClick={() => addFromPlan(plan)}
                    className={cn(
                      'w-full flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors',
                      added
                        ? 'border-[#7B61FF]/30 bg-[#7B61FF]/5 cursor-default'
                        : 'border-white/8 bg-black/20 hover:border-white/20 hover:bg-white/5'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{plan.name}</p>
                      <p className="text-[10px] text-gray-500">{plan.slug} · {plan.interval_type}</p>
                    </div>
                    <span className="text-xs font-semibold text-[#7B61FF] ml-2">
                      {added ? '✓' : `${plan.price_amount} ${plan.price_currency}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom product form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-xl border border-[#7B61FF]/20 bg-[#7B61FF]/5 p-4 space-y-3">
              <p className="text-xs text-[#7B61FF] font-semibold">Ajouter un produit / lien personnalisé</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={newProduct.name}
                  onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nom du produit"
                  className="bg-black/30 border-white/10 text-sm h-8 col-span-2"
                />
                <Input
                  value={newProduct.description}
                  onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Description courte"
                  className="bg-black/30 border-white/10 text-sm h-8 col-span-2"
                />
                <Input
                  value={newProduct.price}
                  onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
                  placeholder="Prix (ex: 55)"
                  type="number"
                  className="bg-black/30 border-white/10 text-sm h-8"
                />
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value }))}
                  className="bg-black/30 border border-white/10 rounded-lg text-sm h-8 text-white px-2"
                >
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <Input
                  value={newProduct.payUrl}
                  onChange={(e) => setNewProduct((p) => ({ ...p, payUrl: e.target.value }))}
                  placeholder="URL de paiement (ex: /paiements/payer?plan=...)"
                  className="bg-black/30 border-white/10 text-sm h-8 col-span-2"
                />
                <Input
                  value={newProduct.badge}
                  onChange={(e) => setNewProduct((p) => ({ ...p, badge: e.target.value }))}
                  placeholder="Badge (optionnel, ex: Promo)"
                  className="bg-black/30 border-white/10 text-sm h-8"
                />
                <Input
                  value={newProduct.cta}
                  onChange={(e) => setNewProduct((p) => ({ ...p, cta: e.target.value }))}
                  placeholder="Bouton (ex: Acheter)"
                  className="bg-black/30 border-white/10 text-sm h-8"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" className="border-white/10 text-gray-400 h-7 text-xs" onClick={() => setShowAddForm(false)}>
                  Annuler
                </Button>
                <Button size="sm" variant="accent" className="h-7 text-xs" onClick={addCustomProduct} disabled={!newProduct.name.trim()}>
                  <Plus className="w-3 h-3 mr-1" /> Ajouter
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current products list */}
        {products.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-gray-500">Produits configurés ({products.length})</p>
            {products.map((p, i) => (
              <div key={p.id || i} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                <ShoppingCart className="w-3.5 h-3.5 text-[#7B61FF]/60 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{p.category} · {p.price != null ? `${p.price} ${p.currency || 'EUR'}` : 'Gratuit'}</p>
                </div>
                <button type="button" onClick={() => removeProduct(i)} className="text-gray-600 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
