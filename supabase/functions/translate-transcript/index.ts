/// <reference lib="deno.ns" />

import { corsHeaders } from '../_shared/cors.ts';

type TranscriptLine = { timeSeconds?: number; time?: string; text: string };

type TranslateRequest = {
  transcript: TranscriptLine[];
  targetLang: string;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const safeLang = (value: unknown): string => {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return 'en';
  if (s.length > 12) return 'en';
  return s;
};

const normalizeTranscript = (arr: unknown): TranscriptLine[] => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((l) => {
      if (!isObject(l)) return null;
      const text = String(l.text ?? '').trim();
      if (!text) return null;
      const timeSecondsRaw = l.timeSeconds;
      const timeSeconds = typeof timeSecondsRaw === 'number' && Number.isFinite(timeSecondsRaw) ? timeSecondsRaw : undefined;
      const time = l.time != null ? String(l.time).trim() : undefined;
      return { timeSeconds, time, text } as TranscriptLine;
    })
    .filter((x): x is TranscriptLine => !!x);
};

const buildPrompt = (lines: TranscriptLine[], targetLang: string): string => {
  const payload = lines.map((l) => ({ timeSeconds: l.timeSeconds ?? null, time: l.time ?? null, text: l.text }));
  return `You are a professional translator for educational transcripts.\n\nTranslate the following transcript lines to language: ${targetLang}.\n\nRules:\n- Keep the JSON structure EXACTLY.\n- Do not add or remove items.\n- Keep timeSeconds/time unchanged.\n- Only translate the text field.\n- Output MUST be valid JSON, nothing else.\n\nInput JSON:\n${JSON.stringify(payload)}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => null)) as TranslateRequest | null;
    const transcript = normalizeTranscript(body?.transcript);
    const targetLang = safeLang(body?.targetLang);

    if (!transcript.length) {
      return new Response(JSON.stringify({ transcript: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing DEEPSEEK_API_KEY secret' }), {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    // Avoid oversize payloads
    const slim = transcript.slice(0, 400);

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You translate text. You only output valid JSON.' },
          { role: 'user', content: buildPrompt(slim, targetLang) },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return new Response(JSON.stringify({
        error: `DeepSeek error (${resp.status}): ${text.slice(0, 800)}`,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const json = await resp.json().catch(() => null);
    const content = json?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid DeepSeek response' }), {
        status: 502,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error('Translation output is not an array');

    const translated = parsed
      .map((l: any, idx: number) => {
        const orig = slim[idx];
        const text = String(l?.text ?? '').trim();
        if (!text) return null;
        return {
          timeSeconds: orig?.timeSeconds,
          time: orig?.time,
          text,
        } as TranscriptLine;
      })
      .filter((x: TranscriptLine | null): x is TranscriptLine => !!x);

    return new Response(JSON.stringify({ transcript: translated }), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
