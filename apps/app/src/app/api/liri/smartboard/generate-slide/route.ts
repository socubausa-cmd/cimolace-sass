import { z } from 'zod';
import { openaiChatCompletionSync } from '@/lib/liri-brain/openai';
import { buildSmartboardSystemPrompt, buildSmartboardUserPrompt } from '@/lib/liri-smartboard/prompt';
import { validateSmartboardSlide } from '@/lib/liri-smartboard/quality';
import type { GenerateSlideInput } from '@/lib/liri-smartboard/types';

const inputSchema = z.object({
  sourceText: z.string().min(20).max(120000),
  chapter: z.object({
    chapter_id: z.string().min(1),
    title: z.string().min(1),
    objective: z.string().optional(),
    skill: z.string().optional(),
    knowledge: z.string().optional(),
    payload: z.record(z.any()).optional(),
  }),
  step: z.string().min(1),
  previousSlides: z.array(z.any()).default([]),
});

function tryParseJson(raw: string) {
  const text = String(raw || '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function getOpenAiKey(): string | null {
  try {
    const key = typeof process !== 'undefined' ? String(process.env?.OPENAI_API_KEY || '').trim() : '';
    return key || null;
  } catch {
    return null;
  }
}

function buildFallbackSlide(input: GenerateSlideInput) {
  return {
    slide_id: `${input.chapter.chapter_id}_${input.step}`,
    chapter_id: input.chapter.chapter_id,
    step: input.step,
    title: `${input.chapter.title} · ${input.step.replaceAll('_', ' ')}`,
    pedagogical_goal: input.chapter.objective || `Transmettre ${input.step}`,
    dominant_mode: 'texte',
    content: {
      main_text: input.chapter.knowledge || input.chapter.objective || input.sourceText.slice(0, 220),
      support_text: input.chapter.skill || '',
    },
    visual: {
      type: 'text_focus',
      prompt: `Slide pédagogique ${input.step} pour ${input.chapter.title}`,
    },
    student_action: 'Lire, reformuler, appliquer.',
    teacher_note: 'Adapter le rythme au niveau du groupe.',
    transition: 'Continuer vers l\'étape suivante.',
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: 'Payload invalide' }, { status: 400 });
    }
    const input = parsed.data as GenerateSlideInput;
    const apiKey = getOpenAiKey();
    let slide: any;

    if (apiKey) {
      const raw = await openaiChatCompletionSync({
        apiKey,
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 1800,
        messages: [
          { role: 'system', content: buildSmartboardSystemPrompt() },
          { role: 'user', content: buildSmartboardUserPrompt(input) },
        ],
      });
      slide = tryParseJson(raw);
    }

    if (!slide || typeof slide !== 'object') {
      slide = buildFallbackSlide(input);
    }

    const quality = validateSmartboardSlide(slide);
    return Response.json({ success: true, slide, quality });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur interne smartboard' },
      { status: 500 },
    );
  }
}

