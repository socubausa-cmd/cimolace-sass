/**
 * Route HTTP — LIRI Brain (streaming SSE).
 *
 * À exposer via votre plateforme (Netlify Functions, Vercel, Cloudflare Workers, serveur Node…).
 * Ce dépôt utilise Vite : ajoutez un proxy dev vers ce handler ou déployez cette fonction côté serveur.
 *
 * POST JSON : BrainRouteInput (`message`, `sessionId`, `liveId?`, `userId?`, `mode?`, `context?`, `memory?`)
 * Réponse : `text/event-stream` — événements `{ type: 'token', text }` puis `{ type: 'done', structured }`.
 */

import { createBrainResponseStream } from '@/lib/liri-brain';
import type { BrainRouteInput } from '@/lib/liri-brain/types';

function getOpenAiKey(): string | null {
  try {
    const fromProcess =
      typeof process !== 'undefined' && process.env?.OPENAI_API_KEY
        ? String(process.env.OPENAI_API_KEY).trim()
        : '';
    return fromProcess || null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY non configuré côté serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: Partial<BrainRouteInput>;
  try {
    body = (await request.json()) as Partial<BrainRouteInput>;
  } catch {
    return new Response(JSON.stringify({ error: 'Corps JSON invalide' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const message = String(body.message ?? '').trim();
  const sessionId = String(body.sessionId ?? '').trim();
  if (!message || !sessionId) {
    return new Response(JSON.stringify({ error: 'message et sessionId requis' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const input: BrainRouteInput = {
    message,
    sessionId,
    liveId: body.liveId ?? null,
    userId: body.userId ?? null,
    mode: body.mode ?? 'auto',
    context: body.context,
    memory: body.memory,
    stream: body.stream !== false,
  };

  try {
    const stream = await createBrainResponseStream(input, apiKey);
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
