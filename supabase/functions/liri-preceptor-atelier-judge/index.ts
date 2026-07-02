/// <reference lib="deno.ns" />

/**
 * liri-preceptor-atelier-judge — Évalue la réponse d'un élève à une question
 * d'atelier du cours « Le Précepteur », et produit une RÉACTION nominative
 * chaleureuse et socratique (façon prof qui réagit à ce que l'élève a vraiment dit).
 *
 * Cascade LLM Groq → DeepSeek → Mistral (même schéma que liri-preceptor-course).
 * Sortie JSON STRICTE :
 *   { "verdict": "ok" | "partial" | "wrong", "ack": string }
 *
 * - verdict est FORCÉ dans l'enum (défaut 'partial' si le modèle divague).
 * - ack est une string trim non vide (sinon fallback générique chaleureux).
 * - Fallback total si aucun LLM ne répond : { verdict:'partial', ack:'Voyons cela ensemble.' }
 *
 * C-3 (REQ-SEC-001) : verify_jwt = false dans config.toml → on exige un user
 * authentifié via requireUser() (la clé anon seule ne suffit pas).
 * Ajouter dans supabase/config.toml :
 *   [functions.liri-preceptor-atelier-judge]
 *   verify_jwt = false
 */
import { corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/requireUser.ts';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Types & sanitisation
// ─────────────────────────────────────────────────────────────────────────────

const VERDICTS = ['ok', 'partial', 'wrong'] as const;
type Verdict = (typeof VERDICTS)[number];
const VERDICT_SET = new Set<string>(VERDICTS);

interface Judgement {
  verdict: Verdict;
  ack: string;
}

/** Réaction de repli chaleureuse quand le modèle ne fournit pas d'ack utilisable. */
const GENERIC_ACK = 'Merci pour ta réponse — avançons ensemble sur cette idée.';
/** Repli TOTAL si aucun LLM ne répond. */
const TOTAL_FALLBACK: Judgement = { verdict: 'partial', ack: 'Voyons cela ensemble.' };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Force le verdict dans l'enum. Défaut 'partial'. */
const normVerdict = (raw: unknown): Verdict => {
  const v = String(raw ?? '').trim().toLowerCase();
  return VERDICT_SET.has(v) ? (v as Verdict) : 'partial';
};

/** ack = string trim non vide (sinon fallback générique chaleureux), longueur bornée. */
const normAck = (raw: unknown): string => {
  const s = String(raw ?? '').trim();
  return s ? s.slice(0, 400) : GENERIC_ACK;
};

/**
 * SANITISE la sortie brute du LLM → Judgement valide.
 * Le modèle range parfois le résultat sous .judgement / .result — on déballe.
 */
function sanitizeJudgement(raw: unknown): Judgement {
  const obj = isObject(raw) ? raw : {};
  const src =
    isObject(obj.judgement) ? (obj.judgement as Record<string, unknown>) :
    isObject(obj.result) ? (obj.result as Record<string, unknown>) :
    obj;
  return {
    verdict: normVerdict(src.verdict),
    ack: normAck(src.ack),
  };
}

/** Normalise un tableau de repères (expectedAnswers / expectedErrors). */
const cleanStringList = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => String(s ?? '').trim())
    .filter((s) => s.length > 0)
    .slice(0, 8)
    .map((s) => s.slice(0, 300));
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt LLM
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = [
  "Tu es « Le Précepteur » : un professeur chaleureux et socratique qui évalue la réponse d'un élève à une question d'atelier.",
  "Ta tâche a DEUX temps :",
  "  1) CLASSER la réponse de l'élève dans EXACTEMENT une des trois catégories :",
  "     - \"ok\"      : l'élève capte l'idée centrale (même formulée avec ses mots).",
  "     - \"partial\" : réponse partielle, intuition juste mais incomplète, ou à moitié sur la piste.",
  "     - \"wrong\"   : contresens, confusion, ou l'erreur typiquement attendue.",
  "  2) Produire une RÉACTION nominative COURTE, adressée à l'élève par son prénom.",
  "",
  "Tu réponds UNIQUEMENT avec du JSON valide, sans markdown, sans texte hors JSON.",
  "SCHÉMA EXACT de sortie :",
  '{ "verdict": "ok" | "partial" | "wrong", "ack": string }',
  "",
  "RÈGLES pour \"ack\" (la réaction) :",
  "  - 2 phrases MAXIMUM. Chaleureuse, encourageante, jamais sèche ni humiliante.",
  "  - Elle s'adresse à l'élève par son prénom quand il est fourni.",
  "  - Elle RÉAGIT à ce que l'élève a VRAIMENT écrit (pas une réponse-type générique).",
  "  - Elle NE RÉCITE PAS la correction complète : le précepteur relance, éclaire, valorise ce qui est juste.",
  "  - VARIÉE : évite les formules toutes faites répétées d'une fois sur l'autre.",
  "  - En français, ton oral et bienveillant.",
  "",
  "REPÈRES : \"expectedAnswers\" et \"expectedErrors\" (s'ils sont fournis) t'aident à situer la réponse.",
  "Sers-t'en comme BOUSSOLE de sens, PAS comme mots-clés à retrouver littéralement : un élève peut avoir raison sans employer les mêmes termes.",
].join('\n');

function buildUserPayload(input: {
  question: string;
  studentAnswer: string;
  studentName: string;
  expectedAnswers: string[];
  expectedErrors: string[];
  hint: string;
  lessonContext: string;
}) {
  return {
    consigne:
      "Classe la réponse de l'élève (ok/partial/wrong) et réagis-lui en 2 phrases max, nominativement, en réagissant à ce qu'il a vraiment dit. Réponds UNIQUEMENT le JSON du schéma.",
    prenom_eleve: input.studentName || undefined,
    question: input.question || undefined,
    reponse_de_l_eleve: input.studentAnswer || undefined,
    reponses_attendues: input.expectedAnswers.length ? input.expectedAnswers : undefined,
    erreurs_attendues: input.expectedErrors.length ? input.expectedErrors : undefined,
    indice: input.hint || undefined,
    contexte_lecon: input.lessonContext || undefined,
    exemple_de_forme_attendue: {
      verdict: 'partial',
      ack: 'Bonne intuition, Léa — tu tiens un vrai bout du fil. Et si tu regardais aussi ce qui se passe juste après ?',
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
    const question = String(body?.question ?? '').trim().slice(0, 2000);
    const studentAnswer = String(body?.studentAnswer ?? body?.student_answer ?? '').trim().slice(0, 3000);
    const studentName = String(body?.studentName ?? body?.student_name ?? '').trim().slice(0, 80);
    const expectedAnswers = cleanStringList(body?.expectedAnswers ?? body?.expected_answers);
    const expectedErrors = cleanStringList(body?.expectedErrors ?? body?.expected_errors);
    const hint = String(body?.hint ?? '').trim().slice(0, 600);
    const lessonContext = String(body?.lessonContext ?? body?.lesson_context ?? '').trim().slice(0, 4000);

    if (!studentAnswer) {
      return new Response(
        JSON.stringify({ error: 'Payload requis : studentAnswer (la réponse de l’élève)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userPayload = buildUserPayload({
      question,
      studentAnswer,
      studentName,
      expectedAnswers,
      expectedErrors,
      hint,
      lessonContext,
    });
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(userPayload) },
    ];

    // ─── LIRI Credits — Tenant + preflight ──────────────────────────────────
    const ctx = await resolveTenant(req, body);
    if (ctx) {
      const promptText = SYSTEM_PROMPT + JSON.stringify(userPayload);
      const estimate = await estimateLlmCost(ctx, 'groq', 'llama-3.3-70b-versatile', promptText, 400);
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
            temperature: 0.6,
            messages,
            max_tokens: 400,
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
            temperature: 0.6,
            messages,
            max_tokens: 400,
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
          return new Response(
            JSON.stringify({ ...TOTAL_FALLBACK, warning: 'DeepSeek: solde insuffisant. Réaction de repli.' }),
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
            temperature: 0.6,
            messages,
            max_tokens: 400,
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
      return new Response(
        JSON.stringify({ ...TOTAL_FALLBACK, warning: 'Groq, DeepSeek et Mistral indisponibles. Réaction de repli.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      return new Response(
        JSON.stringify({ ...TOTAL_FALLBACK, warning: 'Réponse IA non-JSON. Réaction de repli.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const judgement = sanitizeJudgement(parsed);

    // ─── Débit réel post-génération ─────────────────────────────────────────
    let billingInfo: Record<string, unknown> | undefined;
    if (ctx && billingTrack.provider) {
      const debitIn = await debitUsage(ctx, {
        functionName: 'liri-preceptor-atelier-judge',
        provider: billingTrack.provider,
        model: billingTrack.model,
        unitType: 'tokens_in',
        unitAmount: billingTrack.tokens_in,
        metadata: { verdict: judgement.verdict },
      });
      const debitOut = await debitUsage(ctx, {
        functionName: 'liri-preceptor-atelier-judge',
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
      JSON.stringify({ ...judgement, ...(billingInfo ? { _billing: billingInfo } : {}) }),
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
