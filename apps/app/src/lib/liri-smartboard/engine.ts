import { supabase } from '@/lib/customSupabaseClient';
import type { GenerateSlideInput, GenerateSlideOutput, SmartboardSlide } from '@/lib/liri-smartboard/types';

const uuid = () => {
  try {
    // @ts-expect-error crypto peut être absent selon l'environnement
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* noop */ }
  return `sb-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

/**
 * Génère UNE slide de smartboard pédagogique.
 *
 * L'ancien appel `fetch('/api/liri/smartboard/generate-slide')` visait une route inexistante
 * (le contrôleur NestJS est `POST /smartboard/generate` = deck entier ; le proxy `/api` est
 * dev-only) → 404 systématique. On invoque désormais l'edge Supabase DÉPLOYÉE
 * `generate-slide-content` (une carte → une slide) et on adapte ses champs au contrat
 * SmartboardSlide attendu par le store/renderer.
 */
export async function generateSmartboardSlide(input: GenerateSlideInput, _signal?: AbortSignal): Promise<GenerateSlideOutput> {
  const ch = input?.chapter || ({} as GenerateSlideInput['chapter']);
  const card = {
    label: [ch?.title, input?.step].filter(Boolean).join(' — ') || 'Carte',
    summary: ch?.objective || ch?.knowledge || String(input?.sourceText || '').slice(0, 600),
  };

  const { data, error } = await supabase.functions.invoke('generate-slide-content', {
    body: { card, courseTitle: ch?.title || 'Cours', transcript: String(input?.sourceText || '').slice(0, 1500) },
  });
  if (error) throw new Error(error.message || 'Génération slide impossible');
  const raw = (data as { slide?: Record<string, unknown>; error?: string } | null)?.slide;
  if (!raw) throw new Error((data as { error?: string } | null)?.error || 'Génération slide impossible');

  const branches = Array.isArray(raw.branches) ? (raw.branches as Array<Record<string, unknown>>) : [];
  const branchesText = branches
    .map((b) => [b?.label, b?.sub].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join(' · ');
  const imagePrompt = String(raw.imagePrompt || '');

  const slide: SmartboardSlide = {
    slide_id: uuid(),
    chapter_id: ch?.chapter_id || '',
    step: input?.step || '',
    title: String(raw.title || card.label),
    pedagogical_goal: String(raw.objectif || ch?.objective || ''),
    dominant_mode: imagePrompt ? 'image_graphique' : 'texte',
    content: {
      main_text: String(raw.ideeCentrale || raw.subtitle || raw.title || ''),
      support_text: [branchesText, raw.aRetenir ? `À retenir : ${String(raw.aRetenir)}` : '']
        .filter(Boolean)
        .join('\n'),
    },
    visual: { type: imagePrompt ? 'image' : 'none', prompt: imagePrompt },
    student_action: '',
    teacher_note: raw.niveau ? `Niveau : ${String(raw.niveau)}` : '',
    transition: '',
  };

  return { success: true, slide, quality: { valid: true, errors: [] } };
}
