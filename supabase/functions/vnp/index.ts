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
// CORS local — NE PAS toucher ../_shared/cors.ts (partagé par TOUTES les edges). Cette edge est
// publique (--no-verify-jwt) : on restreint l'origine navigateur aux domaines connus (bloque l'embed
// et le jailbreak sous une marque arbitraire). Les appels hors-navigateur (curl) ignorent CORS → ils
// sont freinés par l'allow-list de slug (leads) + le rate-limit ci-dessous.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-jwt',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

// Origine autorisée à appeler l'edge depuis un navigateur (renvoyée telle quelle si connue, sinon rien).
function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get('Origin') || '';
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    const https = u.protocol === 'https:';
    if (https && (host === 'prorascience.org' || host === 'www.prorascience.org')) return origin;
    if (https && (host === 'cimolace.space' || host.endsWith('.cimolace.space'))) return origin; // *.cimolace.space
    if (https && host.endsWith('-cimolace.vercel.app')) return origin;               // preview Vercel
    if (host === 'localhost' || host === '127.0.0.1') return origin;                  // dev local
  } catch { /* origine absente/invalide → non autorisée */ }
  return null;
}
function corsFor(req: Request): Record<string, string> {
  const o = allowedOrigin(req);
  return o ? { ...CORS_HEADERS, 'Access-Control-Allow-Origin': o } : { ...CORS_HEADERS };
}
function withCors(res: Response, cors: Record<string, string>): Response {
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

function json(obj: unknown, status = 200): Response {
  // ACAO ajouté par withCors() au niveau du handler (selon l'Origin) — jamais '*' en dur.
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

// Realms OS autorisés à recevoir des leads via le VNP public (parité front OS_REALMS). Empêche un
// client de forger `payload.slug` pour spammer la mailbox d'un tenant arbitraire. Configurable via
// VNP_ALLOWED_SLUGS (CSV) pour ajouter un realm sans redéployer le code.
function isAllowedLeadSlug(slug: string): boolean {
  // @ts-ignore - Deno
  const csv = String(Deno.env.get('VNP_ALLOWED_SLUGS') || 'isna');
  const allowed = new Set(csv.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  return allowed.has(String(slug || '').trim().toLowerCase());
}

// Rate-limit LÉGER best-effort : mémoire d'isolat (les isolats edge sont éphémères et multiples, donc
// ce n'est pas un quota strict — juste un frein anti-flood). Fenêtre glissante par IP + catégorie.
const RL = new Map<string, number[]>();
function rateLimited(ip: string, bucket: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const hits = (RL.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  RL.set(key, hits);
  if (RL.size > 5000) { for (const [k, v] of RL) { if (!v.some((t) => now - t < windowMs)) RL.delete(k); } }
  return hits.length > max;
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
    `=== GRAPHE ${platformName} (nœuds : id, titre, résumé, contenu, Preuves, [liés], [actions]) ===\n${graph || '(vide)'}\n=== FIN ===\n\n` +
    `RÈGLES :\n` +
    `- Identifie l'INTENTION du visiteur parmi : ${INTENTS.join(', ')}.\n` +
    `- Identifie le NŒUD le plus pertinent (son id) dans le graphe.\n` +
    `- Réponds à partir du contenu de ce nœud, puis propose 1 à 3 SUGGESTIONS de suite (ids de nœuds liés) et les ACTIONS disponibles du nœud.\n` +
    `- CLOISON : si on te parle d'une AUTRE plateforme, de « Cimolace », de créer un site/SaaS, REFUSE et recentre : « Ici on est sur ${platformName}. » (intent="contacter", onTopic=false).\n` +
    `- ANCRAGE STRICT : ne dis QUE ce qui est dans le graphe. Quand un nœud a des « Preuves », CITE-EN UNE verbatim (prix/chiffre/nom exact) pour appuyer ta réponse.\n` +
    `- N'invente JAMAIS un fait (prix, dates, chiffres). Si l'info manque (aucune preuve), dis-le honnêtement et propose de contacter.\n\n` +
    `MISE EN SCÈNE (optionnel, PRÉFÉRÉ quand une composition visuelle éclaire mieux qu'un paragraphe) : compose une SCÈNE designée qui illustre ta réponse. ` +
    `Choisis UN layout adapté à la question posée et remplis-le UNIQUEMENT avec des faits du graphe (verbatim pour les Preuves). Layouts autorisés :\n` +
    `• split — opposer 2 idées (constat/promesse, avant/après, X vs Y) : {"type":"split","headline":"court","left":{"title":"","subtitle":"","points":["..2-4"]},"right":{"title":"","subtitle":"","points":["..2-4"]},"tone":{"left":"gold","right":"terra"}}\n` +
    `• aside — liste de points-clés (piliers, garanties) : {"type":"aside","title":"","items":[{"label":"","value":"","note":""}]} (2 à 4 items)\n` +
    `• tutorial — démarche pas-à-pas : {"type":"tutorial","title":"","steps":[{"title":"","detail":""}],"cta":""} (2 à 5 étapes)\n` +
    `• timeline — séquence ordonnée : {"type":"timeline","title":"","steps":[{"marker":"1","kicker":"","title":"","detail":"","foot":""}]} (2 à 6 jalons)\n` +
    `• reader — texte long / histoire : {"type":"reader","title":"","profile":{"name":"","role":"","facts":[{"k":"","v":""}]},"body":[{"h":"","p":""}]}\n` +
    `NE COMPOSE JAMAIS les prix, chiffres ou comparatifs toi-même : pour les FORFAITS mets nodeId="produits", pour les CHIFFRES nodeId="realisations", pour COMPARER les cycles nodeId="solutions" — le site les rend depuis la donnée VÉRIFIÉE (ne fabrique pas de scène cards/stats/comparateur). Si aucune scène fiable n'est possible, scene=null (le texte suffit).\n\n` +
    `Réponds en JSON STRICT : { "reply": "1 à 3 phrases", "intent": "<une des intentions>", "nodeId": "<id ou vide>", ` +
    `"scene": <objet layout ci-dessus ou null>, "suggestions": ["<id nœud>", ...], "actions": ["<action>", ...], "onTopic": true|false }.`;

  const messages = [{ role: 'system', content: system }, ...history.slice(-6), { role: 'user', content: message }];
  const call = async (url: string, key: string, model: string, timeoutMs = 22000): Promise<string | null> => {
    if (!key) return null;
    const abort = new AbortController();
    const t = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0.4, max_tokens: 750, response_format: { type: 'json_object' }, messages }),
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
  // Scène COMPOSÉE par le LLM (passthrough léger ; le client re-valide via normalizeScene, autorité
  // finale, + whitelist des types narratifs). On ne renvoie qu'un objet {type:string} plausible.
  const scene = (p.scene && typeof p.scene === 'object' && typeof p.scene.type === 'string') ? p.scene : null;
  return json({ reply, intent, nodeId, scene, suggestions, actions, onTopic });
}

// Notifie le STAFF du tenant par EMAIL (Resend) à chaque nouveau lead. Sans ça, un contact/RDV pris
// hors horaires reste invisible jusqu'à ce qu'un membre ouvre l'écran secrétariat (alerte realtime
// uniquement). Best-effort : n'échoue JAMAIS le lead. Destinataires = staff actif (owner/admin/secretariat).
async function notifyStaff(tenantId: string, kind: 'contact' | 'booking', payload: any): Promise<{ recipients: number; sent: boolean; status?: number; error?: string }> {
  const fail = { recipients: 0, sent: false };
  // @ts-ignore - Deno
  const url = Deno.env.get('SUPABASE_URL');
  // @ts-ignore - Deno
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  // @ts-ignore - Deno
  const resendKey = Deno.env.get('RESEND_API_KEY') || '';
  // @ts-ignore - Deno
  const envFrom = Deno.env.get('RESEND_FROM') || '';
  // Expéditeur PRIMAIRE = RESEND_FROM (domaine vérifié → livre à tout le staff). Repli mode-test ci-dessous.
  const from = envFrom || 'onboarding@resend.dev';
  if (!url || !key || !resendKey || !tenantId) return fail;
  try {
    const mr = await fetch(`${url}/rest/v1/tenant_memberships?tenant_id=eq.${tenantId}&status=eq.active&role=in.(owner,admin,secretariat)&select=user_id`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!mr.ok) return fail;
    const members = await mr.json();
    const ids = Array.from(new Set((members || []).map((m: any) => m.user_id).filter(Boolean))).slice(0, 8);
    const emails: string[] = [];
    for (const uid of ids) {
      const ur = await fetch(`${url}/auth/v1/admin/users/${uid}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (ur.ok) { const u = await ur.json(); if (u && u.email) emails.push(u.email); }
    }
    if (!emails.length) return fail;
    const brand = String(payload?.platformName || 'votre site');
    const name = String(payload?.name || '(anonyme)').slice(0, 120);
    const email = String(payload?.email || '').slice(0, 160);
    const subject = kind === 'booking' ? `Nouvelle demande de RDV — ${brand}` : `Nouveau message — ${brand}`;
    const detail = kind === 'booking'
      ? `<p><b>Service :</b> ${String(payload?.service || 'Consultation')}<br><b>Créneau souhaité :</b> ${String(payload?.preferred_at || '—')}</p>`
      : `<p><b>Message :</b><br>${String(payload?.message || '').slice(0, 800).replace(/</g, '&lt;')}</p>`;
    const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px"><h2 style="margin:0 0 8px">${subject}</h2><p style="margin:0 0 4px"><b>${name}</b> &lt;${email}&gt;</p>${detail}<p style="color:#888;font-size:13px">Traitez la demande dans l'espace secrétariat → « Demandes du site ».</p></div>`;
    const send = (fromAddr: string, to: string[]) => fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${brand} <${fromAddr}>`, to, subject, html, reply_to: email || undefined }),
    });
    // 1) Envoi primaire : expéditeur configuré → tout le staff.
    const rr = await send(from, emails);
    if (rr.ok) return { recipients: emails.length, sent: true };
    const errText = await rr.text().catch(() => '');
    // 2) Repli MODE-TEST : Resend n'autorise l'envoi qu'à l'email du COMPTE tant qu'aucun domaine n'est
    //    vérifié. On extrait cet email de l'erreur et on notifie AU MOINS le titulaire (le fondateur),
    //    via l'expéditeur partagé vérifié. Dès qu'un domaine est vérifié (+ RESEND_FROM), tout le staff reçoit.
    const owner = (errText.match(/own email address \(([^)]+)\)/) || [])[1];
    if (owner) {
      const rr2 = await send('onboarding@resend.dev', [owner]);
      if (rr2.ok) return { recipients: 1, sent: true, error: 'fallback-owner (vérifiez un domaine Resend pour notifier tout le staff)' };
    }
    return { recipients: emails.length, sent: false, status: rr.status, error: errText.slice(0, 300) };
  } catch (e) { return { ...fail, error: String((e as Error)?.message || e).slice(0, 200) }; }
}

// Livraison RÉELLE d'un lead : insertion server-side dans contact_requests avec la SERVICE ROLE
// (contourne la RLS — l'insert anon est refusé). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sont
// injectés automatiquement dans le runtime des edge functions.
async function insertContact(payload: any): Promise<{ ok: boolean; notified: { recipients: number; sent: boolean } }> {
  const nope = { ok: false, notified: { recipients: 0, sent: false } };
  // @ts-ignore
  const url = Deno.env.get('SUPABASE_URL');
  // @ts-ignore
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return nope;
  try {
    // contact_requests.tenant_id est NOT NULL → on résout l'UUID du tenant depuis son slug.
    const slug = String(payload?.slug || '').trim().toLowerCase();
    if (!slug || !isAllowedLeadSlug(slug)) return nope; // allow-list : jamais écrire pour un tenant arbitraire
    const tr = await fetch(`${url}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=id`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!tr.ok) return nope;
    const rows = await tr.json();
    const tenantId = rows && rows[0] && rows[0].id;
    if (!tenantId) return nope;
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
    let notified = { recipients: 0, sent: false };
    if (res.ok) { try { notified = await notifyStaff(tenantId, 'contact', payload); } catch (_) { /* best-effort */ } }
    return { ok: res.ok, notified };
  } catch (_) { return nope; }
}

// Résout l'UUID d'un tenant depuis son slug (service role).
async function resolveTenantId(url: string, key: string, slug: string): Promise<string | null> {
  if (!slug) return null;
  const tr = await fetch(`${url}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=id`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!tr.ok) return null;
  const rows = await tr.json();
  return (rows && rows[0] && rows[0].id) || null;
}

// Livraison RÉELLE d'une demande de RDV : insertion server-side dans vnp_booking_requests (service role).
async function insertBooking(payload: any): Promise<{ ok: boolean; notified: { recipients: number; sent: boolean } }> {
  const nope = { ok: false, notified: { recipients: 0, sent: false } };
  // @ts-ignore
  const url = Deno.env.get('SUPABASE_URL');
  // @ts-ignore
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return nope;
  try {
    const slug = String(payload?.slug || '').trim().toLowerCase();
    if (!slug || !isAllowedLeadSlug(slug)) return nope; // allow-list : jamais écrire pour un tenant arbitraire
    const tenantId = await resolveTenantId(url, key, slug);
    if (!tenantId) return nope;
    const res = await fetch(`${url}/rest/v1/vnp_booking_requests`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        tenant_id: tenantId,
        service: String(payload?.service || 'Consultation').slice(0, 120),
        name: String(payload?.name || '').slice(0, 120),
        email: String(payload?.email || '').slice(0, 160),
        preferred_at: payload?.preferred_at || null,
        message: String(payload?.message || '').slice(0, 2000),
      }),
    });
    let notified = { recipients: 0, sent: false };
    if (res.ok) { try { notified = await notifyStaff(tenantId, 'booking', payload); } catch (_) { /* best-effort */ } }
    return { ok: res.ok, notified };
  } catch (_) { return nope; }
}

// ACTION ENGINE (§ doc « Exécuter les actions métier »). EXÉCUTE l'action : le contact est LIVRÉ
// (contact_requests), le RDV est ENREGISTRÉ (vnp_booking_requests) ; les actions transactionnelles
// renvoient la SUITE (next.kind) que le client route.
async function runAction(action: string, platformName: string, payload: any) {
  const a = String(action || '').toLowerCase();
  const name = payload?.name ? String(payload.name).slice(0, 80) : '';
  const label = payload?.label ? String(payload.label).slice(0, 120) : '';
  // Honeypot : le front ne poste JAMAIS ces champs. Remplis = bot → on simule un succès (ne pas
  // révéler le piège) SANS rien écrire ni notifier.
  const hp = String(payload?._hp ?? payload?.company ?? '').trim();
  if (hp) return json({ ok: true, message: `C'est bien reçu — ${platformName} vous répond vite.` });
  if (!INTENTS.includes(a)) return json({ ok: false, message: `Action inconnue : ${action}` }, 400);

  switch (a) {
    case 'contacter':
    case 'participer': {
      const email = String(payload?.email || '').trim();
      const message = String(payload?.message || '').trim();
      // 2e temps : coordonnées fournies → on LIVRE le message.
      if (email && message) {
        const r = await insertContact({ ...payload, platformName, subject: payload?.subject || `Contact via l'assistant ${platformName}` });
        return json(r.ok
          ? { ok: true, message: `C'est envoyé${name ? `, ${name}` : ''} — l'équipe de ${platformName} vous recontacte très vite.`, notified: r.notified }
          : { ok: false, message: 'Envoi impossible pour le moment — réessayez.' }, r.ok ? 200 : 502);
      }
      // 1er temps : on demande le mini-formulaire.
      return json({ ok: true, message: `Laissez-nous un mot — ${platformName} vous répond vite.`,
        next: { kind: 'contact_form', fields: ['name', 'email', 'message'] } });
    }
    case 'reserver': {
      const email = String(payload?.email || '').trim();
      const preferredAt = payload?.preferred_at;
      // 2e temps : créneau + email fournis → on ENREGISTRE la demande de RDV.
      if (email && preferredAt) {
        const r = await insertBooking({ ...payload, platformName, service: payload?.service || 'Consultation privée' });
        return json(r.ok
          ? { ok: true, message: `C'est réservé${name ? `, ${name}` : ''} — ${platformName} vous confirme le créneau par e-mail.`, notified: r.notified }
          : { ok: false, message: 'Réservation impossible pour le moment — réessayez.' }, r.ok ? 200 : 502);
      }
      // 1er temps : on ouvre le sélecteur de créneaux.
      return json({ ok: true, message: `Choisissez un créneau — je réserve votre consultation.`,
        next: { kind: 'booking', target: label || 'Consultation privée' } });
    }
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
  const cors = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim() || 'unknown';
  try {
    if (rateLimited(ip, 'all', 40, 60_000)) return withCors(json({ error: 'rate_limited' }, 429), cors);
    const url = new URL(req.url);
    const sub = (url.pathname.split('/vnp/')[1] || '').replace(/\/+$/, '').toLowerCase();
    const body = await req.json().catch(() => ({}));
    const op = String(body?.op || sub || 'chat').toLowerCase();
    const platformName = String(body?.platformName || 'cette plateforme').trim().slice(0, 80);

    if (op === 'chat') {
      if (rateLimited(ip, 'chat', 20, 60_000)) return withCors(json({ error: 'rate_limited' }, 429), cors);
      const message = String(body?.message || '').trim();
      if (!message) return withCors(json({ error: 'message is required' }, 400), cors);
      const graph = String(body?.graph || '').slice(0, 12000);
      const history = Array.isArray(body?.history) ? body.history : [];
      return withCors(await callChat(message, platformName, graph, history), cors);
    }
    if (op === 'action') {
      if (rateLimited(ip, 'action', 12, 60_000)) return withCors(json({ error: 'rate_limited' }, 429), cors);
      return withCors(await runAction(String(body?.action || ''), platformName, body?.payload || {}), cors);
    }
    if (op === 'node') {
      const graph = body?.graph;
      const idWanted = String(body?.id || sub || '').toLowerCase();
      const nodes = graph && typeof graph === 'object' ? (graph.nodes || graph) : null;
      const n = nodes && idWanted ? nodes[idWanted] : null;
      if (!n) return withCors(json({ error: `node ${idWanted} not found` }, 404), cors);
      return withCors(json({ node: n }), cors);
    }
    return withCors(json({ error: `unknown op ${op}` }, 400), cors);
  } catch (e) {
    return withCors(json({ error: String((e as Error)?.message || e) }, 500), cors);
  }
});
