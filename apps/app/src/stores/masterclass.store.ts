import { create } from 'zustand';
import { runMasterclassPipeline } from '@/lib/liri-masterclass/runtime';
import { buildExportSummary, defaultDemoText } from '@/lib/liri-masterclass/mockGenerator';

const MAX_RAW_CHARS = 100000;
const TOTAL_STEPS = 8;

export interface MasterclassStoreState {
  step: number;
  status: 'idle' | 'running' | 'partial' | 'ready' | 'error';
  pipelineStage: string | null;
  pipelineStageStatus: 'running' | 'done' | null;
  error: string | null;
  isRealBrain: boolean;
  rawText: string;
  audienceLevel: string;
  analysis: any;
  blocks: any[];
  chapters: any[];
  slides: any[];
  scripts: any[];
  summary: any;
  exports: any;
  quality: any;
  raw_engine_json: any;
  orchestratorProjectId: string | null;
  orchestratorStatus: 'idle' | 'running' | 'completed' | 'failed';
  orchestratorQueues: {
    coach_queue: string[];
    visual_queue: string[];
    smartboard_queue: string[];
    quality_queue: string[];
  } | null;
  orchestratorChapterStatuses: Array<{
    chapter_id: string;
    title: string;
    status: string;
    slides_count: number;
  }>;
  startedAt: number | null;
  finishedAt: number | null;
  setRawText: (rawText: string) => void;
  setAudienceLevel: (level: string) => void;
  goToStep: (step: number) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
  loadDemo: () => void;
  cancel: () => void;
  launchPipeline: (overrideRawText?: string) => Promise<any>;
  hydrate: (state: Partial<MasterclassStoreState>) => void;
}

const initialState = {
  step: 0,
  status: 'idle' as const,
  pipelineStage: null,
  pipelineStageStatus: null,
  error: null,
  isRealBrain: false,
  rawText: '',
  audienceLevel: 'mixed',
  analysis: null,
  blocks: [],
  chapters: [],
  slides: [],
  scripts: [],
  summary: null,
  exports: null,
  quality: null,
  raw_engine_json: null,
  orchestratorProjectId: null,
  orchestratorStatus: 'idle' as const,
  orchestratorQueues: null,
  orchestratorChapterStatuses: [],
  startedAt: null,
  finishedAt: null,
};

let activeController: AbortController | null = null;
let orchestratorPollTimer: ReturnType<typeof setInterval> | null = null;

function stopOrchestratorPolling() {
  if (orchestratorPollTimer) {
    clearInterval(orchestratorPollTimer);
    orchestratorPollTimer = null;
  }
}

async function startOrchestrator(rawText: string) {
  const response = await fetch('/api/liri/orchestrator/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success || !json?.projectId) {
    throw new Error(json?.error || 'Orchestrateur indisponible');
  }
  return { projectId: String(json.projectId) };
}

async function fetchOrchestratorStatus(projectId: string) {
  const response = await fetch(`/api/liri/orchestrator/status?projectId=${encodeURIComponent(projectId)}`);
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || 'Statut orchestrateur indisponible');
  }
  return json;
}

export const useMasterclassStore = create<MasterclassStoreState>((set, get) => ({
  ...initialState,
  setRawText: (rawText) => set({ rawText: String(rawText || '').slice(0, MAX_RAW_CHARS) }),
  setAudienceLevel: (level) => set({ audienceLevel: level || 'mixed' }),
  goToStep: (step) => set({ step: Math.max(0, Math.min(TOTAL_STEPS - 1, Number(step) || 0)) }),
  next: () => set((state) => ({ step: Math.min(TOTAL_STEPS - 1, state.step + 1) })),
  prev: () => set((state) => ({ step: Math.max(0, state.step - 1) })),
  reset: () => {
    activeController?.abort();
    activeController = null;
    stopOrchestratorPolling();
    set({ ...initialState });
  },
  loadDemo: () => {
    activeController?.abort();
    activeController = null;
    stopOrchestratorPolling();
    set({ ...initialState, rawText: defaultDemoText() });
  },
  cancel: () => {
    activeController?.abort();
    activeController = null;
    stopOrchestratorPolling();
    set({
      status: 'error',
      error: 'Pipeline annulé.',
      pipelineStage: null,
      pipelineStageStatus: null,
    });
  },
  hydrate: (state) => {
    const next = { ...state };
    delete (next as any).launchPipeline;
    delete (next as any).setRawText;
    delete (next as any).setAudienceLevel;
    delete (next as any).goToStep;
    delete (next as any).next;
    delete (next as any).prev;
    delete (next as any).reset;
    delete (next as any).loadDemo;
    delete (next as any).cancel;
    delete (next as any).hydrate;
    set(next as Partial<MasterclassStoreState>);
  },
  launchPipeline: async (overrideRawText) => {
    const text = String(overrideRawText ?? get().rawText ?? '').trim();
    if (!text) {
      set({ status: 'error', error: 'Aucun texte source à transformer.' });
      return null;
    }

    activeController?.abort();
    activeController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    stopOrchestratorPolling();

    set({
      status: 'running',
      error: null,
      startedAt: Date.now(),
      finishedAt: null,
      step: 1,
      pipelineStage: 'analyse',
      pipelineStageStatus: 'running',
    });

    try {
      const orchestrator = await startOrchestrator(text);
      set({
        orchestratorProjectId: orchestrator.projectId,
        orchestratorStatus: 'running',
        pipelineStage: 'orchestrator',
      });

      await new Promise<void>((resolve, reject) => {
        const poll = async () => {
          try {
            const statusJson = await fetchOrchestratorStatus(orchestrator.projectId);
            const chapterStatuses = Array.isArray(statusJson?.chapters) ? statusJson.chapters : [];
            const logs = Array.isArray(statusJson?.logs) ? statusJson.logs : [];
            const stageLabel = String(logs[0] || '').replace(/^\[[^\]]+\]\s*/, '') || 'orchestrator';
            const completedCount = chapterStatuses.filter((c: any) => c?.status === 'completed').length;
            const failedCount = chapterStatuses.filter((c: any) => c?.status === 'failed').length;
            const totalCount = chapterStatuses.length;

            set((state) => ({
              orchestratorStatus: statusJson?.status || 'running',
              orchestratorQueues: statusJson?.queues || state.orchestratorQueues,
              orchestratorChapterStatuses: chapterStatuses.map((c: any) => ({
                chapter_id: String(c?.chapter_id || ''),
                title: String(c?.title || ''),
                status: String(c?.status || ''),
                slides_count: Number(c?.slides_count || 0),
              })),
              pipelineStage:
                totalCount > 0
                  ? `orchestrator (${completedCount}/${totalCount} chapitres${failedCount ? `, ${failedCount} failed` : ''})`
                  : stageLabel,
            }));

            if (statusJson?.status === 'completed') {
              stopOrchestratorPolling();
              const chapters = chapterStatuses.map((c: any, idx: number) => ({
                chapter_id: Number(c?.chapter_id || idx + 1),
                title: c?.title || `Chapitre ${idx + 1}`,
                objective: '',
                skill_to_acquire: '',
                knowledge_to_transmit: '',
              }));
              const slides = chapterStatuses.flatMap((c: any) =>
                Array.from({ length: Number(c?.slides_count || 0) }).map((_, i) => ({
                  slide_id: `${c?.chapter_id}_${i + 1}`,
                  chapter_id: c?.chapter_id,
                  title: `${c?.title || 'Chapitre'} · slide ${i + 1}`,
                  kind: 'smartboard',
                })),
              );

              set((state) => ({
                status: 'ready',
                finishedAt: Date.now(),
                pipelineStage: null,
                pipelineStageStatus: null,
                chapters: chapters.length ? chapters : state.chapters,
                slides: slides.length ? slides : state.slides,
                scripts: state.scripts,
                summary:
                  state.summary ??
                  buildExportSummary({
                    chapters: chapters.length ? chapters : state.chapters,
                    slides: slides.length ? slides : state.slides,
                  }),
              }));
              resolve();
              return;
            }

            if (statusJson?.status === 'failed') {
              stopOrchestratorPolling();
              reject(new Error(statusJson?.error || 'Orchestrateur en échec'));
            }
          } catch (error) {
            stopOrchestratorPolling();
            reject(error);
          }
        };

        void poll();
        orchestratorPollTimer = setInterval(() => {
          void poll();
        }, 1200);
      });

      return get();
    } catch (orchestratorError) {
      set({
        pipelineStage: 'fallback_masterclass_pipeline',
        pipelineStageStatus: 'running',
      });
    }

    try {
      const result = await runMasterclassPipeline(text, {
        signal: activeController?.signal,
        onStep: (stage: string, status: 'running' | 'done', patch: Record<string, any> = {}) => {
          set((state) => ({
            pipelineStage: stage,
            pipelineStageStatus: status,
            analysis: patch.analysis ?? state.analysis,
            blocks: patch.blocks ?? state.blocks,
            chapters: patch.fullChapters ?? patch.chapters ?? state.chapters,
            slides: patch.slides ?? state.slides,
            scripts: patch.scripts ?? state.scripts,
            summary: patch.summary ?? state.summary,
            exports: patch.exports ?? state.exports,
          }));
        },
      });

      set((state) => ({
        status: 'ready',
        finishedAt: Date.now(),
        pipelineStage: null,
        pipelineStageStatus: null,
        analysis: result.analysis ?? state.analysis,
        blocks: result.blocks ?? state.blocks,
        chapters: result.chapters ?? state.chapters,
        slides: result.slides ?? state.slides,
        scripts: result.scripts ?? state.scripts,
        summary:
          result.summary ??
          buildExportSummary({
            chapters: result.chapters ?? state.chapters,
            slides: result.slides ?? state.slides,
          }),
        exports:
          result.exports ??
          (result.summary
            ? {
                summary: result.summary,
                tests: [],
                exercises: [],
                transitions: [],
                downloadable: {
                  json: true,
                  markdown: true,
                  pdf_professor: false,
                  pdf_student: false,
                  smartboard: false,
                  liri_live: false,
                },
              }
            : state.exports),
        quality: result.quality ?? state.quality,
        raw_engine_json: result.raw_engine_json ?? state.raw_engine_json,
        isRealBrain: Boolean(result.is_real_brain),
        orchestratorStatus: state.orchestratorStatus === 'running' ? 'failed' : state.orchestratorStatus,
      }));

      return result;
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Pipeline LIRI Masterclass : erreur inconnue.',
        pipelineStage: null,
        pipelineStageStatus: null,
      });
      return null;
    }
  },
}));
