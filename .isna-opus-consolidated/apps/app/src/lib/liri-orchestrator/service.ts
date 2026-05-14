import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runMasterclassPipeline } from '@/lib/liri-masterclass/runtime';
import { SMARTBOARD_STEPS } from '@/lib/liri-smartboard/steps';

type ChapterStatus =
  | 'draft'
  | 'structured'
  | 'ready_for_visual'
  | 'visual_mapped'
  | 'ready_for_smartboard'
  | 'smartboard_generating'
  | 'smartboard_completed'
  | 'completed'
  | 'failed';

type OrchestratorStatus = 'running' | 'completed' | 'failed';
type CourseType =
  | 'spiritual'
  | 'math'
  | 'science'
  | 'keynote'
  | 'technical'
  | 'business'
  | 'general';

interface StartPayload {
  projectId?: string;
  rawText: string;
  courseType?: CourseType;
  memory?: Partial<GlobalMemory>;
}

type SlideActionType = 'generate' | 'regenerate' | 'validate' | 'next';

interface GlobalMemory {
  course_style: string;
  pedagogy_model: string;
  visual_identity: string;
  tone: string;
  target_audience: string;
}

interface VisualMapStep {
  step: string;
  dominant_mode: string;
  text_ratio: number;
  image_ratio: number;
  graphic_ratio: number;
  layout: string;
  image_type: string | null;
  graphic_type: string | null;
  smartboard_scene_type: 'progressive_build';
  quality_rule: string;
}

interface ChapterState {
  chapterId: string;
  title: string;
  objective: string;
  skill: string;
  knowledge: string;
  payload: Record<string, unknown>;
  status: ChapterStatus;
  visualMap: VisualMapStep[];
  slides: Array<Record<string, unknown>>;
  quality: { valid: boolean; issues: string[] } | null;
  error?: string;
}

interface OrchestratorProject {
  projectId: string;
  rawText: string;
  status: OrchestratorStatus;
  createdAt: string;
  updatedAt: string;
  courseType: CourseType;
  memory: GlobalMemory;
  queues: {
    coach_queue: string[];
    visual_queue: string[];
    smartboard_queue: string[];
    quality_queue: string[];
  };
  chapters: ChapterState[];
  logs: string[];
  error?: string;
}

const projects = new Map<string, OrchestratorProject>();
const inProgress = {
  coach: new Set<string>(),
  visual: new Set<string>(),
  smartboard: new Set<string>(),
  quality: new Set<string>(),
};

const CONCURRENCY = { coach: 1, visual: 3, smartboard: 2, quality: 3 };

const DEFAULT_MEMORY: GlobalMemory = {
  course_style: 'premium immersive',
  pedagogy_model: 'masterclass progressive',
  visual_identity: 'LIRI dark glassmorphism',
  tone: 'inspiring and precise',
  target_audience: 'mixed',
};

const PERSIST_DIR = path.join(process.cwd(), '.cache');
const PERSIST_FILE = path.join(PERSIST_DIR, 'liri-orchestrator-projects.json');
let hydrated = false;

function timestamp() {
  return new Date().toISOString();
}

async function hydrateFromDisk() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await readFile(PERSIST_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.projects) ? parsed.projects : [];
    for (const item of items) {
      if (item?.projectId) projects.set(String(item.projectId), item as OrchestratorProject);
    }
  } catch {
    // no persisted state yet
  }
}

async function persistToDisk() {
  try {
    await mkdir(PERSIST_DIR, { recursive: true });
    await writeFile(
      PERSIST_FILE,
      JSON.stringify(
        {
          updatedAt: timestamp(),
          projects: Array.from(projects.values()),
        },
        null,
        2,
      ),
      'utf8',
    );
  } catch {
    // non-blocking persistence
  }
}

function log(project: OrchestratorProject, message: string) {
  project.logs.unshift(`[${timestamp()}] ${message}`);
  project.logs = project.logs.slice(0, 200);
}

function makeStepVisualMap(stepKey: string): VisualMapStep {
  const presets: Record<string, Omit<VisualMapStep, 'step' | 'smartboard_scene_type'>> = {
    titre_chapitre: { dominant_mode: 'image_immersive', text_ratio: 30, image_ratio: 70, graphic_ratio: 0, layout: 'hero_center', image_type: 'image_symbolique', graphic_type: null, quality_rule: 'Compréhension en moins de 5 secondes.' },
    objectif_competence_connaissance: { dominant_mode: 'texte_structure', text_ratio: 80, image_ratio: 10, graphic_ratio: 10, layout: 'three_cards', image_type: 'image_minimaliste', graphic_type: 'process_steps', quality_rule: '3 cartes maximum, ultra lisibles.' },
    mise_en_situation: { dominant_mode: 'image_emotionnelle', text_ratio: 40, image_ratio: 60, graphic_ratio: 0, layout: 'image_background_overlay_text', image_type: 'scène_réaliste', graphic_type: null, quality_rule: 'Le contexte doit se comprendre sans lecture longue.' },
    tension_pedagogique: { dominant_mode: 'contraste_graphique', text_ratio: 60, image_ratio: 20, graphic_ratio: 20, layout: 'split_screen', image_type: 'image_comparative', graphic_type: 'dual_comparison', quality_rule: 'Opposition visuelle immédiate.' },
    experience_pensee: { dominant_mode: 'image_plus_graphique', text_ratio: 30, image_ratio: 40, graphic_ratio: 30, layout: 'immersive_simulation', image_type: 'image_métaphorique', graphic_type: 'threshold_diagram', quality_rule: 'Sens du passage clair (avant/après).' },
    revelation: { dominant_mode: 'texte_impact', text_ratio: 90, image_ratio: 10, graphic_ratio: 0, layout: 'big_statement_center', image_type: 'image_abstraite', graphic_type: null, quality_rule: 'Une phrase manifeste mémorisable.' },
  };

  const fallback = {
    dominant_mode: 'balanced',
    text_ratio: 55,
    image_ratio: 25,
    graphic_ratio: 20,
    layout: 'structured_panel',
    image_type: 'image_conceptuelle',
    graphic_type: 'flow_diagram',
    quality_rule: 'Un seul message pédagogique par slide.',
  };
  const picked = presets[stepKey] || fallback;
  return { step: stepKey, ...picked, smartboard_scene_type: 'progressive_build' };
}

function buildVisualMap(): VisualMapStep[] {
  return SMARTBOARD_STEPS.map((s) => makeStepVisualMap(s.key));
}

function computeProjectStatus(project: OrchestratorProject): OrchestratorStatus {
  if (project.chapters.some((chapter) => chapter.status === 'failed')) return 'failed';
  if (project.chapters.length > 0 && project.chapters.every((chapter) => chapter.status === 'completed')) return 'completed';
  return 'running';
}

function enqueueUnique(queue: string[], chapterId: string) {
  if (!queue.includes(chapterId)) queue.push(chapterId);
}

async function processCoach(projectId: string) {
  await hydrateFromDisk();
  const project = projects.get(projectId);
  if (!project || inProgress.coach.has(projectId)) return;
  if (project.queues.coach_queue.length === 0) return;
  if (inProgress.coach.size >= CONCURRENCY.coach) return;

  inProgress.coach.add(projectId);
  project.queues.coach_queue.shift();
  project.updatedAt = timestamp();
  log(project, 'Masterclass Coach started.');

  try {
    const output = await runMasterclassPipeline(project.rawText);
    project.chapters = (output.chapters || []).map((chapter: any, index: number) => ({
      chapterId: String(chapter?.chapter_id || index + 1),
      title: String(chapter?.title || `Chapitre ${index + 1}`),
      objective: String(chapter?.objective || ''),
      skill: String(chapter?.skill_to_acquire || ''),
      knowledge: String(chapter?.knowledge_to_transmit || ''),
      payload: chapter || {},
      status: 'ready_for_visual',
      visualMap: [],
      slides: [],
      quality: null,
    }));
    for (const chapter of project.chapters) {
      enqueueUnique(project.queues.visual_queue, chapter.chapterId);
    }
    log(project, `Masterclass Coach completed (${project.chapters.length} chapitres).`);
  } catch (error) {
    project.status = 'failed';
    project.error = error instanceof Error ? error.message : 'Coach error';
    log(project, `Masterclass Coach failed: ${project.error}`);
  } finally {
    inProgress.coach.delete(projectId);
    project.updatedAt = timestamp();
    await persistToDisk();
    void pump();
  }
}

async function processVisual(projectId: string, chapterId: string) {
  await hydrateFromDisk();
  const project = projects.get(projectId);
  if (!project) return;
  const chapter = project.chapters.find((c) => c.chapterId === chapterId);
  if (!chapter || chapter.status !== 'ready_for_visual') return;

  chapter.status = 'structured';
  chapter.visualMap = buildVisualMap();
  chapter.status = 'visual_mapped';
  chapter.status = 'ready_for_smartboard';
  enqueueUnique(project.queues.smartboard_queue, chapter.chapterId);
  project.updatedAt = timestamp();
  log(project, `Visual Director mapped chapter ${chapter.chapterId}.`);
  await persistToDisk();
}

function buildSlideFromStep(chapter: ChapterState, step: VisualMapStep, index: number) {
  return {
    slide_id: `${chapter.chapterId}_${step.step}`,
    chapter_id: chapter.chapterId,
    step: step.step,
    title: `${chapter.title} · ${step.step.replaceAll('_', ' ')}`,
    pedagogical_goal: chapter.objective || `Traiter ${step.step}`,
    dominant_mode: step.dominant_mode,
    content: {
      main_text: chapter.knowledge || chapter.objective || 'Contenu pédagogique',
      support_text: chapter.skill || '',
    },
    visual: {
      type: step.image_type || 'image_minimaliste',
      prompt: `${chapter.title} | ${step.step} | ${step.layout} | ${step.dominant_mode}`,
    },
    graphic: step.graphic_type ? { type: step.graphic_type } : undefined,
    sequence: index + 1,
  };
}

async function processSmartboard(projectId: string, chapterId: string) {
  await hydrateFromDisk();
  const project = projects.get(projectId);
  if (!project) return;
  const chapter = project.chapters.find((c) => c.chapterId === chapterId);
  if (!chapter || chapter.status !== 'ready_for_smartboard') return;

  chapter.status = 'smartboard_generating';
  chapter.slides = chapter.visualMap.map((step, index) => buildSlideFromStep(chapter, step, index));
  chapter.status = 'smartboard_completed';
  enqueueUnique(project.queues.quality_queue, chapter.chapterId);
  project.updatedAt = timestamp();
  log(project, `SmartBoard Architect completed chapter ${chapter.chapterId}.`);
  await persistToDisk();
}

async function processQuality(projectId: string, chapterId: string) {
  await hydrateFromDisk();
  const project = projects.get(projectId);
  if (!project) return;
  const chapter = project.chapters.find((c) => c.chapterId === chapterId);
  if (!chapter || chapter.status !== 'smartboard_completed') return;

  const issues: string[] = [];
  if (chapter.slides.length !== SMARTBOARD_STEPS.length) {
    issues.push(`Expected ${SMARTBOARD_STEPS.length} slides, got ${chapter.slides.length}`);
  }
  if (chapter.visualMap.some((step) => step.text_ratio + step.image_ratio + step.graphic_ratio !== 100)) {
    issues.push('At least one visual ratio is invalid');
  }

  chapter.quality = { valid: issues.length === 0, issues };
  chapter.status = issues.length === 0 ? 'completed' : 'failed';
  if (issues.length > 0) chapter.error = issues.join('; ');
  project.updatedAt = timestamp();
  log(project, `Quality Agent ${issues.length ? 'failed' : 'validated'} chapter ${chapter.chapterId}.`);
  await persistToDisk();
}

async function pump() {
  await hydrateFromDisk();
  for (const project of projects.values()) {
    if (project.status !== 'running') continue;
    void processCoach(project.projectId);

    while (
      project.queues.visual_queue.length > 0 &&
      inProgress.visual.size < CONCURRENCY.visual
    ) {
      const chapterId = project.queues.visual_queue.shift()!;
      const token = `${project.projectId}:${chapterId}`;
      inProgress.visual.add(token);
      Promise.resolve(processVisual(project.projectId, chapterId)).finally(() => {
        inProgress.visual.delete(token);
        void pump();
      });
    }

    while (
      project.queues.smartboard_queue.length > 0 &&
      inProgress.smartboard.size < CONCURRENCY.smartboard
    ) {
      const chapterId = project.queues.smartboard_queue.shift()!;
      const token = `${project.projectId}:${chapterId}`;
      inProgress.smartboard.add(token);
      Promise.resolve(processSmartboard(project.projectId, chapterId)).finally(() => {
        inProgress.smartboard.delete(token);
        void pump();
      });
    }

    while (
      project.queues.quality_queue.length > 0 &&
      inProgress.quality.size < CONCURRENCY.quality
    ) {
      const chapterId = project.queues.quality_queue.shift()!;
      const token = `${project.projectId}:${chapterId}`;
      inProgress.quality.add(token);
      Promise.resolve(processQuality(project.projectId, chapterId)).finally(() => {
        inProgress.quality.delete(token);
        void pump();
      });
    }

    project.status = computeProjectStatus(project);
  }
  await persistToDisk();
}

function getStepIndex(step: string) {
  return SMARTBOARD_STEPS.findIndex((s) => s.key === step);
}

export async function applyOrchestratorSlideAction(params: {
  projectId: string;
  chapterId: string;
  step: string;
  action: SlideActionType;
}) {
  await hydrateFromDisk();
  const project = projects.get(params.projectId);
  if (!project) return { success: false, error: 'Projet introuvable' } as const;
  const chapter = project.chapters.find((c) => c.chapterId === params.chapterId);
  if (!chapter) return { success: false, error: 'Chapitre introuvable' } as const;

  const stepIndex = getStepIndex(params.step);
  if (stepIndex < 0) return { success: false, error: 'Step invalide' } as const;
  if (!chapter.visualMap.length) chapter.visualMap = buildVisualMap();

  const ensureSlidesUntil = (targetIndex: number) => {
    for (let idx = chapter.slides.length; idx <= targetIndex && idx < chapter.visualMap.length; idx += 1) {
      const stepMap = chapter.visualMap[idx];
      chapter.slides.push(buildSlideFromStep(chapter, stepMap, idx));
    }
  };

  if (params.action === 'generate') {
    chapter.status = 'smartboard_generating';
    ensureSlidesUntil(stepIndex);
    if (chapter.slides.length >= chapter.visualMap.length) {
      chapter.status = 'smartboard_completed';
      enqueueUnique(project.queues.quality_queue, chapter.chapterId);
    }
    log(project, `Manual generate ${chapter.chapterId}:${params.step}`);
  }

  if (params.action === 'regenerate') {
    chapter.status = 'smartboard_generating';
    ensureSlidesUntil(stepIndex);
    const existing = chapter.slides[stepIndex];
    if (existing) {
      chapter.slides[stepIndex] = {
        ...existing,
        title: `${chapter.title} · ${params.step.replaceAll('_', ' ')} (regen)`,
      };
    }
    if (chapter.slides.length >= chapter.visualMap.length) {
      chapter.status = 'smartboard_completed';
      enqueueUnique(project.queues.quality_queue, chapter.chapterId);
    }
    log(project, `Manual regenerate ${chapter.chapterId}:${params.step}`);
  }

  if (params.action === 'validate') {
    ensureSlidesUntil(stepIndex);
    const allGenerated = chapter.slides.length >= chapter.visualMap.length;
    chapter.quality = { valid: allGenerated, issues: allGenerated ? [] : ['Slides manquants avant validation'] };
    chapter.status = allGenerated ? 'completed' : 'smartboard_completed';
    if (!allGenerated) enqueueUnique(project.queues.quality_queue, chapter.chapterId);
    log(project, `Manual validate ${chapter.chapterId}:${params.step}`);
  }

  if (params.action === 'next') {
    ensureSlidesUntil(Math.min(stepIndex + 1, chapter.visualMap.length - 1));
    chapter.status = chapter.slides.length >= chapter.visualMap.length ? 'smartboard_completed' : 'smartboard_generating';
    if (chapter.status === 'smartboard_completed') enqueueUnique(project.queues.quality_queue, chapter.chapterId);
    log(project, `Manual next ${chapter.chapterId}:${params.step}`);
  }

  project.status = computeProjectStatus(project);
  project.updatedAt = timestamp();
  await persistToDisk();
  return { success: true } as const;
}

export async function startOrchestrator(payload: StartPayload) {
  await hydrateFromDisk();
  const projectId = String(payload.projectId || randomUUID());
  const existing = projects.get(projectId);
  if (existing && existing.status === 'running') {
    return { projectId, alreadyRunning: true };
  }

  const project: OrchestratorProject = {
    projectId,
    rawText: payload.rawText,
    status: 'running',
    createdAt: timestamp(),
    updatedAt: timestamp(),
    courseType: payload.courseType || 'general',
    memory: { ...DEFAULT_MEMORY, ...(payload.memory || {}) },
    queues: {
      coach_queue: ['masterclass'],
      visual_queue: [],
      smartboard_queue: [],
      quality_queue: [],
    },
    chapters: [],
    logs: [],
  };

  projects.set(projectId, project);
  log(project, 'Orchestrator started.');
  await persistToDisk();
  await pump();
  return { projectId, alreadyRunning: false };
}

export async function getOrchestratorStatus(projectId: string) {
  await hydrateFromDisk();
  const project = projects.get(projectId);
  if (!project) return null;
  void pump();

  return {
    success: true,
    projectId: project.projectId,
    status: project.status,
    courseType: project.courseType,
    memory: project.memory,
    queues: project.queues,
    stats: {
      chapters_total: project.chapters.length,
      completed: project.chapters.filter((c) => c.status === 'completed').length,
      failed: project.chapters.filter((c) => c.status === 'failed').length,
      running: project.chapters.filter((c) => c.status === 'smartboard_generating').length,
    },
    chapters: project.chapters.map((chapter) => ({
      chapter_id: chapter.chapterId,
      title: chapter.title,
      status: chapter.status,
      slides_count: chapter.slides.length,
      slides: chapter.slides,
      quality: chapter.quality,
      error: chapter.error || null,
    })),
    logs: project.logs.slice(0, 40),
    updatedAt: project.updatedAt,
    createdAt: project.createdAt,
    error: project.error || null,
  };
}
