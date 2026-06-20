/// <reference lib="deno.ns" />

/**
 * generate-mindmap — Mindmap depuis transcript via Groq → DeepSeek.
 *
 * C-3 (REQ-SEC-001) : verify_jwt = false dans config.toml. Pour empêcher
 * l'abus de quota IA, on exige désormais un user authentifié via
 * requireUser() (la clé anon seule ne suffit plus).
 */
import { corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/requireUser.ts';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';

type TranscriptLine = { timeSeconds?: number; time?: string; text: string };

const pruneMindmap = (
  root: MindMapNode,
  {
    maxDepth = 4,
    maxNodes = 40,
    maxChildrenPerNode = 8,
  }: { maxDepth?: number; maxNodes?: number; maxChildrenPerNode?: number } = {}
): MindMapNode => {
  let count = 0;
  const walk = (n: MindMapNode, depth: number): MindMapNode | null => {
    if (count >= maxNodes) return null;
    count += 1;

    const node: MindMapNode = {
      ...n,
      id: safeId(n.id, `node-${count}`),
      label: String(n.label || '').trim() || `Noeud ${count}`,
      summary: n.summary ? String(n.summary).trim().slice(0, 300) : undefined,
      explanation: n.explanation ? String(n.explanation).trim().slice(0, 2000) : undefined,
      keyPoints: Array.isArray(n.keyPoints) ? (n.keyPoints as string[]).map(String).filter(Boolean).slice(0, 8) : undefined,
      examples: Array.isArray(n.examples) ? (n.examples as string[]).map(String).filter(Boolean).slice(0, 4) : undefined,
      children: [],
    };

    if (depth >= maxDepth) {
      node.children = [];
      return node;
    }

    const children = Array.isArray(n.children) ? n.children : [];
    const limited = children.slice(0, maxChildrenPerNode);
    node.children = limited
      .map((c) => walk(c, depth + 1))
      .filter((x): x is MindMapNode => Boolean(x));
    return node;
  };

  const pruned = walk(root, 0);
  if (!pruned) {
    return {
      id: 'root',
      label: root.label || 'Mindmap',
      time: root.time || '0:00',
      children: [],
    };
  }
  return pruned;
};

type ChapterSegment = {
  startSeconds?: number;
  endSeconds?: number;
  label?: string;
};

type MindMapNode = {
  id: string;
  label: string;
  time?: string;
  timeSeconds?: number;
  /** P1 — index du chapitre/section auquel la carte appartient (déduit de l'horodatage).
   *  Rend la carte source unique : slide SmartBoard (groupé par chapitre) + nœud révision. */
  chapterIndex?: number;
  summary?: string;
  explanation?: string;
  keyPoints?: string[];
  examples?: string[];
  children?: MindMapNode[];
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const parseTimeToSeconds = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const v = String(value).trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  const m = /^(\d+):(\d{1,2})$/.exec(v);
  if (!m) return null;
  const mm = Number(m[1]);
  const ss = Number(m[2]);
  if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss < 0 || ss >= 60) return null;
  return mm * 60 + ss;
};

const formatSeconds = (seconds: number): string => {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
};

const safeId = (value: unknown, fallback: string): string => {
  const s = String(value ?? '').trim();
  const cleaned = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
  return cleaned || fallback;
};

const validateMindmap = (node: unknown, depth = 0): MindMapNode => {
  if (!isObject(node)) throw new Error('Mindmap invalide');
  // Tolérant aux id/label manquants : on dérive un fallback déterministe au
  // lieu de faire échouer TOUTE la génération (le modèle omet parfois l'id du
  // root, ou emploie « title »/« name » au lieu de « label »). Auparavant un
  // root sans id/label levait « id/label requis » AVANT que l'appelant ne
  // puisse appliquer ses propres défauts (root.id='root', root.label=titre),
  // d'où des 500 réguliers sur « Améliorer avec IA ». Le root sans label est
  // laissé vide pour que l'appelant le remplace par le titre du cours.
  const rawLabel = String(node.label ?? node.title ?? node.name ?? '').trim();
  const rawId = String(node.id ?? '').trim();
  const id = safeId(rawId || rawLabel, depth === 0 ? 'root' : `node-${depth}`);
  const label = rawLabel || rawId;

  const out: MindMapNode = { id, label };

  if (node.summary != null) {
    const s = String(node.summary).trim();
    if (s) out.summary = s;
  }
  if (node.explanation != null) {
    const s = String(node.explanation).trim();
    if (s) out.explanation = s;
  }

  if (Array.isArray(node.keyPoints)) {
    const arr = (node.keyPoints as unknown[]).map(String).filter(Boolean);
    if (arr.length) out.keyPoints = arr;
  }

  if (Array.isArray(node.examples)) {
    const arr = (node.examples as unknown[]).map(String).filter(Boolean);
    if (arr.length) out.examples = arr;
  }

  if (node.timeSeconds != null) {
    const t = parseTimeToSeconds(node.timeSeconds);
    if (t != null) out.timeSeconds = t;
  }

  if (node.time != null) {
    const t = String(node.time).trim();
    if (t) out.time = t;
  } else if (out.timeSeconds != null) {
    out.time = formatSeconds(out.timeSeconds);
  }

  if (Array.isArray(node.children)) {
    if (depth > 12) throw new Error('Mindmap invalide: trop profonde');
    out.children = node.children.map((c) => validateMindmap(c, depth + 1));
  } else {
    out.children = [];
  }

  return out;
};

const buildFallbackMindmap = (title: string, chapters: ChapterSegment[], transcript: TranscriptLine[]): MindMapNode => {
  const safeTitle = title || 'Plan';

  const childrenFromChapters = (chapters || [])
    .map((c, idx) => {
      const start = c?.startSeconds != null ? parseTimeToSeconds(c.startSeconds) : null;
      const label = String(c?.label || '').trim() || `Chapitre ${idx + 1}`;
      return {
        id: safeId(label, `chapitre-${idx + 1}`),
        label,
        time: start != null ? formatSeconds(start) : undefined,
        summary: '',
        explanation: '',
        children: [],
      } as MindMapNode;
    })
    .filter((n) => n.label)
    .slice(0, 30);

  // If no chapters, use the first transcript lines as rough anchors.
  const childrenFromTranscript = childrenFromChapters.length
    ? []
    : (transcript || [])
        .map((l, idx) => {
          const t = l?.timeSeconds != null ? parseTimeToSeconds(l.timeSeconds) : parseTimeToSeconds(l?.time);
          const text = String(l?.text || '').trim();
          if (!text) return null;
          const short = text.length > 64 ? `${text.slice(0, 61)}…` : text;
          return {
            id: `idee-${idx + 1}`,
            label: short,
            time: t != null ? formatSeconds(t) : undefined,
            summary: '',
            explanation: '',
            children: [],
          } as MindMapNode;
        })
        .filter(Boolean)
        .slice(0, 12) as MindMapNode[];

  return {
    id: 'root',
    label: safeTitle,
    time: '0:00',
    summary: '',
    explanation: '',
    children: [...childrenFromChapters, ...childrenFromTranscript],
  };
};

/** P1 — tague chaque nœud avec son chapitre (chapterIndex) d'après son horodatage,
 *  pour que la même carte serve de slide SmartBoard (groupé par chapitre) ET de nœud
 *  de révision. Un nœud sans horodatage propre hérite du chapitre de son parent. */
function tagNodesWithChapter(root: MindMapNode, chapters: ChapterSegment[]): void {
  const ranges = (chapters || [])
    .map((c, idx) => {
      const start = c?.startSeconds != null ? parseTimeToSeconds(c.startSeconds) : null;
      const end = c?.endSeconds != null ? parseTimeToSeconds(c.endSeconds) : null;
      return start != null ? { idx, start, end: end != null ? end : Number.MAX_SAFE_INTEGER } : null;
    })
    .filter((x): x is { idx: number; start: number; end: number } => Boolean(x))
    .sort((a, b) => a.start - b.start);
  if (!ranges.length) return;

  const indexForTime = (sec: number | null): number | null => {
    if (sec == null) return null;
    for (const r of ranges) if (sec >= r.start && sec < r.end) return r.idx;
    let best: number | null = null;
    for (const r of ranges) if (r.start <= sec) best = r.idx;
    return best ?? ranges[0].idx;
  };

  const walk = (n: MindMapNode, inherited: number | null): void => {
    const sec = n.timeSeconds != null ? n.timeSeconds : parseTimeToSeconds(n.time ?? null);
    const ci = indexForTime(sec);
    const resolved = ci != null ? ci : inherited;
    if (resolved != null) n.chapterIndex = resolved;
    (n.children || []).forEach((c) => walk(c, resolved));
  };
  // le root reste global (pas de chapitre) ; on tague à partir des enfants.
  (root.children || []).forEach((c) => walk(c, null));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    const groqApiKey = Deno.env.get('GROQ_API_KEY') || '';
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY') || '';
    const mistralApiKey = Deno.env.get('MISTRAL_API_KEY') || '';
    if (!groqApiKey && !deepseekApiKey && !mistralApiKey) {
      return new Response(JSON.stringify({ error: 'Missing GROQ_API_KEY, DEEPSEEK_API_KEY and MISTRAL_API_KEY secrets' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deepseekBaseUrl = (Deno.env.get('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com').replace(/\/+$/, '');
    const deepseekModel = Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-chat';
    // Mindmap = raisonnement hiérarchique structuré → on prend le modèle Mistral
    // le plus capable. Surcharge possible via MISTRAL_MODEL_MINDMAP.
    const mistralModel = Deno.env.get('MISTRAL_MODEL_MINDMAP') || Deno.env.get('MISTRAL_MODEL') || 'mistral-large-latest';

    const body = await req.json().catch(() => ({}));
    const transcript = Array.isArray(body?.transcript) ? (body.transcript as TranscriptLine[]) : [];
    const chapters = Array.isArray(body?.chapters) ? (body.chapters as ChapterSegment[]) : [];
    const title = String(body?.title || '').trim();

    const compactTranscript = transcript
      .map((l) => {
        const t = l?.timeSeconds != null ? parseTimeToSeconds(l.timeSeconds) : parseTimeToSeconds(l?.time);
        const tt = t != null ? formatSeconds(t) : '';
        const text = String(l?.text || '').trim();
        if (!text) return null;
        return tt ? `${tt} ${text}` : text;
      })
      .filter(Boolean)
      .slice(0, 200);

    const compactChapters = chapters
      .map((c, idx) => {
        const start = c?.startSeconds != null ? parseTimeToSeconds(c.startSeconds) : null;
        const end = c?.endSeconds != null ? parseTimeToSeconds(c.endSeconds) : null;
        const label = String(c?.label || '').trim() || `Chapitre ${idx + 1}`;
        if (start == null && end == null && !label) return null;
        return {
          label,
          start: start != null ? formatSeconds(start) : null,
          end: end != null ? formatSeconds(end) : null,
        };
      })
      .filter(Boolean)
      .slice(0, 80);

    const system =
      'Tu génères une mindmap JSON EXHAUSTIVE et HIÉRARCHIQUE d\'un cours vidéo. ' +
      'RÈGLE N°1 : couvre TOUS les grands sujets abordés dans la transcription, sans en omettre aucun. ' +
      'RÈGLE N°2 : construis d\'abord les grands chapitres (niveau 1), puis les sous-concepts de chaque chapitre (niveau 2), puis les détails clés (niveau 3). ' +
      'RÈGLE N°3 : chaque concept nommé explicitement dans la transcription DOIT apparaître comme nœud. ' +
      'Output ONLY valid JSON, no markdown, no text outside JSON. ' +
      'Schema: {id,label,time,summary,keyPoints:[...],children:[...]}. Chaque nœud DOIT avoir id et label. ' +
      'Chaque nœud est une CARTE qui sert À LA FOIS de slide pédagogique (SmartBoard) et de nœud de révision : il DOIT donc porter un summary (reformulation pédagogique claire et autonome, 1-2 phrases) et 2 à 4 keyPoints (points clés courts et concrets). ' +
      'time : format mm:ss indiquant où ce concept apparaît dans la vidéo. Tout le texte en français.';

    const userPrompt = {
      task:
        'ÉTAPE 1 — Identifie les grandes sections du cours dans l\'ordre chronologique : autant qu\'en contient RÉELLEMENT la transcription (n\'en invente aucune, n\'impose aucun minimum). ' +
        'ÉTAPE 2 — Pour chaque section, liste ses sous-concepts explicitement nommés dans la transcription. ' +
        'ÉTAPE 3 — Pour chaque sous-concept important, ajoute ses éléments constitutifs si mentionnés. ' +
        'OBLIGATOIRE : chaque concept, terme technique, règle, étape, définition ou exemple RÉELLEMENT nommé dans la transcription doit devenir un nœud — et tu n\'inventes RIEN qui n\'y figure pas (peu importe la matière : sciences, langue, religion, art, etc.). ' +
        'Pour chaque nœud : résumé 1-2 phrases en français + time mm:ss du moment où il apparaît dans la vidéo. ' +
        'Limites : profondeur max 4, max 10 enfants par nœud ; adapte le nombre total de nœuds à la richesse réelle de la transcription (transcription courte → mindmap plus compacte) sans jamais gonfler artificiellement, et produis toujours au moins les sections et concepts réellement présents.',
      title: title || undefined,
      chapters: compactChapters,
      transcript: compactTranscript,
    };

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(userPrompt) },
    ];

    // ─── LIRI Credits — Tenant + preflight ────────────────────────────────
    const ctx = await resolveTenant(req, body);
    if (ctx) {
      const promptText = system + JSON.stringify(userPrompt);
      const estimate = await estimateLlmCost(ctx, 'groq', 'llama-3.3-70b-versatile', promptText, 4000);
      const reject = await preflightCheck(ctx, estimate);
      if (reject) {
        const errBody = await reject.json();
        return new Response(JSON.stringify(errBody), {
          status: reject.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const billingTrack = { provider: '', model: '', tokens_in: 0, tokens_out: 0 };

    // ── Try Groq first (fast: 2-5s) ──────────────────────────────────────────
    let content = '';
    let modelUsed = '';

    if (groqApiKey) {
      try {
        const groqAbort = new AbortController();
        const gt = setTimeout(() => groqAbort.abort('timeout'), 30_000);
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
            messages,
            max_tokens: 4000,
            response_format: { type: 'json_object' },
          }),
          signal: groqAbort.signal,
        });
        clearTimeout(gt);
        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const c = String(groqData?.choices?.[0]?.message?.content || '').trim();
          if (c) {
            content = c; modelUsed = 'groq';
            billingTrack.provider = 'groq';
            billingTrack.model = 'llama-3.3-70b-versatile';
            billingTrack.tokens_in = groqData?.usage?.prompt_tokens ?? 0;
            billingTrack.tokens_out = groqData?.usage?.completion_tokens ?? 0;
          }
        }
      } catch (_groqErr) { /* fall through to DeepSeek */ }
    }

    // ── Fallback to DeepSeek if Groq failed ──────────────────────────────────
    if (!content && deepseekApiKey) {
      try {
        const dsAbort = new AbortController();
        const dt = setTimeout(() => dsAbort.abort('timeout'), 50_000);
        const dsRes = await fetch(`${deepseekBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${deepseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: deepseekModel,
            temperature: 0.1,
            messages,
            max_tokens: 4000,
            response_format: { type: 'json_object' },
          }),
          signal: dsAbort.signal,
        });
        clearTimeout(dt);
        if (dsRes.ok) {
          const dsData = await dsRes.json();
          const c = String(dsData?.choices?.[0]?.message?.content || '').trim();
          if (c) {
            content = c; modelUsed = 'deepseek';
            billingTrack.provider = 'deepseek';
            billingTrack.model = deepseekModel;
            billingTrack.tokens_in = dsData?.usage?.prompt_tokens ?? 0;
            billingTrack.tokens_out = dsData?.usage?.completion_tokens ?? 0;
          }
        } else if (dsRes.status === 402) {
          const mindmap = buildFallbackMindmap(title || 'Plan', chapters, transcript);
          return new Response(
            JSON.stringify({ mindmap, warning: 'DeepSeek: solde insuffisant. Mindmap générée depuis les chapitres.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (_dsErr) { /* fall through to Mistral */ }
    }

    // ── Fallback to Mistral (EU) if Groq + DeepSeek failed ───────────────────
    if (!content && mistralApiKey) {
      try {
        const mAbort = new AbortController();
        const mt = setTimeout(() => mAbort.abort('timeout'), 50_000);
        const mRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${mistralApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: mistralModel,
            temperature: 0.1,
            messages,
            max_tokens: 4000,
            response_format: { type: 'json_object' },
          }),
          signal: mAbort.signal,
        });
        clearTimeout(mt);
        if (mRes.ok) {
          const mData = await mRes.json();
          const c = String(mData?.choices?.[0]?.message?.content || '').trim();
          if (c) {
            content = c; modelUsed = 'mistral';
            billingTrack.provider = 'mistral';
            billingTrack.model = mistralModel;
            billingTrack.tokens_in = mData?.usage?.prompt_tokens ?? 0;
            billingTrack.tokens_out = mData?.usage?.completion_tokens ?? 0;
          }
        }
      } catch (_mErr) { /* fall through to structural fallback */ }
    }

    if (!content) {
      const mindmap = buildFallbackMindmap(title || 'Plan', chapters, transcript);
      return new Response(
        JSON.stringify({ mindmap, warning: 'Groq, DeepSeek et Mistral indisponibles. Mindmap générée depuis les chapitres.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    void modelUsed; // suppress unused warning

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (_) {
      const mindmap = buildFallbackMindmap(title || 'Plan', chapters, transcript);
      return new Response(
        JSON.stringify({ mindmap, warning: 'Réponse IA tronquée (max_tokens). Mindmap générée depuis les chapitres.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    let mindmap = validateMindmap(parsed);

    if (!mindmap.id) mindmap.id = 'root';
    if (!mindmap.label) mindmap.label = title || 'Mindmap';

    // ensure stable root
    mindmap.id = safeId(mindmap.id, 'root');

    // enforce size even if the model ignores instructions
    mindmap = pruneMindmap(mindmap, { maxDepth: 4, maxNodes: 60, maxChildrenPerNode: 10 });

    // P1 — rattache chaque carte à son chapitre/section (slide SmartBoard ↔ nœud révision).
    tagNodesWithChapter(mindmap, chapters);

    let billingInfo: Record<string, unknown> | undefined;
    if (ctx && billingTrack.provider) {
      const debitIn = await debitUsage(ctx, {
        functionName: 'generate-mindmap', provider: billingTrack.provider, model: billingTrack.model,
        unitType: 'tokens_in', unitAmount: billingTrack.tokens_in, metadata: { title },
      });
      const debitOut = await debitUsage(ctx, {
        functionName: 'generate-mindmap', provider: billingTrack.provider, model: billingTrack.model,
        unitType: 'tokens_out', unitAmount: billingTrack.tokens_out,
      });
      billingInfo = {
        provider: billingTrack.provider, model: billingTrack.model,
        tokens_in: billingTrack.tokens_in, tokens_out: billingTrack.tokens_out,
        credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
        balance: debitOut.balance ?? debitIn.balance,
      };
    }

    return new Response(JSON.stringify({ mindmap, ...(billingInfo ? { _billing: billingInfo } : {}) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as any)?.message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
