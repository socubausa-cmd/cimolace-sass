/**
 * TTS LIRI — chaîne fournisseurs :
 * - Live (bas latence) : ElevenLabs Flash v2.5
 * - Export / replay premium : ElevenLabs Multilingual v2
 * - Fallback : Google Cloud Text-to-Speech (clé API)
 */

export const ELEVENLABS_MODEL_LIVE = 'eleven_flash_v2_5';
export const ELEVENLABS_MODEL_EXPORT = 'eleven_multilingual_v2';

const ELEVEN_TTS_URL = (voiceId: string) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;

/** Langue courte (ex. fr) → BCP-47 pour Google Neural2 */
export function langToGoogleVoice(languageCode: string): { languageCode: string; name: string } {
  const c = String(languageCode || 'en').toLowerCase().slice(0, 5).split(/[-_]/)[0] || 'en';
  const map: Record<string, { languageCode: string; name: string }> = {
    fr: { languageCode: 'fr-FR', name: 'fr-FR-Neural2-A' },
    en: { languageCode: 'en-US', name: 'en-US-Neural2-F' },
    es: { languageCode: 'es-ES', name: 'es-ES-Neural2-A' },
    de: { languageCode: 'de-DE', name: 'de-DE-Neural2-A' },
    it: { languageCode: 'it-IT', name: 'it-IT-Neural2-A' },
    pt: { languageCode: 'pt-BR', name: 'pt-BR-Neural2-A' },
    nl: { languageCode: 'nl-NL', name: 'nl-NL-Wavenet-A' },
    pl: { languageCode: 'pl-PL', name: 'pl-PL-Wavenet-A' },
    ja: { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' },
    ko: { languageCode: 'ko-KR', name: 'ko-KR-Neural2-C' },
    zh: { languageCode: 'cmn-CN', name: 'cmn-CN-Wavenet-A' },
    ru: { languageCode: 'ru-RU', name: 'ru-RU-Wavenet-A' },
    ar: { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-B' },
  };
  return map[c] || map.en;
}

export async function elevenLabsSynthesize(
  apiKey: string,
  voiceId: string,
  text: string,
  modelId: string,
  languageHint?: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const body: Record<string, unknown> = {
    text,
    model_id: modelId,
  };
  /** Flash v2.5 accepte `language_code` ; Multilingual v2 gère la langue autrement. */
  if (languageHint && /flash/i.test(modelId)) {
    body.language_code = String(languageHint).toLowerCase().slice(0, 5).split(/[-_]/)[0];
  }
  const res = await fetch(ELEVEN_TTS_URL(voiceId), {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      accept: 'audio/mpeg',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${errText.slice(0, 400)}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  return { bytes: buf, mimeType: 'audio/mpeg' };
}

export async function googleCloudSynthesize(
  apiKey: string,
  text: string,
  languageCode: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const voice = langToGoogleVoice(languageCode);
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: voice.languageCode, name: voice.name },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google TTS ${res.status}: ${errText.slice(0, 400)}`);
  }
  const json = (await res.json()) as { audioContent?: string };
  const b64 = json?.audioContent;
  if (!b64 || typeof b64 !== 'string') {
    throw new Error('Google TTS: missing audioContent');
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, mimeType: 'audio/mpeg' };
}

export type TtsTier = 'live' | 'export';

export async function synthesizeWithFallback(
  text: string,
  tier: TtsTier,
  languageCode: string,
  env: {
    elevenKey: string | undefined;
    elevenVoiceId: string | undefined;
    googleKey: string | undefined;
  },
): Promise<{ bytes: Uint8Array; mimeType: string; provider: 'elevenlabs' | 'google' }> {
  const modelId = tier === 'export' ? ELEVENLABS_MODEL_EXPORT : ELEVENLABS_MODEL_LIVE;
  const voiceId = (env.elevenVoiceId || '21m00Tcm4TlvDq8ikWAM').trim();

  // Permet de forcer Google en premier (utile si Eleven Free Tier est bloqué)
  // @ts-ignore Deno runtime
  const primary = (Deno.env.get('TTS_PRIMARY_PROVIDER') || 'elevenlabs').toLowerCase();

  if (primary === 'google' && env.googleKey) {
    try {
      const r = await googleCloudSynthesize(env.googleKey, text, languageCode);
      return { ...r, provider: 'google' };
    } catch (e) {
      if (!env.elevenKey) throw e;
      console.warn('[liri-tts] Google failed, falling back to ElevenLabs:', (e as Error)?.message);
    }
  }

  if (env.elevenKey) {
    try {
      const r = await elevenLabsSynthesize(
        env.elevenKey,
        voiceId,
        text,
        modelId,
        languageCode,
      );
      return { ...r, provider: 'elevenlabs' };
    } catch (e) {
      if (!env.googleKey) throw e;
      console.warn('[liri-tts] ElevenLabs failed, falling back to Google:', (e as Error)?.message);
    }
  }

  if (!env.googleKey) {
    throw new Error('No TTS provider configured (ELEVENLABS_API_KEY and/or GOOGLE_CLOUD_TTS_API_KEY)');
  }
  const r = await googleCloudSynthesize(env.googleKey, text, languageCode);
  return { ...r, provider: 'google' };
}
