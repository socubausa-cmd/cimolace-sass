import type {
  RunMasterclassFactoryInput,
  RunMasterclassFactoryOutput,
} from './types';

export async function runMasterclassFactory(
  rawText: string,
  signal?: AbortSignal,
): Promise<RunMasterclassFactoryOutput['data']> {
  const payload: RunMasterclassFactoryInput = { rawText };
  const response = await fetch('/api/liri/masterclass-factory/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  const json = (await response.json().catch(() => null)) as RunMasterclassFactoryOutput | null;
  if (!response.ok || !json?.success) {
    throw new Error((json as any)?.error || 'Masterclass engine: erreur serveur');
  }
  return json.data;
}
