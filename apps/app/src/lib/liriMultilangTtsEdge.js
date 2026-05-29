/**
 * TTS via Edge `liri-tts` (ElevenLabs Flash / Multilingual + fallback Google).
 */

let edgeQueue = [];
let edgeProcessing = false;

function playMp3FromBase64(audioBase64, mimeType) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !audioBase64) {
      resolve();
      return;
    }
    try {
      const bin = atob(String(audioBase64));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType || 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      a.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Audio playback failed'));
      };
      void a.play().catch((e) => {
        URL.revokeObjectURL(url);
        reject(e);
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function runEdgeQueue() {
  if (edgeProcessing || edgeQueue.length === 0) return;
  edgeProcessing = true;
  const job = edgeQueue.shift();
  try {
    const { data, error } = await job.supabase.functions.invoke('liri-tts', {
      body: {
        text: job.text,
        languageCode: job.languageCode,
        tier: job.tier || 'live',
      },
    });
    if (error) throw new Error(error.message || 'liri-tts');
    if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'liri-tts');
    if (!data?.audioBase64) throw new Error('No audio in response');
    await playMp3FromBase64(data.audioBase64, data.mimeType);
  } catch (e) {
    job.onError?.(e);
  } finally {
    edgeProcessing = false;
    void runEdgeQueue();
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ text: string; languageCode?: string; tier?: 'live'|'export'; onError?: (e: Error) => void }} opts
 */
export function enqueueMultilangEdgeTts(supabase, opts) {
  const text = String(opts.text || '').trim();
  if (text.length < 2 || !supabase) return;
  edgeQueue.push({
    supabase,
    text: text.slice(0, 4500),
    languageCode: String(opts.languageCode || 'en').slice(0, 12),
    tier: opts.tier === 'export' ? 'export' : 'live',
    onError: opts.onError,
  });
  if (edgeQueue.length > 10) edgeQueue = edgeQueue.slice(-10);
  void runEdgeQueue();
}

export function stopMultilangEdgeTts() {
  edgeQueue = [];
  edgeProcessing = false;
}

/**
 * Appel ponctuel (export studio, une ligne).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ text: string; languageCode?: string; tier?: 'live'|'export' }} opts
 */
export async function synthesizeMultilangTtsOnce(supabase, opts) {
  const text = String(opts.text || '').trim();
  if (!text || !supabase) return { error: new Error('text required') };
  const { data, error } = await supabase.functions.invoke('liri-tts', {
    body: {
      text: text.slice(0, 4500),
      languageCode: String(opts.languageCode || 'en').slice(0, 12),
      tier: opts.tier === 'export' ? 'export' : 'live',
    },
  });
  if (error) return { error: new Error(error.message) };
  if (data?.error) return { error: new Error(String(data.error)) };
  return { data };
}
