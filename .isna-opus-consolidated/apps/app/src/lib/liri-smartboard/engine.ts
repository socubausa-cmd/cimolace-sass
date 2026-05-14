import type { GenerateSlideInput, GenerateSlideOutput } from '@/lib/liri-smartboard/types';

export async function generateSmartboardSlide(input: GenerateSlideInput, signal?: AbortSignal): Promise<GenerateSlideOutput> {
  const res = await fetch('/api/liri/smartboard/generate-slide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !data?.slide) {
    throw new Error(data?.error || 'Génération slide impossible');
  }
  return data as GenerateSlideOutput;
}

