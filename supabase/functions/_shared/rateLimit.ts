/// <reference lib="deno.ns" />
/**
 * Rate Limiting Helper for Supabase Edge Functions (REQ-SEC-003)
 * Mirrors netlify/functions/_lib/rateLimit.js for API consistency.
 */

import { createSupabaseAdmin } from './requireUser.ts';

export function getClientIP(req: Request): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') || // Cloudflare
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

export async function checkRateLimit(opts: {
  key: string;
  endpoint: string;
  limit: number;
  windowSecs?: number;
}): Promise<boolean> {
  const { key, endpoint, limit, windowSecs = 60 } = opts;
  try {
    const admin = createSupabaseAdmin();
    if (!admin) return true; // fail-open on config error
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_key: key,
      p_endpoint: endpoint,
      p_max_count: limit,
      p_window_secs: windowSecs,
    });
    if (error) {
      console.warn('[rateLimit] RPC error, failing open:', error.message);
      return true;
    }
    return Boolean(data);
  } catch (err) {
    console.warn('[rateLimit] Unexpected error, failing open:', String(err));
    return true;
  }
}

export function rateLimitedResponse(windowSecs = 60): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests', retryAfter: windowSecs }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(windowSecs),
      },
    }
  );
}

/**
 * Wrap an Edge Function handler with IP-based rate limiting.
 *
 * Usage:
 *   Deno.serve(withRateLimit(
 *     async (req) => { ... },
 *     { limit: 5, windowSecs: 300 }
 *   ));
 */
export function withRateLimit(
  handler: (req: Request) => Promise<Response>,
  config: { limit: number; windowSecs?: number; endpoint?: string }
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return handler(req); // skip preflight

    const ip = getClientIP(req);
    const url = new URL(req.url);
    const endpoint = config.endpoint ?? `${req.method} ${url.pathname}`;

    const allowed = await checkRateLimit({
      key: `ip:${ip}`,
      endpoint,
      limit: config.limit,
      windowSecs: config.windowSecs ?? 60,
    });

    if (!allowed) return rateLimitedResponse(config.windowSecs ?? 60);
    return handler(req);
  };
}

// Pre-configured wrappers
export const withAuthRateLimit = (h: (req: Request) => Promise<Response>) =>
  withRateLimit(h, { limit: 5, windowSecs: 300 });

export const withAIRateLimit = (h: (req: Request) => Promise<Response>) =>
  withRateLimit(h, { limit: 30, windowSecs: 60 });
