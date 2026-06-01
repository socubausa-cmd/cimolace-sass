/// <reference lib="deno.ns" />
/**
 * longia-live-realtime — Orchestration légère live (transcription / chat / audience).
 * Pas d’appel LLM : heuristiques pour signaux + notifications structurées.
 *
 * POST {
 *   transcriptPartial?, transcriptFinal?, transcriptChunk? (legacy = final),
 *   chatEvents?, audienceMetrics?, roomContext?
 * }
 * Authorization: Bearer <user jwt>
 */
import { corsHeaders } from '../_shared/cors.ts';
import { analyzeTranscript } from '../_shared/longiaLiveRealtime/analyzeTranscript.ts';
import { analyzeTranscriptPartial } from '../_shared/longiaLiveRealtime/analyzeTranscriptPartial.ts';
import { normalizeTranscriptEcho } from '../_shared/longiaLiveRealtime/normalizeTranscript.ts';
import { analyzeChat } from '../_shared/longiaLiveRealtime/analyzeChat.ts';
import { analyzeAudience } from '../_shared/longiaLiveRealtime/analyzeAudience.ts';
import { buildNotifications } from '../_shared/longiaLiveRealtime/buildNotifications.ts';
import { secureAppShareWatcher } from '../_shared/longiaLiveRealtime/secureAppShareWatcher.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  // @ts-ignore Deno
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  // @ts-ignore Deno
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return json(401, { error: 'Missing Authorization' });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) {
    return json(401, { error: 'Invalid token' });
  }

  let body: {
    transcriptChunk?: { text?: string; startMs?: number; endMs?: number; language?: string; confidence?: number; speakerId?: string };
    transcriptPartial?: { text?: string; startMs?: number; endMs?: number; language?: string; speakerId?: string };
    transcriptFinal?: { text?: string; startMs?: number; endMs?: number; language?: string; confidence?: number; speakerId?: string };
    chatEvents?: Array<{ message?: string; authorId?: string; timestampMs?: number }>;
    audienceMetrics?: Array<{ engagementScore?: number; viewerCount?: number; timestampMs?: number }>;
    secureAppStatus?: {
      appName?: string;
      isVisible?: boolean;
      locked?: boolean;
      status?: 'active' | 'paused' | 'stopped' | string;
    };
    secureAppConfig?: {
      enabled?: boolean;
      mode?: 'process_capture' | 'window_capture' | string;
      security?: {
        lockSource?: boolean;
        hideNotifications?: boolean;
        pauseIfMissing?: boolean;
      };
    };
    roomContext?: Record<string, unknown>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const roomContext = body.roomContext && typeof body.roomContext === 'object' ? body.roomContext : {};
  const transcriptChunk = body.transcriptChunk;
  const transcriptPartial = body.transcriptPartial;
  const transcriptFinal = body.transcriptFinal;
  const chatEvents = Array.isArray(body.chatEvents) ? body.chatEvents : [];
  const audienceMetrics = Array.isArray(body.audienceMetrics) ? body.audienceMetrics : [];
  const secureAppStatus = body.secureAppStatus;
  const secureAppConfig = body.secureAppConfig;

  type Tier = 'partial' | 'final' | null;
  let transcriptTier: Tier = null;
  let transcriptEvent: Record<string, unknown> | null = null;

  const finalWire = transcriptFinal?.text
    ? transcriptFinal
    : transcriptChunk?.text
      ? transcriptChunk
      : null;
  const partialWire = transcriptPartial?.text && !finalWire ? transcriptPartial : null;

  let transcriptSignals: Array<Record<string, unknown>> = [];
  if (finalWire?.text) {
    transcriptTier = 'final';
    transcriptEvent = normalizeTranscriptEcho('transcript.final', finalWire, roomContext);
    transcriptSignals = analyzeTranscript(
      {
        text: String(finalWire.text),
        startMs: finalWire.startMs,
        endMs: finalWire.endMs,
      },
      roomContext,
    );
  } else if (partialWire?.text) {
    transcriptTier = 'partial';
    transcriptEvent = normalizeTranscriptEcho('transcript.partial', partialWire, roomContext);
    transcriptSignals = analyzeTranscriptPartial(
      {
        text: String(partialWire.text),
        startMs: partialWire.startMs,
        endMs: partialWire.endMs,
      },
      roomContext,
    );
  }

  const chatSignals = analyzeChat(
    chatEvents.map((e) => ({
      message: String(e.message || ''),
      authorId: e.authorId,
      timestampMs: e.timestampMs,
    })),
    roomContext,
  );

  const audienceSignals = analyzeAudience(
    audienceMetrics
      .filter((m) => typeof m.engagementScore === 'number')
      .map((m) => ({
        engagementScore: Number(m.engagementScore),
        viewerCount: m.viewerCount,
        timestampMs: m.timestampMs,
      })),
    roomContext,
  );

  const secureAppSignals: Array<Record<string, unknown>> = [];
  if (secureAppStatus && typeof secureAppStatus === 'object') {
    const watcher = secureAppShareWatcher(secureAppStatus, secureAppConfig);
    if (watcher.shouldPause) {
      secureAppSignals.push({
        type: 'system',
        code: watcher.code || 'secure_app_pause_required',
        title: 'Secure App Share — action requise',
        message:
          watcher.notification ||
          'Le partage sécurisé de l’application requiert une pause de diffusion.',
        tier: 'final',
        strength: 'normal',
        secureApp: {
          status: watcher.status,
          shouldPause: watcher.shouldPause,
          details: watcher.details,
        },
      });
    }
  }

  const notifications = buildNotifications({
    transcriptSignals,
    chatSignals,
    audienceSignals,
    secureAppSignals,
    roomContext,
  });

  return json(200, {
    ok: true,
    transcriptTier,
    transcriptEvent,
    notifications,
    transcriptSignals,
    chatSignals,
    audienceSignals,
    secureAppSignals,
  });
});
