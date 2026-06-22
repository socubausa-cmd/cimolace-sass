/// <reference lib="deno.ns" />
/**
 * platform-ai-keys — gestion no-code des clés API IA (back-office Cimolace owner).
 *
 * Pose / teste / supprime les SECRETS Supabase des fournisseurs IA via l'API
 * Management Supabase. Les fonctions IA continuent de lire `Deno.env` sans
 * changement. Réservé aux opérateurs Cimolace (table cimolace_staff_members).
 *
 * Actions (POST { action, ... }) :
 *  - list                       → état de chaque fournisseur (set/digest) + modèles
 *  - test  { provider, value }  → sonde le fournisseur en direct avec la valeur fournie
 *  - set   { name, value }      → pose le secret (clé fournisseur ou modèle)
 *  - delete{ name }             → supprime le secret
 */
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const PROVIDERS: Record<string, { secret: string; label: string }> = {
  deepseek: { secret: 'DEEPSEEK_API_KEY', label: 'DeepSeek' },
  mistral: { secret: 'MISTRAL_API_KEY', label: 'Mistral' },
  anthropic: { secret: 'ANTHROPIC_API_KEY', label: 'Claude (Anthropic)' },
  openai: { secret: 'OPENAI_API_KEY', label: 'OpenAI' },
  xai: { secret: 'XAI_API_KEY', label: 'Grok (xAI)' },
  gemini: { secret: 'GEMINI_API_KEY', label: 'Gemini (Google)' },
};
// Secrets de modèle optionnels gérables depuis l'UI.
const MODEL_SECRETS = [
  'DEEPSEEK_HEAVY_MODEL',
  'DEEPSEEK_FAST_MODEL',
  'MISTRAL_VISION_MODEL',
  'SMARTBOARD_CLAUDE_MODEL',
];
const ALLOWED_SECRETS = new Set<string>([
  ...Object.values(PROVIDERS).map((p) => p.secret),
  ...MODEL_SECRETS,
]);

const MGMT = 'https://api.supabase.com';

/** Sonde un fournisseur avec une clé donnée → { ok, status, error }. */
async function probeProvider(provider: string, value: string): Promise<Record<string, unknown>> {
  const key = String(value || '').trim();
  if (!key) return { ok: false, error: 'Clé vide' };
  try {
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 5, messages: [{ role: 'user', content: 'ping' }] }),
      });
      const t = await res.text();
      return { ok: res.ok, status: res.status, error: res.ok ? null : t.slice(0, 260) };
    }
    if (provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
      const t = await res.text();
      return { ok: res.ok, status: res.status, error: res.ok ? null : t.slice(0, 260) };
    }
    const base =
      provider === 'deepseek'
        ? 'https://api.deepseek.com'
        : provider === 'mistral'
          ? 'https://api.mistral.ai/v1'
          : provider === 'xai'
            ? 'https://api.x.ai/v1'
            : 'https://api.openai.com/v1';
    const model =
      provider === 'deepseek'
        ? 'deepseek-chat'
        : provider === 'mistral'
          ? 'mistral-medium-latest'
          : provider === 'xai'
            ? 'grok-3-mini'
            : 'gpt-4o-mini';
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
    });
    const t = await res.text();
    return { ok: res.ok, status: res.status, error: res.ok ? null : t.slice(0, 260) };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // @ts-ignore Deno
  const env = (k: string) => String(Deno.env.get(k) || '').trim();
  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Missing Authorization' });

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return json(401, { error: 'Invalid token' });

  // ─── Garde opérateur Cimolace (miroir de is_cimolace_staff()) ─────────
  let isStaff =
    user.app_metadata?.cimolace_staff === true ||
    user.user_metadata?.cimolace_staff === true ||
    String(user.email || '').toLowerCase() === 'cimolace@gmail.com';
  if (!isStaff) {
    const { data: staff } = await admin
      .from('cimolace_staff_members')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (staff?.status === 'active') isStaff = true;
  }
  if (!isStaff) {
    const { data: profile } = await admin
      .from('profiles')
      .select('status, metadata')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.status === 'active' && String(profile?.metadata?.cimolace_staff) === 'true') isStaff = true;
  }
  if (!isStaff) return json(403, { error: 'Réservé aux opérateurs Cimolace' });

  let body: { action?: string; provider?: string; name?: string; value?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const action = String(body?.action || '');
  const ref = env('SUPABASE_PROJECT_REF') || (supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\./)?.[1] ?? '');
  const mgmt = env('SUPABASE_MGMT_TOKEN');

  const mgmtFetch = (method: string, payload?: unknown) =>
    fetch(`${MGMT}/v1/projects/${ref}/secrets`, {
      method,
      headers: { Authorization: `Bearer ${mgmt}`, 'Content-Type': 'application/json' },
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    });

  // ─── TEST (ne nécessite pas le token Management) ──────────────────────
  if (action === 'test') {
    if (!body.provider || !(body.provider in PROVIDERS)) return json(400, { error: 'Fournisseur inconnu' });
    const result = await probeProvider(body.provider, String(body.value || ''));
    return json(200, result);
  }

  // ─── LIST ─────────────────────────────────────────────────────────────
  if (action === 'list') {
    const providersBase = Object.entries(PROVIDERS).map(([key, v]) => ({ key, label: v.label, secret: v.secret }));
    if (!mgmt) {
      return json(200, {
        mgmtConfigured: false,
        providers: providersBase.map((p) => ({ ...p, set: false, digest: null })),
        models: MODEL_SECRETS.map((name) => ({ name, set: false, value: null })),
      });
    }
    const r = await mgmtFetch('GET');
    if (!r.ok) {
      const t = await r.text();
      return json(502, { error: `Management API ${r.status}: ${t.slice(0, 200)}`, mgmtConfigured: true });
    }
    const secrets = (await r.json()) as Array<{ name: string; value?: string }>;
    const byName = new Map(secrets.map((s) => [s.name, s.value ?? null]));
    return json(200, {
      mgmtConfigured: true,
      providers: providersBase.map((p) => ({ ...p, set: byName.has(p.secret), digest: byName.get(p.secret) || null })),
      models: MODEL_SECRETS.map((name) => ({ name, set: byName.has(name), value: byName.get(name) || null })),
    });
  }

  // ─── SET ────────────────────────────────────────────────────────────────
  if (action === 'set') {
    if (!mgmt) return json(400, { error: 'SUPABASE_MGMT_TOKEN non configuré (bootstrap requis).' });
    const name = String(body.name || '');
    const value = String(body.value || '');
    if (!ALLOWED_SECRETS.has(name)) return json(400, { error: 'Secret non autorisé' });
    if (!value.trim()) return json(400, { error: 'Valeur vide' });
    const r = await mgmtFetch('POST', [{ name, value }]);
    if (!r.ok) {
      const t = await r.text();
      return json(502, { error: `Management API ${r.status}: ${t.slice(0, 200)}` });
    }
    return json(200, { ok: true, name });
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────
  if (action === 'delete') {
    if (!mgmt) return json(400, { error: 'SUPABASE_MGMT_TOKEN non configuré (bootstrap requis).' });
    const name = String(body.name || '');
    if (!ALLOWED_SECRETS.has(name)) return json(400, { error: 'Secret non autorisé' });
    const r = await mgmtFetch('DELETE', [name]);
    if (!r.ok) {
      const t = await r.text();
      return json(502, { error: `Management API ${r.status}: ${t.slice(0, 200)}` });
    }
    return json(200, { ok: true, name });
  }

  return json(400, { error: 'Action inconnue' });
});
