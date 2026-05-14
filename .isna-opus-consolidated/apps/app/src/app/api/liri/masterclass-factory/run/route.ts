import { z } from 'zod';
import { openaiChatCompletionSync } from '@/lib/liri-brain/openai';
import {
  normalizeMasterclassOutput,
  tryParseMasterclassJson,
} from '@/lib/liri-masterclass/engine.js';
import { validateMasterclassPayload } from '@/lib/liri-masterclass/quality-check';
import { buildMasterclassSystemPrompt, buildMasterclassUserPrompt } from '@/lib/liri-masterclass/prompt';
import { runMasterclassPipeline } from '@/lib/liri-masterclass/runtime';

const inputSchema = z.object({
  rawText: z.string().min(20).max(100000),
});

function buildExportsPayload({
  chapters = [],
  slides = [],
  tests = [],
  exercises = [],
  transitions = [],
}: {
  chapters?: any[];
  slides?: any[];
  tests?: any[];
  exercises?: any[];
  transitions?: any[];
}) {
  const safeChapters = Array.isArray(chapters) ? chapters : [];
  const safeSlides = Array.isArray(slides) ? slides : [];
  const safeTests = Array.isArray(tests) ? tests : [];
  const safeExercises = Array.isArray(exercises) ? exercises : [];
  const safeTransitions = Array.isArray(transitions) ? transitions : [];
  const minutes = safeChapters.reduce(
    (acc, c) => acc + (Number(c?.recommended_duration_minutes) || 0),
    0,
  );

  return {
    summary: {
      chapters_count: safeChapters.length,
      minutes_total: minutes,
      slides_count: safeSlides.length,
      exercises_count: safeExercises.length,
      tests_count: safeTests.length,
    },
    tests: safeTests,
    exercises: safeExercises,
    transitions: safeTransitions,
    downloadable: {
      json: true,
      markdown: true,
      pdf_professor: false,
      pdf_student: false,
      smartboard: false,
      liri_live: false,
    },
  };
}

function mapSegmentsToBlocks(segments: any[]): any[] {
  return (Array.isArray(segments) ? segments : []).map((segment: any, index: number) => ({
    id: Number(segment?.segment_id) || index + 1,
    title: segment?.topic || `Bloc ${index + 1}`,
    central_idea: segment?.central_idea || '',
    lines_label: `Lignes ${segment?.from_line || '?'} -> ${segment?.to_line || '?'}`,
    revelations: Array.isArray(segment?.revealed_ideas) ? segment.revealed_ideas : [],
    tensions: Array.isArray(segment?.pedagogical_tensions) ? segment.pedagogical_tensions : [],
    keywords: Array.isArray(segment?.keywords) ? segment.keywords : [],
  }));
}

function getServerOpenAiKey(): string | null {
  try {
    const key =
      typeof process !== 'undefined' && process.env?.OPENAI_API_KEY
        ? String(process.env.OPENAI_API_KEY).trim()
        : '';
    return key || null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, error: 'rawText invalide' }, { status: 400 });
  }

  const rawText = parsed.data.rawText;
  const apiKey = getServerOpenAiKey();

  try {
    if (apiKey) {
      const completion = await openaiChatCompletionSync({
        apiKey,
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 12000,
        messages: [
          { role: 'system', content: buildMasterclassSystemPrompt() },
          { role: 'user', content: buildMasterclassUserPrompt(rawText) },
        ],
      });

      const json = tryParseMasterclassJson(completion);
      if (json) {
        const normalized = normalizeMasterclassOutput(json, rawText);
        const mappedBlocks = mapSegmentsToBlocks(normalized.analysis_output?.segments || []);
        const quality = validateMasterclassPayload(normalized);
        return Response.json({
          success: true,
          data: {
            analysis: normalized.analysis_output || null,
            blocks: mappedBlocks,
            chapters: normalized.chapters || [],
            pedagogy: normalized.chapters || [],
            slides: normalized.smartboard_blocks || [],
            scripts: normalized.dictation_je_retiens || [],
            exports: buildExportsPayload({
              chapters: normalized.chapters || [],
              slides: normalized.smartboard_blocks || [],
              tests: normalized.tests || [],
              exercises: normalized.exercises || [],
              transitions: normalized.transitions || [],
            }),
            quality,
          },
        });
      }
    }

    // Fallback robuste si clé absente ou sortie LLM invalide.
    const fallback = await runMasterclassPipeline(rawText);
    const quality = validateMasterclassPayload({
      analysis_output: fallback.analysis,
      blocks: fallback.blocks,
      chapters: fallback.chapters,
    });
    return Response.json({
      success: true,
      data: {
        analysis: fallback.analysis,
        blocks: fallback.blocks,
        chapters: fallback.chapters,
        pedagogy: fallback.chapters,
        slides: fallback.slides,
        scripts: fallback.scripts,
        exports: buildExportsPayload({
          chapters: fallback.chapters,
          slides: fallback.slides,
          tests: [],
          exercises: [],
          transitions: [],
        }),
        quality,
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur interne du moteur',
      },
      { status: 500 },
    );
  }
}
