/// <reference lib="deno.ns" />
/**
 * vnp — VibeNavigation Protocol (§ Cahier des Charges VNP). L'API conversationnelle d'un site VNP.
 *
 * Un site n'expose plus des pages : il expose une CONNAISSANCE STRUCTURÉE + un ORCHESTRATEUR + un
 * ACTION ENGINE. Cette edge sert les 3 opérations du protocole (routées par sous-chemin OU par `op`) :
 *   - POST /vnp/chat   { message, platformName, graph, history } → { reply, intent, nodeId, suggestions[], actions[] }
 *   - POST /vnp/action { action, platformName, payload }         → { ok, message, next }
 *   - POST /vnp/node   { graph, id }  (≈ GET /vnp/:resource)     → { node }
 *
 * Le GRAPHE (nœuds { id,title,summary,content,related,actions }) est fourni par le client (dérivé du
 * knowledge pack du tenant) → l'edge reste GÉNÉRIQUE. Cloison stricte : ne parle QUE de {platformName}.
 * Chaîne LLM éco : Groq → DeepSeek → OpenAI. Public (pré-signup). --no-verify-jwt.
 */
import { corsHeaders } from '../_shared/cors.ts';

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Intentions canoniques du VNP (§ doc).
const INTENTS = ['visiter', 'decouvrir', 'comprendre', 'comparer', 'acheter', 'reserver', 'telecharger', 'participer', 'contacter', 'rejoindre'];

async function callChat(message: string, platformName: string, graph: string, history: Array<{ role: string; content: string }>) {
  // @ts-ignore
  const groqKey = Deno.env.get('GROQ_API_KEY') || '';
  // @ts-ignore
  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY') || '';
  // @ts-ignore
  const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
  if (!groqKey && !deepseekKey && !openaiKey) return json({ error: 'Missing LLM API keys' }, 500);

  const system =
    `Tu es le GUIDE conversationnel de « ${platformName} » (protocole VibeNavigation). Le visiteur ne clique pas : ` +
    `il te parle. Tu réponds DANS le périmètre de ${platformName}, à partir du GRAPHE DE CONNAISSANCE ci-dessous, et ` +
    `tu ORIENTES vers la suite (sujets liés) et l'ACTION utile. Phrases courtes, français concret, sans markdown.\n\n` +
    `=== GRAPHE ${platformName} (nœuds : id, titre, résumé, contenu, [liés], [actions]) ===\n${graph || '(vide)'}\n=== FIN ===\n\n` +
    `RÈGLES :\n` +
    `- Identifie l'INTENTION du visiteur parmi : ${INTENTS.join(', ')}.\n` +
    `- Identifie le NŒUD le plus pertinent (son id) dans le graphe.\n` +
    `- Réponds à partir du contenu de ce nœud, puis propose 1 à 3 SUGGESTIONS de suite (ids de nœuds liés) et les ACTIONS disponibles du nœud.\n` +
    `- CLOISON : si on te parle d'une AUTRE plateforme, de « Cimolace », de créer un site/SaaS, REFUSE et recentre : « Ici on est sur ${platformName}. » (intent="contacter", onTopic=false).\n` +
    `- N'invente pas de faits (prix, dates). Si l'info manque, dis-le et propose de contacter.\n\n` +
    `Réponds en JSON STRICT : { "reply": "1 à 3 phrases", "intent": "<une des intentions>", "nodeId": "<id ou vide>", ` +
    `"suggestions": ["<id nœud>", ...], "actions": ["<action>", ...], "onTopic": true|false }.`;

  const messages = [{ role: 'system', content: system }, ...history.slice(-6), { role: 'user', content: message }];
  const call = async (url: string, key: string, model: string, timeoutMs = 22000): Promise<string | null> => {
    if (!key) return null;
    const abort = new AbortController();
    const t = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0.4, max_tokens: 380, response_format: { type: 'json_object' }, messages }),
        signal: abort.signal,
      });
      clearTimeout(t);
      if (!res.ok) return null;
      const data = await res.json();
      return String(data?.choices?.[0]?.message?.content || '').trim() || null;
    } catch (_) { clearTimeout(t); return null; }
  };

  const raw =
    (await call('https://api.groq.com/openai/v1/chat/completions', groqKey, 'llama-3.3-70b-versatile')) ||
    (await call('https://api.deepseek.com/chat/completions', deepseekKey, 'deepseek-chat', 32000)) ||
    (await call('https://api.openai.com/v1/chat/completions', openaiKey, 'gpt-4o-mini'));
  if (!raw) return json({ error: 'LLM unavailable' }, 503);

  let p: any = {};
  try { const m = raw.match(/\{[\s\S]*\}/); if (m) p = JSON.parse(m[0]); } catch (_) { /* défaut */ }
  const reply = String(p.reply || '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim() || `Restons sur ${platformName} — dites-m'en un peu plus ?`;
  const intent = INTENTS.includes(String(p.intent)) ? p.intent : 'decouvrir';
  const nodeId = typeof p.nodeId === 'string' ? p.nodeId.slice(0, 40) : '';
  const suggestions = Array.isArray(p.suggestions) ? p.suggestions.filter((s: unknown) => typeof s === 'string').slice(0, 3) : [];
  const actions = Array.isArray(p.actions) ? p.actions.filter((a: unknown) => INTENTS.includes(String(a))).slice(0, 4) : [];
  const onTopic = p.onTopic === false ? false : true;
  return json({ reply, intent, nodeId, suggestions, actions, onTopic });
}

// Livraison RÉELLE d'un lead : insertion server-side dans contact_requests avec la SERVICE ROLE
// (contourne la RLS — l'insert anon est refusé). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sont
// injectés automatiquement dans le runtime des edge functions.
async function insertContact(payload: any): Promise<boolean> {
  // @ts-ignore
  const url = Deno.env.get('SUPABASE_URL');
  // @ts-ignore
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return false;
  try {
    // contact_requests.tenant_id est NOT NULL → on résout l'UUID du tenant depuis son slug.
    const slug = String(payload?.slug || '').trim().toLowerCase();
    if (!slug) return false;
    const tr = await fetch(`${url}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=id`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!tr.ok) return false;
    const rows = await tr.json();
    const tenantId = rows && rows[0] && rows[0].id;
    if (!tenantId) return false;
    const res = await fetch(`${url}/rest/v1/contact_requests`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        tenant_id: tenantId,
        name: String(payload?.name || '').slice(0, 120),
        email: String(payload?.email || '').slice(0, 160),
        subject: String(payload?.subject || 'Contact').slice(0, 160),
        message: String(payload?.message || '').slice(0, 4000),
      }),
    });
    return res.ok;
  } catch (_) { return false; }
}

// ACTION ENGINE (§ doc « Exécuter les actions métier »). EXÉCUTE l'action : le contact est LIVRÉ
// (contact_requests) ; les actions transactionnelles renvoient la SUITE (next.kind) que le client route.
async function runAction(action: string, platformName: string, payload: any) {
  const a = String(action || '').toLowerCase();
  const name = payload?.name ? String(payload.name).slice(0, 80) : '';
  const label = payload?.label ? String(payload.label).slice(0, 120) : '';
  if (!INTENTS.includes(a)) return json({ ok: false, message: `Action inconnue : ${action}` }, 400);

  switch (a) {
    case 'contacter':
    case 'participer': {
      const email = String(payload?.email || '').trim();
      const message = String(payload?.message || '').trim();
      // 2e temps : coordonnées fournies → on LIVRE le message.
      if (email && message) {
        const ok = await insertContact({ ...payload, subject: payload?.subject || `Contact via l'assistant ${platformName}` });
        return json(ok
          ? { ok: true, message: `C'est envoyé${name ? `, ${name}` : ''} — l'équipe de ${platformName} vous recontacte très vite.` }
          : { ok: false, message: 'Envoi impossible pour le moment — réessayez.' }, ok ? 200 : 502);
      }
      // 1er temps : on demande le mini-formulaire.
      return json({ ok: true, message: `Laissez-nous un mot — ${platformName} vous répond vite.`,
        next: { kind: 'contact_form', fields: ['name', 'email', 'message'] } });
    }
    case 'reserver':
      return json({ ok: true, message: `Parfait — réservons votre créneau${label ? ` pour « ${label} »` : ''}.`,
        next: { kind: 'booking', target: label || 'Consultation privée' } });
    case 'acheter':
    case 'rejoindre':
      return json({ ok: true, message: `Excellent choix — on vous emmène vers ${label ? `« ${label} »` : 'l\'inscription'}.`,
        next: { kind: 'checkout', target: label || '' } });
    case 'telecharger':
      return json({ ok: true, message: `La ressource${label ? ` « ${label} »` : ''} arrive.`, next: { kind: 'download', target: label || '' } });
    case 'comparer':
      return json({ ok: true, message: `Comparons les forfaits de ${platformName} pour trouver celui qui vous correspond.`, next: { kind: 'compare', target: 'produits' } });
    default:
      return json({ ok: true, message: `On avance sur ${platformName}.`, next: { kind: 'navigate' } });
  }
}

// @ts-ignore
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const sub = (url.pathname.split('/vnp/')[1] || '').replace(/\/+$/, '').toLowerCase();
    const body = await req.json().catch(() => ({}));
    const op = String(body?.op || sub || 'chat').toLowerCase();
    const platformName = String(body?.platformName || 'cette plateforme').trim().slice(0, 80);

    if (op === 'chat') {
      const message = String(body?.message || '').trim();
      if (!message) return json({ error: 'message is required' }, 400);
      const graph = String(body?.graph || '').slice(0, 12000);
      const history = Array.isArray(body?.history) ? body.history : [];
      return await callChat(message, platformName, graph, history);
    }
    if (op === 'action') {
      return await runAction(String(body?.action || ''), platformName, body?.payload || {});
    }
    if (op === 'node') {
      const graph = body?.graph;
      const idWanted = String(body?.id || sub || '').toLowerCase();
      const nodes = graph && typeof graph === 'object' ? (graph.nodes || graph) : null;
      const n = nodes && idWanted ? nodes[idWanted] : null;
      if (!n) return json({ error: `node ${idWanted} not found` }, 404);
      return json({ node: n });
    }
    return json({ error: `unknown op ${op}` }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
