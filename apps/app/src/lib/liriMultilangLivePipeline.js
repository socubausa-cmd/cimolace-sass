/**
 * Pipeline live : transcript hôte → translate-transcript (Edge) → bus LONGIA (sous-titres invités).
 */
import { broadcastRealtime } from '@/lib/realtimeBroadcast';
import { BUS_EVENTS, wrapLongiaBusPayload } from '@/lib/longiaRealtimeBus';

/** Cache in-memory (session) : évite de re-traduire le même texte × langue. */
const _translationCache = new Map();
const CACHE_MAX = 60;

function _cacheGet(text, lang) {
  return _translationCache.get(`${lang}:${text}`);
}

function _cacheSet(text, lang, value) {
  const key = `${lang}:${text}`;
  if (_translationCache.has(key)) {
    _translationCache.delete(key);
  } else if (_translationCache.size >= CACHE_MAX) {
    _translationCache.delete(_translationCache.keys().next().value);
  }
  _translationCache.set(key, value);
}

export function clearLiriTranslationCache() {
  _translationCache.clear();
}

/**
 * @param {object} p
 * @param {import('@supabase/supabase-js').SupabaseClient} p.supabase
 * @param {import('@supabase/realtime-js').RealtimeChannel | null} p.channel
 * @param {string} p.busEvent — ex. LONGIA_BUS_BROADCAST_EVENT
 * @param {{ text: string, isFinal?: boolean }} p.chunk
 * @param {string} p.sourceLang
 * @param {string[]} p.targetLangs
 * @param {number} [p.partialDebounceMs=3000]
 * @param {{ current: number }} p.lastPartialAtRef
 * @param {(lang: string, err: string) => void} [p.onError] — appelé uniquement sur chunks finals, en cas d'échec API
 * @param {string} [p.liveSessionId] — persiste les finals en base si fourni
 * @param {string} [p.userId] — requis avec liveSessionId pour RLS
 */
export async function runLiriMultilangCaptionPipeline({
  supabase,
  channel,
  busEvent,
  chunk,
  sourceLang,
  targetLangs,
  partialDebounceMs = 3000,
  lastPartialAtRef,
  onError,
  liveSessionId,
  userId,
}) {
  if (!channel || !busEvent || !chunk?.text || !targetLangs?.length) return;

  const text = String(chunk.text).trim();
  if (text.length < 4) return;

  if (!chunk.isFinal) {
    const now = Date.now();
    if (lastPartialAtRef?.current && now - lastPartialAtRef.current < partialDebounceMs) return;
    if (lastPartialAtRef) lastPartialAtRef.current = now;
  }

  const translateLine = async (targetLang) => {
    const cached = _cacheGet(text, targetLang);
    if (cached !== undefined) return cached;
    const { data, error } = await supabase.functions.invoke('translate-transcript', {
      body: { transcript: [{ text }], targetLang: targetLang },
    });
    if (error) return null;
    if (data?.error) return null;
    const lines = data?.transcript;
    const out = Array.isArray(lines) && lines[0]?.text != null ? String(lines[0].text).trim() : '';
    const result = out || null;
    if (result) _cacheSet(text, targetLang, result);
    return result;
  };

  for (const lang of targetLangs) {
    const lt = String(lang).toLowerCase().slice(0, 12);
    if (!lt) continue;
    try {
      const translated = await translateLine(lt);
      if (!translated) {
        if (chunk.isFinal) onError?.(lt, 'Traduction vide');
        continue;
      }
      void broadcastRealtime(
        channel,
        busEvent,
        wrapLongiaBusPayload(BUS_EVENTS.MULTILANG_CAPTION, {
          targetLang: lt,
          text: translated,
          isFinal: chunk.isFinal === true,
          sourceLang: String(sourceLang || 'fr').slice(0, 12),
        }),
      );
      if (chunk.isFinal && liveSessionId && userId) {
        void supabase.from('liri_multilang_live_captions').insert({
          live_session_id: String(liveSessionId),
          inserted_by: String(userId),
          source_lang: String(sourceLang || 'fr').slice(0, 12),
          target_lang: lt,
          source_text: text,
          translated_text: translated,
        });
      }
    } catch (e) {
      if (chunk.isFinal) onError?.(lt, e?.message || String(e));
    }
  }
}
