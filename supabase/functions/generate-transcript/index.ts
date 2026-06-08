/// <reference lib="deno.ns" />

/**
 * generate-transcript — Whisper Groq sur média distant.
 *
 * C-3 (REQ-SEC-001) : verify_jwt = false dans config.toml ; on exige
 * désormais un user authentifié via requireUser() pour éviter qu'un
 * client anonyme ne consomme du quota Whisper Groq sur des URLs
 * arbitraires.
 */
import { corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/requireUser.ts';
import { resolveTenant, debitUsage } from '../_shared/aiBilling.ts';

type TranscriptLine = { timeSeconds: number; text: string };

type GroqVerboseSegment = {
  id?: number;
  start?: number;
  end?: number;
  text?: string;
};

type GroqVerboseJson = {
  text?: string;
  language?: string;
  duration?: number;
  segments?: GroqVerboseSegment[];
};

const mimeToExt = (contentTypeRaw: string): string => {
  const ct = String(contentTypeRaw || '').toLowerCase().split(';')[0].trim();
  if (ct.includes('audio/flac')) return 'flac';
  if (ct.includes('audio/mpeg')) return 'mp3';
  if (ct.includes('audio/mp3')) return 'mp3';
  if (ct.includes('audio/mp4')) return 'm4a';
  if (ct.includes('audio/x-m4a')) return 'm4a';
  if (ct.includes('audio/ogg')) return 'ogg';
  if (ct.includes('audio/opus')) return 'opus';
  if (ct.includes('audio/wav')) return 'wav';
  if (ct.includes('audio/webm')) return 'webm';
  if (ct.includes('video/mp4')) return 'mp4';
  if (ct.includes('video/webm')) return 'webm';
  if (ct.includes('video/ogg')) return 'ogg';
  return '';
};

const urlToExt = (url: string): string => {
  try {
    const u = new URL(url);
    const p = u.pathname.toLowerCase();
    const m = /\.([a-z0-9]+)$/.exec(p);
    if (!m) return '';
    const ext = m[1];
    const allowed = new Set(['flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'opus', 'wav', 'webm']);
    return allowed.has(ext) ? ext : '';
  } catch {
    return '';
  }
};

const formatSeconds = (seconds: number): string => {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
};

const round05 = (v: number) => Math.round(Number(v) * 2) / 2;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing GROQ_API_KEY secret' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const model = Deno.env.get('GROQ_WHISPER_MODEL') || 'whisper-large-v3';
    const body = await req.json().catch(() => ({}));

    const url = String(body?.url || '').trim();
    if (!url) throw new Error('Missing url');

    const language = String(body?.language || '').trim();
    const prompt = String(body?.prompt || '').trim();

    const mediaRes = await fetch(url);
    if (!mediaRes.ok) {
      const t = await mediaRes.text().catch(() => '');
      return new Response(JSON.stringify({ error: 'Failed to fetch media', status: mediaRes.status, details: t }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawContentType = mediaRes.headers.get('content-type') || 'application/octet-stream';
    const contentType = String(rawContentType).split(';')[0].trim();
    const arrBuf = await mediaRes.arrayBuffer();
    const fileSizeMB = arrBuf.byteLength / (1024 * 1024);
    if (fileSizeMB > 25) {
      return new Response(
        JSON.stringify({ error: `Fichier trop grand (${fileSizeMB.toFixed(1)} MB). Groq Whisper accepte max 25 MB. Utilise une vidéo plus courte (limite : 25 MB).` }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileBlob = new Blob([arrBuf], { type: contentType });

    const extFromMime = mimeToExt(contentType);
    const extFromUrl = urlToExt(url);
    const ext = extFromMime || extFromUrl || 'mp4';
    const filename = `media.${ext}`;

    const form = new FormData();
    form.append('file', fileBlob, filename);
    form.append('model', model);
    form.append('response_format', 'verbose_json');
    if (language) form.append('language', language);
    if (prompt) form.append('prompt', prompt);

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!groqRes.ok) {
      const txt = await groqRes.text().catch(() => '');
      let groqMsg = txt;
      try { const j = JSON.parse(txt); groqMsg = j?.error?.message || j?.error || txt; } catch { /* ignore */ }
      return new Response(JSON.stringify({ error: `Groq Whisper error (${groqRes.status}): ${groqMsg}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = (await groqRes.json()) as GroqVerboseJson;

    const segments = Array.isArray(data?.segments) ? data.segments : [];
    const lines: TranscriptLine[] = [];

    if (segments.length > 0) {
      for (const s of segments) {
        const start = Number(s?.start);
        const text = String(s?.text || '').trim();
        if (!text) continue;
        const timeSeconds = Number.isFinite(start) ? round05(Math.max(0, start)) : 0;
        lines.push({ timeSeconds, text });
      }
    } else {
      const full = String(data?.text || '').trim();
      if (full) lines.push({ timeSeconds: 0, text: full });
    }

    const out = lines
      .sort((a, b) => a.timeSeconds - b.timeSeconds)
      .slice(0, 400)
      .map((l) => ({
        timeSeconds: l.timeSeconds,
        time: formatSeconds(l.timeSeconds),
        text: l.text,
      }));

    // ─── LIRI Credits — débit par seconde audio transcrite ──────────────────
    const durationSec = Number(data?.duration ?? 0);
    let billingInfo: Record<string, unknown> | null = null;
    try {
      const billingBody = await req.clone().json().catch(() => ({}));
      const ctx = await resolveTenant(req, billingBody);
      if (ctx && durationSec > 0) {
        const debit = await debitUsage(ctx, {
          functionName: 'generate-transcript',
          provider: 'groq',
          model: 'whisper-large-v3',
          unitType: 'seconds',
          unitAmount: durationSec,
          metadata: { language: data?.language, lines: out.length },
        });
        billingInfo = {
          provider: 'groq',
          model: 'whisper-large-v3',
          seconds: durationSec,
          credits_charged: debit.charged,
          balance: debit.balance,
        };
      }
    } catch (_) { /* billing non bloquant */ }

    return new Response(JSON.stringify({
      transcript: out,
      language: data?.language || null,
      duration: data?.duration || null,
      _billing: billingInfo,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
