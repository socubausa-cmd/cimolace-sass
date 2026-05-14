/**
 * Runtime orchestrateur du pipeline LIRI Masterclass Coach.
 *
 * 1. Si `VITE_LIRI_BRAIN_URL` ou `VITE_USE_LIRI_BRAIN=true`, on essaie d'abord
 *    une génération JSON complète via le brain API (un seul appel LLM).
 * 2. Sinon (ou en cas d'échec), on revient sur le mock generator étape par étape.
 *
 * Toutes les fonctions retournent un `MasterclassProject` partiel à fusionner
 * dans le state global du hook `useMasterclassProject`.
 */

import {
  buildMasterclassJsonInstruction,
  normalizeMasterclassOutput,
  tryParseMasterclassJson,
  evaluateMasterclassQuality,
} from './engine';
import {
  buildExportSummary,
  mockGenerateAnalysis,
  mockGenerateBlocks,
  mockGenerateChapters,
  mockGeneratePedagogy,
  mockGenerateScripts,
  mockGenerateSlides,
} from './mockGenerator';
import { resolveLiriBrainEndpoint, invokeLiriBrainStream } from '@/lib/liri-brain/invokeBrowser';

function genId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function tryRunFactoryApi(rawText, { signal } = {}) {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch('/api/liri/masterclass-factory/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText }),
      signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) return null;
    return json.data || null;
  } catch {
    return null;
  }
}

/**
 * Tentative d'appel réel au LIRI Brain pour produire le JSON masterclass complet.
 * Retourne `null` si non configuré ou si la sortie est invalide.
 */
async function tryRunRealBrain(rawText, { sessionId, signal } = {}) {
  const endpoint = resolveLiriBrainEndpoint();
  if (!endpoint) return null;
  const message = buildMasterclassJsonInstruction(rawText);
  try {
    const { answer, structured } = await invokeLiriBrainStream(
      endpoint,
      {
        message,
        sessionId: sessionId || `masterclass-${genId()}`,
        mode: 'auto',
        stream: true,
      },
      { signal },
    );
    const raw = structured?.answer || answer || '';
    const parsed = tryParseMasterclassJson(raw);
    if (!parsed) return null;
    const normalized = normalizeMasterclassOutput(parsed, rawText);
    const quality = evaluateMasterclassQuality(normalized);
    return { masterclass: normalized, quality };
  } catch (err) {
    console.warn('[liri-masterclass/runtime] real brain failed, falling back to mock:', err?.message || err);
    return null;
  }
}

/**
 * Convertit la sortie normalisée du moteur (JSON) vers la forme attendue par le hook
 * (analysis / blocks / chapters / pedagogy / slides / scripts).
 */
function mapBrainJsonToProject(brainResult, rawText) {
  const m = brainResult?.masterclass || {};
  const ana = m.analysis_output || {};
  const segments = Array.isArray(ana.segments) ? ana.segments : [];

  const analysis = {
    global_subject: ana.global_subject || '',
    intention: ana.intention || '',
    audience: ana.audience || ana.audience_level || 'mixed',
    difficulty: ana.difficulty || 'medium',
    difficulty_score: 0.65,
    estimated_total_duration: ana.estimated_total_duration || '',
    central_themes: Array.isArray(ana.central_themes) ? ana.central_themes : [],
    global_revelations: Array.isArray(ana.global_revelations) ? ana.global_revelations : [],
    analysis_steps: [
      { label: 'Compréhension globale du sujet', done: true },
      { label: 'Extraction des idées principales', done: true },
      { label: 'Identification des blocs de sens', done: true },
      { label: 'Détection des révélations', done: true },
      { label: 'Évaluation de la pertinence pédagogique', done: true },
    ],
  };

  const blocks = segments.map((s, i) => ({
    id: Number(s.segment_id) || i + 1,
    lines_label: `Lignes ${s.from_line || '?'} → ${s.to_line || '?'}`,
    from_line: Number(s.from_line) || 0,
    to_line: Number(s.to_line) || 0,
    title: s.topic || `Bloc ${i + 1}`,
    central_idea: s.central_idea || '',
    duration_minutes: Number(s.recommended_duration_minutes) || 10,
    revelations: Array.isArray(s.revealed_ideas) ? s.revealed_ideas : [],
    tensions: Array.isArray(s.pedagogical_tensions) ? s.pedagogical_tensions : [],
    keywords: Array.isArray(s.keywords) ? s.keywords : [],
    type: s.segment_type || 'definition',
    difficulty: s.difficulty || 'medium',
  }));

  const chapters = Array.isArray(m.chapters) ? m.chapters : [];

  return {
    rawText,
    analysis,
    blocks,
    chapters: chapters.map((c) => ({
      chapter_id: c.chapter_id,
      title: c.title,
      source_segments: c.source_segments,
      objective: c.objective,
      skill_to_acquire: c.skill_to_acquire,
      knowledge_to_transmit: c.knowledge_to_transmit,
      main_revelation: c.main_revelation || c.revelation_moment,
      recommended_duration_minutes: c.recommended_duration_minutes,
      difficulty: c.difficulty,
      // pédagogie complète déjà présente dans la sortie engine.js
      real_life_situation: c.real_life_situation,
      pedagogical_tension: c.pedagogical_tension,
      thought_experiment: c.thought_experiment,
      revelation_moment: c.revelation_moment,
      simple_lesson: c.simple_lesson,
      deep_lesson: c.deep_lesson,
      analogies: c.analogies,
      examples: c.examples,
      reformulation: c.reformulation,
      workshop: c.workshop,
      deep_error: c.deep_error,
      pedagogical_correction: c.pedagogical_correction,
      je_retiens: c.je_retiens,
      understanding_test: c.understanding_test,
      real_application: c.real_application,
      concept_links: c.concept_links,
      mastery_level: c.mastery_level,
      transition_to_next: c.transition_to_next,
    })),
    raw_engine_json: m,
    quality: brainResult?.quality || null,
  };
}

/**
 * Pipeline complet : exécute toutes les étapes en série et notifie via onStep().
 *
 * Pour l'expérience utilisateur, on essaie d'abord d'avoir un résultat global
 * depuis le brain. Quoi qu'il arrive, on enrichit avec les générateurs mocks
 * pour les étapes que l'API n'a pas couvertes (slides, scripts, exports).
 */
export async function runMasterclassPipeline(rawText, options = {}) {
  const { onStep = () => {}, sessionId, signal } = options;

  const apiResult = await tryRunFactoryApi(rawText, { signal });
  if (apiResult) {
    const normalizedExports = apiResult.exports && typeof apiResult.exports === 'object' ? apiResult.exports : {};
    const normalizedSummary =
      normalizedExports.summary && typeof normalizedExports.summary === 'object'
        ? normalizedExports.summary
        : normalizedExports;
    onStep('analyse', 'done', { analysis: apiResult.analysis || null });
    onStep('blocks', 'done', { blocks: apiResult.blocks || [] });
    onStep('chapters', 'done', { chapters: apiResult.chapters || [] });
    onStep('pedagogy', 'done', { fullChapters: apiResult.pedagogy || apiResult.chapters || [] });
    onStep('slides', 'done', { slides: apiResult.slides || [] });
    onStep('scripts', 'done', { scripts: apiResult.scripts || apiResult.script || [] });
    onStep('export', 'done', { summary: normalizedSummary, exports: normalizedExports });
    return {
      rawText,
      analysis: apiResult.analysis || null,
      blocks: apiResult.blocks || [],
      chapters: apiResult.pedagogy || apiResult.chapters || [],
      slides: apiResult.slides || [],
      scripts: apiResult.scripts || apiResult.script || [],
      summary: normalizedSummary || null,
      exports: normalizedExports || null,
      raw_engine_json: null,
      quality: apiResult.quality || null,
      is_real_brain: false,
    };
  }

  onStep('analyse', 'running');
  const realResult = await tryRunRealBrain(rawText, { sessionId, signal });

  let analysis;
  let blocks;
  let chapters;
  let fullChapters;
  let raw_engine_json = null;
  let quality = null;

  if (realResult) {
    const project = mapBrainJsonToProject(realResult, rawText);
    analysis = project.analysis;
    blocks = project.blocks;
    chapters = project.chapters.map(({ chapter_id, title, source_segments, objective, skill_to_acquire, knowledge_to_transmit, main_revelation, recommended_duration_minutes, difficulty }) => ({
      chapter_id,
      title,
      source_segments,
      objective,
      skill_to_acquire,
      knowledge_to_transmit,
      main_revelation,
      recommended_duration_minutes,
      difficulty,
    }));
    fullChapters = project.chapters;
    raw_engine_json = project.raw_engine_json;
    quality = project.quality;
    onStep('analyse', 'done', { analysis });
    onStep('blocks', 'done', { blocks });
    onStep('chapters', 'done', { chapters });
    onStep('pedagogy', 'done', { fullChapters });
  } else {
    analysis = await mockGenerateAnalysis(rawText);
    onStep('analyse', 'done', { analysis });

    onStep('blocks', 'running');
    blocks = await mockGenerateBlocks(rawText, analysis);
    onStep('blocks', 'done', { blocks });

    onStep('chapters', 'running');
    chapters = await mockGenerateChapters(rawText, blocks);
    onStep('chapters', 'done', { chapters });

    onStep('pedagogy', 'running');
    fullChapters = await mockGeneratePedagogy(rawText, chapters);
    onStep('pedagogy', 'done', { fullChapters });
  }

  onStep('slides', 'running');
  const slides = await mockGenerateSlides(rawText, fullChapters);
  onStep('slides', 'done', { slides });

  onStep('scripts', 'running');
  const scripts = await mockGenerateScripts(rawText, fullChapters);
  onStep('scripts', 'done', { scripts });

  const summary = buildExportSummary({ chapters: fullChapters, slides });
  const exports = {
    summary,
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
  };
  onStep('export', 'done', { summary, exports });

  return {
    rawText,
    analysis,
    blocks,
    chapters: fullChapters,
    slides,
    scripts,
    summary,
    exports,
    raw_engine_json,
    quality,
    is_real_brain: Boolean(realResult),
  };
}

/* Exports utilitaires (re-export pratique pour l'UI) */
export { buildExportSummary } from './mockGenerator';
