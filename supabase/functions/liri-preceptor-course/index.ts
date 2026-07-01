/// <reference lib="deno.ns" />

/**
 * liri-preceptor-course — Génère UN CROQUIS vectoriel tracé-main pour une scène
 * du cours « Le Précepteur », à partir de {chapterTitle, centralIdea, lessonText}.
 *
 * Cascade LLM Groq → DeepSeek → Mistral (même schéma que generate-mindmap).
 * Sortie JSON STRICTE consommée par <SketchRenderer sketch={...} /> :
 *   apps/app/src/components/school/course-builder/SketchRenderer.jsx
 *   apps/app/src/pages/dev/PrecepteurDemoPage.jsx  (scène type:'croquis' → s.sketch)
 *
 * ── Contrat de coordonnées ──────────────────────────────────────────────────
 * Le LLM raisonne et émet des coordonnées NORMALISÉES 0..1 (repère naturel,
 * plus stable pour un modèle). SketchRenderer, lui, attend des POURCENTAGES
 * 0..100 du cadre 16:9 (px = x/100*160, py = y/100*90). Cette edge fait donc la
 * DÉNORMALISATION (× 100) de from/to/center + radius + laisse turns tel quel,
 * puis SANITISE chaque élément selon son `kind` (dropping des éléments malformés
 * qui feraient crash le renderer : accès non gardés el.from[0] / el.center[0]).
 *
 * C-3 (REQ-SEC-001) : verify_jwt = false dans config.toml → on exige un user
 * authentifié via requireUser() (la clé anon seule ne suffit pas).
 * Ajouter dans supabase/config.toml :
 *   [functions.liri-preceptor-course]
 *   verify_jwt = false
 */
import { corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/requireUser.ts';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Types (miroir du contrat SketchRenderer)
// ─────────────────────────────────────────────────────────────────────────────

/** Vocabulaire FERMÉ des kinds (SketchRenderer.jsx:11). */
const KINDS = ['vector', 'arrow', 'line', 'curve', 'point', 'circle', 'spiral', 'axis', 'label'] as const;
type SketchKind = (typeof KINDS)[number];

/** Kinds à géométrie segment : exigent from ET to. */
const SEGMENT_KINDS = new Set<SketchKind>(['vector', 'arrow', 'line', 'curve']);
/** Kinds à géométrie ponctuelle : exigent center. */
const CENTER_KINDS = new Set<SketchKind>(['point', 'circle', 'spiral', 'axis', 'label']);

/** Palette FERMÉE (SketchRenderer.jsx:18). Toute autre valeur retombe sur 'slate'. */
const COLORS = ['blue', 'amber', 'green', 'purple', 'slate', 'red'] as const;
const COLOR_SET = new Set<string>(COLORS);

type Pt = [number, number];

interface SketchElement {
  kind: SketchKind;
  from?: Pt;
  to?: Pt;
  center?: Pt;
  radius?: number;
  turns?: number;
  color?: string;
  label?: string;
  labelSide?: 'above' | 'below';
  order?: number;
}

interface Sketch {
  caption?: string;
  elements: SketchElement[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de sanitisation
// ─────────────────────────────────────────────────────────────────────────────

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * Convertit une paire brute (renvoyée par le LLM en 0..1, mais on tolère aussi
 * du 0..100 au cas où le modèle ignore la consigne) en POURCENTAGE 0..100.
 * Retourne null si la paire est inexploitable.
 */
const toPercentPair = (raw: unknown): Pt | null => {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  let x = Number(raw[0]);
  let y = Number(raw[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  // Heuristique : si les deux valeurs tiennent dans [0,1], on considère du
  // normalisé et on multiplie par 100. Sinon (déjà en 0..100) on garde tel quel.
  if (Math.abs(x) <= 1 && Math.abs(y) <= 1) {
    x *= 100;
    y *= 100;
  }
  return [clamp(x, 0, 100), clamp(y, 0, 100)];
};

/** radius LLM (0..1 → % de la hauteur) → % 0..100. Tolère déjà-en-%. */
const toPercentRadius = (raw: unknown, fallback: number): number => {
  if (raw == null) return fallback;
  let r = Number(raw);
  if (!Number.isFinite(r) || r <= 0) return fallback;
  if (r <= 1) r *= 100;
  return clamp(r, 2, 60);
};

const normColor = (raw: unknown): string | undefined => {
  if (raw == null) return undefined;
  const c = String(raw).trim().toLowerCase();
  if (!c) return undefined;
  // clé de palette connue, sinon on laisse passer une couleur CSS littérale
  return COLOR_SET.has(c) ? c : String(raw).trim();
};

const normLabelSide = (raw: unknown): 'above' | 'below' | undefined => {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'above' || s === 'below') return s;
  return undefined;
};

const cleanLabel = (raw: unknown): string | undefined => {
  const s = String(raw ?? '').trim();
  return s ? s.slice(0, 120) : undefined;
};

/**
 * SANITISE un élément brut du LLM → SketchElement valide, ou null si à jeter.
 * Garantit la forme géométrique exigée par SketchRenderer (from/to OU center)
 * pour ne JAMAIS crasher le renderer (accès non gardés el.from[0]/el.center[0]).
 */
function sanitizeElement(raw: unknown, idx: number): SketchElement | null {
  if (!isObject(raw)) return null;
  const kind = String(raw.kind ?? '').trim().toLowerCase() as SketchKind;
  if (!KINDS.includes(kind)) return null;

  const base: SketchElement = { kind };

  const color = normColor(raw.color);
  if (color) base.color = color;

  const label = cleanLabel(raw.label);
  if (label) base.label = label;

  const labelSide = normLabelSide(raw.labelSide);
  if (labelSide) base.labelSide = labelSide;

  const order = Number(raw.order);
  base.order = Number.isFinite(order) ? order : idx + 1;

  if (SEGMENT_KINDS.has(kind)) {
    const from = toPercentPair(raw.from);
    const to = toPercentPair(raw.to);
    if (!from || !to) return null; // exige from ET to → sinon jeter (anti-crash)
    base.from = from;
    base.to = to;
    return base;
  }

  if (CENTER_KINDS.has(kind)) {
    const center = toPercentPair(raw.center);
    if (!center) return null; // exige center → sinon jeter (anti-crash)
    base.center = center;

    if (kind === 'circle') base.radius = toPercentRadius(raw.radius, 14);
    if (kind === 'axis') base.radius = toPercentRadius(raw.radius, 22);
    if (kind === 'spiral') {
      base.radius = toPercentRadius(raw.radius, 30);
      const t = Number(raw.turns);
      base.turns = Number.isFinite(t) && t > 0 ? clamp(t, 0.5, 6) : 2.5;
    }
    if (kind === 'label' && !base.label) {
      // un label sans texte n'a aucun intérêt visuel
      return null;
    }
    return base;
  }

  return null;
}

/** Sanitise le sketch complet (dénormalise + filtre). */
function sanitizeSketch(raw: unknown): Sketch {
  const obj = isObject(raw) ? raw : {};
  // le modèle range parfois le sketch sous .sketch — on déballe.
  const src = isObject(obj.sketch) ? (obj.sketch as Record<string, unknown>) : obj;

  const caption = cleanLabel(src.caption);
  const rawElements = Array.isArray(src.elements) ? src.elements : [];
  const elements = rawElements
    .map((el, i) => sanitizeElement(el, i))
    .filter((el): el is SketchElement => el !== null)
    .slice(0, 12); // garde-fou : un croquis lisible ne surcharge pas

  const out: Sketch = { elements };
  if (caption) out.caption = caption;
  return out;
}

/**
 * Fallback structurel si le LLM échoue totalement : un croquis minimal mais
 * VALIDE (une flèche + une étiquette) pour ne jamais renvoyer un écran vide.
 */
function buildFallbackSketch(chapterTitle: string): Sketch {
  const label = (chapterTitle || 'idée centrale').slice(0, 60);
  return {
    caption: label,
    elements: [
      { kind: 'vector', from: [26, 64], to: [80, 34], color: 'blue', label, labelSide: 'above', order: 1 },
      { kind: 'point', center: [80, 34], color: 'amber', label: 'aboutissement', order: 2 },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt LLM
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = [
  "Tu es « Le Précepteur » : un professeur qui, pour expliquer une idée, DESSINE un croquis au tableau, trait par trait, comme pour un enfant.",
  "Ta tâche : produire UN SEUL croquis vectoriel schématique qui rend VISIBLE l'idée centrale de la scène (une relation, une force, un mouvement, une opposition). PAS une illustration réaliste : un schéma minimal et lisible.",
  "Tu réponds UNIQUEMENT avec du JSON valide, sans markdown, sans texte hors JSON.",
  "",
  "SCHÉMA EXACT de sortie :",
  '{ "caption": string, "elements": [ Element, ... ] }',
  "",
  "Chaque Element a un champ \"kind\" parmi EXACTEMENT ces 9 valeurs (aucune autre) :",
  "  vector | arrow | line | curve | point | circle | spiral | axis | label",
  "",
  "Géométrie OBLIGATOIRE selon le kind :",
  "  - vector, arrow, line, curve  → DOIVENT avoir \"from\":[x,y] ET \"to\":[x,y].",
  "  - point, circle, spiral, axis, label → DOIVENT avoir \"center\":[x,y].",
  "  - circle/axis peuvent avoir \"radius\" (nombre). spiral peut avoir \"radius\" et \"turns\" (nombre de tours, ex 2.5).",
  "  - label DOIT avoir un champ \"label\" (le texte affiché à cette position).",
  "",
  "COORDONNÉES : toutes normalisées entre 0 et 1 (0 = gauche/haut, 1 = droite/bas), repère 16:9. radius aussi entre 0 et 1.",
  "",
  "Champs optionnels communs à tout Element :",
  '  - "color" : une clé parmi "blue","amber","green","purple","slate","red" (blue = sujet principal, amber = force/contrainte opposée).',
  '  - "label" : courte étiquette (2 à 4 mots) posée sur l\'élément.',
  '  - "labelSide" : "above" ou "below" (pour vector/arrow/line/curve, évite le chevauchement).',
  '  - "order" : entier (1,2,3…) = ordre de tracé (le prof dessine dans cet ordre).',
  "",
  "RÈGLES de qualité :",
  "  - 2 à 5 éléments MAXIMUM. Épuré. Chaque élément porte du SENS.",
  "  - Le croquis DOIT traduire l'idée centrale, pas décorer.",
  "  - Une \"caption\" courte (une demi-phrase) qui nomme ce qu'on voit.",
  "  - Étiquettes en français. Pas de coordonnées identiques qui se superposent.",
].join('\n');

function buildUserPayload(input: {
  chapterTitle: string;
  centralIdea: string;
  lessonText: string;
}) {
  return {
    consigne:
      "Dessine le croquis qui rend visible l'idée centrale ci-dessous. Choisis les kinds/coordonnées (0..1) qui montrent la relation ou le mouvement en jeu. Réponds UNIQUEMENT le JSON du schéma.",
    chapitre: input.chapterTitle || undefined,
    idee_centrale: input.centralIdea || undefined,
    lecon: input.lessonText || undefined,
    exemple_de_forme_attendue: {
      caption: 'La flèche du temps et la contrainte de l’espace',
      elements: [
        { kind: 'vector', from: [0.26, 0.64], to: [0.8, 0.3], color: 'blue', label: 'flèche du temps', labelSide: 'above', order: 1 },
        { kind: 'arrow', from: [0.8, 0.72], to: [0.4, 0.52], color: 'amber', label: 'contrainte — espace', labelSide: 'below', order: 2 },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

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
      return new Response(
        JSON.stringify({ error: 'Missing GROQ_API_KEY, DEEPSEEK_API_KEY and MISTRAL_API_KEY secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const deepseekBaseUrl = (Deno.env.get('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com').replace(/\/+$/, '');
    const deepseekModel = Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-chat';
    const mistralModel = Deno.env.get('MISTRAL_MODEL') || 'mistral-large-latest';

    const body = await req.json().catch(() => ({}));
    const chapterTitle = String(body?.chapterTitle ?? body?.chapter_title ?? '').trim();
    const centralIdea = String(body?.centralIdea ?? body?.central_idea ?? '').trim();
    const lessonText = String(body?.lessonText ?? body?.lesson_text ?? '').trim().slice(0, 4000);

    if (!chapterTitle && !centralIdea && !lessonText) {
      return new Response(
        JSON.stringify({ error: 'Payload requis : au moins un de {chapterTitle, centralIdea, lessonText}' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userPayload = buildUserPayload({ chapterTitle, centralIdea, lessonText });
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(userPayload) },
    ];

    // ─── LIRI Credits — Tenant + preflight ──────────────────────────────────
    const ctx = await resolveTenant(req, body);
    if (ctx) {
      const promptText = SYSTEM_PROMPT + JSON.stringify(userPayload);
      const estimate = await estimateLlmCost(ctx, 'groq', 'llama-3.3-70b-versatile', promptText, 1500);
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
    let content = '';

    // ── Groq d'abord (rapide) ───────────────────────────────────────────────
    if (groqApiKey) {
      try {
        const abort = new AbortController();
        const t = setTimeout(() => abort.abort('timeout'), 30_000);
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            messages,
            max_tokens: 1500,
            response_format: { type: 'json_object' },
          }),
          signal: abort.signal,
        });
        clearTimeout(t);
        if (res.ok) {
          const data = await res.json();
          const c = String(data?.choices?.[0]?.message?.content || '').trim();
          if (c) {
            content = c;
            billingTrack.provider = 'groq';
            billingTrack.model = 'llama-3.3-70b-versatile';
            billingTrack.tokens_in = data?.usage?.prompt_tokens ?? 0;
            billingTrack.tokens_out = data?.usage?.completion_tokens ?? 0;
          }
        }
      } catch (_e) { /* fall through */ }
    }

    // ── DeepSeek en repli ───────────────────────────────────────────────────
    if (!content && deepseekApiKey) {
      try {
        const abort = new AbortController();
        const t = setTimeout(() => abort.abort('timeout'), 50_000);
        const res = await fetch(`${deepseekBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${deepseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: deepseekModel,
            temperature: 0.3,
            messages,
            max_tokens: 1500,
            response_format: { type: 'json_object' },
          }),
          signal: abort.signal,
        });
        clearTimeout(t);
        if (res.ok) {
          const data = await res.json();
          const c = String(data?.choices?.[0]?.message?.content || '').trim();
          if (c) {
            content = c;
            billingTrack.provider = 'deepseek';
            billingTrack.model = deepseekModel;
            billingTrack.tokens_in = data?.usage?.prompt_tokens ?? 0;
            billingTrack.tokens_out = data?.usage?.completion_tokens ?? 0;
          }
        } else if (res.status === 402) {
          const sketch = buildFallbackSketch(chapterTitle || centralIdea);
          return new Response(
            JSON.stringify({ sketch, warning: 'DeepSeek: solde insuffisant. Croquis de repli.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      } catch (_e) { /* fall through */ }
    }

    // ── Mistral (EU) en dernier repli ───────────────────────────────────────
    if (!content && mistralApiKey) {
      try {
        const abort = new AbortController();
        const t = setTimeout(() => abort.abort('timeout'), 50_000);
        const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${mistralApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: mistralModel,
            temperature: 0.3,
            messages,
            max_tokens: 1500,
            response_format: { type: 'json_object' },
          }),
          signal: abort.signal,
        });
        clearTimeout(t);
        if (res.ok) {
          const data = await res.json();
          const c = String(data?.choices?.[0]?.message?.content || '').trim();
          if (c) {
            content = c;
            billingTrack.provider = 'mistral';
            billingTrack.model = mistralModel;
            billingTrack.tokens_in = data?.usage?.prompt_tokens ?? 0;
            billingTrack.tokens_out = data?.usage?.completion_tokens ?? 0;
          }
        }
      } catch (_e) { /* fall through */ }
    }

    if (!content) {
      const sketch = buildFallbackSketch(chapterTitle || centralIdea);
      return new Response(
        JSON.stringify({ sketch, warning: 'Groq, DeepSeek et Mistral indisponibles. Croquis de repli.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      const sketch = buildFallbackSketch(chapterTitle || centralIdea);
      return new Response(
        JSON.stringify({ sketch, warning: 'Réponse IA non-JSON. Croquis de repli.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let sketch = sanitizeSketch(parsed);

    // Si la sanitisation a tout jeté (LLM hors-format), on renvoie le repli.
    if (!sketch.elements.length) {
      sketch = buildFallbackSketch(chapterTitle || centralIdea);
    }

    // ─── Débit réel post-génération ─────────────────────────────────────────
    let billingInfo: Record<string, unknown> | undefined;
    if (ctx && billingTrack.provider) {
      const debitIn = await debitUsage(ctx, {
        functionName: 'liri-preceptor-course',
        provider: billingTrack.provider,
        model: billingTrack.model,
        unitType: 'tokens_in',
        unitAmount: billingTrack.tokens_in,
        metadata: { chapterTitle },
      });
      const debitOut = await debitUsage(ctx, {
        functionName: 'liri-preceptor-course',
        provider: billingTrack.provider,
        model: billingTrack.model,
        unitType: 'tokens_out',
        unitAmount: billingTrack.tokens_out,
      });
      billingInfo = {
        provider: billingTrack.provider,
        model: billingTrack.model,
        tokens_in: billingTrack.tokens_in,
        tokens_out: billingTrack.tokens_out,
        credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
        balance: debitOut.balance ?? debitIn.balance,
      };
    }

    return new Response(
      JSON.stringify({ sketch, ...(billingInfo ? { _billing: billingInfo } : {}) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
