/**
 * callKonvaSceneImprove — appelle l'Edge Function liri-konva-scene-improve.
 * Retourne { objects, canvas, suggestions, provider } ou null en cas d'echec.
 *
 * @param {{
 *   objects: import('../model/sceneTypes').SbKonvaObjectBase[],
 *   canvas: { width: number, height: number, background: string },
 *   sceneName?: string,
 *   intent?: 'balance' | 'typography' | 'premium' | 'pedagogy'
 * }} params
 * @returns {Promise<{ objects: unknown[], canvas?: unknown, suggestions?: string[], provider: string } | null>}
 */
import { supabase } from '@/lib/customSupabaseClient';

export async function callKonvaSceneImprove({ objects, canvas, sceneName = 'Scene', intent = 'balance' }) {
  if (!objects?.length) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const { data, error } = await supabase.functions.invoke('liri-konva-scene-improve', {
    body: { objects, canvas, sceneName, intent },
    headers: token ? { Authorization: 'Bearer ' + token } : undefined,
  });

  if (error) {
    console.warn('[callKonvaSceneImprove] erreur edge function:', error?.message);
    return null;
  }

  if (!data || !Array.isArray(data.objects) || data.objects.length === 0) {
    console.warn('[callKonvaSceneImprove] reponse invalide:', data);
    return null;
  }

  return {
    objects: data.objects,
    canvas: data.canvas || null,
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    provider: data.provider || 'unknown',
  };
}
