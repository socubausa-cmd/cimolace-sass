/// <reference lib="deno.ns" />

/**
 * neuro-recall-bootstrap — « le neurone » post-live.
 *
 * Déclenché (NON bloquant, catch muet) à la fin d'un live par
 * `apps/app/src/features/live/hooks/useLiveHostSessionStop.js`
 * (`supabase.functions.invoke('neuro-recall-bootstrap', { body: { sessionId } })`).
 *
 * À partir du chat (`live_session_chat`) + des questions (`live_questions`) de la
 * session, il :
 *   1) génère un RÉCAP IA structuré (résumé + points clés + Q&R) via le helper LLM
 *      partagé `aiChatClaudeDeepSeekGrok` (même provider/billing que neuronq-reformulate) ;
 *   2) écrit `live_session_summaries` (réveille la page post-live) — upsert idempotent
 *      par `session_id` (clé UNIQUE) ;
 *   3) PUBLIE un message « Récap du live » dans le Sujet de forum du live
 *      (`conversations` kind='topic', context_type='live') — find-or-create idempotent,
 *      anti-doublon (on ne reposte pas si un récap est déjà présent).
 *
 * Idempotent : si le récap existe déjà (`ai_summary` présent), on le RÉUTILISE (pas de
 * 2e appel LLM) et on s'assure seulement que le message forum est présent. Service_role
 * (bypass RLS) ; le tenant des écritures = `live_sessions.tenant_id` (autorité).
 */

import { corsHeaders } from '../_shared/cors.ts';
import { aiChatClaudeDeepSeekGrok } from '../_shared/aiClaudeDeepSeekGrok.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  resolveTenant,
  preflightCheck,
  debitUsage,
  estimateLlmCost,
} from '../_shared/aiBilling.ts';

const RECAP_PREFIX = '📋 Récap du live'; // marqueur d'idempotence du message forum

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Décode le payload d'un JWT déjà validé par la passerelle (verify_jwt) : { sub, role, … }. */
function jwtClaims(token: string | null): { sub?: string; role?: string } | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/** Parse JSON tolérant : retire d'éventuelles barrières ```json … ``` puis JSON.parse. */
function safeParseJson(raw: string | null | undefined): any | null {
  if (!raw) return null;
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Compose le texte du message « Récap du live » publié dans le Sujet du forum. */
function buildRecapContent(
  title: string,
  summary: string,
  keyPoints: string[],
  qa: Array<{ question?: string; answer?: string }>,
): string {
  const lines: string[] = [`${RECAP_PREFIX} — ${title}`, '', summary.trim()];
  if (keyPoints.length) {
    lines.push('', 'Points clés :');
    for (const p of keyPoints) lines.push(`• ${String(p).trim()}`);
  }
  const cleanQa = (qa || []).filter((x) => x && String(x.question || '').trim());
  if (cleanQa.length) {
    lines.push('', 'Questions de la session :');
    for (const x of cleanQa.slice(0, 12)) {
      lines.push(`• ${String(x.question).trim()}`);
      if (x.answer && String(x.answer).trim()) lines.push(`  ↳ ${String(x.answer).trim()}`);
    }
  }
  lines.push('', '— généré automatiquement par le neurone à la fin du live.');
  return lines.join('\n');
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // @ts-ignore Deno
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  // @ts-ignore Deno
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const admin = createClient(supabaseUrl, serviceKey);
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let body: { sessionId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  const sessionId = String(body?.sessionId || '').trim();
  if (!sessionId) return json(400, { error: 'sessionId requis' });

  // ── 1. Session live (autorité tenant + métadonnées) ──────────────────────
  const { data: session } = await admin
    .from('live_sessions')
    .select('id, tenant_id, host_user_id, teacher_id, title')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return json(404, { error: 'Session live introuvable' });
  const tenantId = session.tenant_id as string;
  const hostId = session.host_user_id as string;
  const title = (session.title as string) || 'Live';

  // ── 1bis. Autorisation : hôte / encadrant de la session, ou appel SYSTÈME ─
  // (service_role). Le neurone est déclenché par l'hôte à la fin du live (JWT
  // user du front). On refuse qu'un simple authentifié déclenche le récap d'une
  // session qui n'est pas la sienne (le récap consomme du LLM + poste au forum).
  const claims = jwtClaims(token);
  const isServiceRole = claims?.role === 'service_role';
  if (!isServiceRole) {
    if (!token) return json(401, { error: 'Authentification requise' });
    const callerId = typeof claims?.sub === 'string' ? claims.sub : null;
    if (!callerId) return json(401, { error: 'Token invalide' });
    let allowed =
      session.host_user_id === callerId || (session as any).teacher_id === callerId;
    if (!allowed) {
      const { data: mem } = await admin
        .from('tenant_memberships')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('user_id', callerId)
        .maybeSingle();
      allowed = ['owner', 'admin', 'teacher'].includes(String(mem?.role || ''));
    }
    if (!allowed) {
      return json(403, { error: "Réservé à l'hôte ou à un encadrant de la session" });
    }
  }

  // ── 2. Récap déjà produit ? (idempotence de génération) ──────────────────
  const { data: existing } = await admin
    .from('live_session_summaries')
    .select('ai_summary, key_points')
    .eq('session_id', sessionId)
    .maybeSingle();

  // ── 3. Lecture du chat + des questions ───────────────────────────────────
  const { data: chat } = await admin
    .from('live_session_chat')
    .select('message, created_at')
    .eq('live_session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(500);
  const { data: questions } = await admin
    .from('live_questions')
    .select('content, answer')
    .eq('live_session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(200);

  const chatLines = (chat || []).map((c: any) => String(c.message || '').trim()).filter(Boolean);
  const qList = (questions || []) as Array<{ content?: string; answer?: string }>;
  const questionsTotal = qList.length;
  const questionsAnswered = qList.filter((x) => x.answer && String(x.answer).trim()).length;

  // Pas de matière ET pas de récap pré-existant → rien à faire.
  if (!existing?.ai_summary && chatLines.length === 0 && questionsTotal === 0) {
    return json(200, { ok: true, skipped: 'no_content' });
  }

  // ── 4. Génération IA (ou réutilisation) ──────────────────────────────────
  let aiSummary = String(existing?.ai_summary || '').trim();
  let keyPoints: string[] = Array.isArray(existing?.key_points) ? (existing!.key_points as string[]) : [];
  let qa: Array<{ question?: string; answer?: string }> = [];
  let provider: string | null = null;
  let summarizedNow = false;

  if (!aiSummary) {
    const chatBlock = chatLines.slice(-200).join('\n').slice(0, 8000);
    const qBlock = qList
      .map((x) => `Q: ${String(x.content || '').trim()}${x.answer && String(x.answer).trim() ? `\nR: ${String(x.answer).trim()}` : ''}`)
      .join('\n\n')
      .slice(0, 6000);

    const system =
      "Tu es « le neurone », l'assistant de récap post-live de Prorascience. À partir du chat et des questions d'une session live, produis un récapitulatif clair et utile pour les élèves qui le liront dans le forum APRÈS le live. " +
      'Réponds UNIQUEMENT par un objet JSON valide, sans aucun texte autour, au format exact : ' +
      '{"summary": string, "keyPoints": string[], "qa": [{"question": string, "answer": string}]}. ' +
      'Langue : français. summary = 2 à 4 phrases. keyPoints = 3 à 6 points essentiels abordés. ' +
      'qa = les questions importantes avec une réponse synthétique (si la question est restée sans réponse, propose une réponse brève et termine par " (synthèse IA)").';
    const userContent =
      `Titre du live : ${title}\n\n--- CHAT DU LIVE ---\n${chatBlock || '(aucun message)'}\n\n--- QUESTIONS ---\n${qBlock || '(aucune question)'}\n\nProduis le récap JSON.`;
    const max_tokens = 1200;

    // Billing best-effort (comme neuronq-reformulate) : ne bloque pas si pas de tenant.
    const ctx = await resolveTenant(req, body);
    if (ctx) {
      const estimate = await estimateLlmCost(ctx, 'deepseek', 'deepseek-chat', system + userContent, max_tokens);
      const reject = await preflightCheck(ctx, estimate);
      if (reject) {
        const errBody = await reject.json();
        return new Response(JSON.stringify(errBody), {
          status: reject.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const result = await aiChatClaudeDeepSeekGrok({
      system,
      messages: [{ role: 'user', content: userContent }],
      max_tokens,
      temperature: 0.4,
    });
    provider = result.provider;
    const parsed = safeParseJson(result.text);
    aiSummary = String(parsed?.summary || result.text || '').trim().slice(0, 4000);
    keyPoints = Array.isArray(parsed?.keyPoints) ? parsed.keyPoints.slice(0, 8).map((p: unknown) => String(p)) : [];
    qa = Array.isArray(parsed?.qa) ? parsed.qa : [];
    summarizedNow = true;

    // 5. Upsert du résumé (réveille la page post-live).
    await admin
      .from('live_session_summaries')
      .upsert(
        {
          session_id: sessionId,
          host_id: hostId,
          ai_summary: aiSummary,
          key_points: keyPoints,
          questions_total: questionsTotal,
          questions_answered: questionsAnswered,
        },
        { onConflict: 'session_id' },
      );

    // Débit crédits LIRI (best-effort).
    if (ctx && result.usage) {
      await debitUsage(ctx, {
        functionName: 'neuro-recall-bootstrap',
        provider: result.usage.provider,
        model: result.usage.model,
        unitType: 'tokens_in',
        unitAmount: result.usage.tokens_in,
        sessionId,
      });
      await debitUsage(ctx, {
        functionName: 'neuro-recall-bootstrap',
        provider: result.usage.provider,
        model: result.usage.model,
        unitType: 'tokens_out',
        unitAmount: result.usage.tokens_out,
        sessionId,
      });
    }
  }

  if (!aiSummary) return json(200, { ok: true, skipped: 'empty_summary' });

  // ── 6. Find-or-create le Sujet de forum du live ──────────────────────────
  let topicId: string | null = null;
  const found = await admin
    .from('conversations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('kind', 'topic')
    .eq('context_type', 'live')
    .eq('context_id', sessionId)
    .maybeSingle();
  if (found.data?.id) {
    topicId = found.data.id as string;
  } else {
    const subject = `Sujet du live — ${title}`;
    const ins = await admin
      .from('conversations')
      .insert({
        tenant_id: tenantId,
        kind: 'topic',
        type: 'group',
        name: subject,
        subject,
        status: 'open',
        visibility: 'context',
        context_type: 'live',
        context_id: sessionId,
        created_by: hostId,
      })
      .select('id')
      .maybeSingle();
    if (ins.data?.id) {
      topicId = ins.data.id as string;
    } else {
      // Course (23505 sur l'index unique) → on relit l'existant.
      const re = await admin
        .from('conversations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('kind', 'topic')
        .eq('context_type', 'live')
        .eq('context_id', sessionId)
        .maybeSingle();
      topicId = re.data?.id ?? null;
    }
  }

  // ── 7. Publier le message « Récap du live » (anti-doublon) ───────────────
  let posted = false;
  if (topicId) {
    const { data: dup } = await admin
      .from('messages')
      .select('id')
      .eq('conversation_id', topicId)
      .ilike('content', `${RECAP_PREFIX}%`)
      .limit(1)
      .maybeSingle();
    if (!dup) {
      const content = buildRecapContent(title, aiSummary, keyPoints, qa);
      const { error: msgErr } = await admin.from('messages').insert({
        tenant_id: tenantId,
        conversation_id: topicId,
        sender_id: hostId,
        recipient_id: null,
        content,
      });
      if (!msgErr) {
        posted = true;
        await admin
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', topicId);
      }
    }
  }

  // ── 8. Flashcards : un deck de révision par PARTICIPANT (à partir des Q&R) ─
  // Modèle recall_decks/recall_cards = per-user (chaque élève révise SON deck avec
  // son propre état de répétition espacée). On crée donc, une seule fois (à la
  // génération), un deck par participant effectif du live, garni des cartes Q→R.
  // Idempotent : on saute un participant qui a déjà un deck pour ce live.
  let decksCreated = 0;
  const cards = (qa || [])
    .filter((x) => x && String(x.question || '').trim() && String(x.answer || '').trim())
    .slice(0, 30)
    .map((x) => ({
      question: String(x.question).trim().slice(0, 1000),
      answer: String(x.answer).trim().slice(0, 2000),
    }));
  if (summarizedNow && cards.length) {
    const { data: parts } = await admin
      .from('live_session_participants')
      .select('user_id')
      .eq('live_session_id', sessionId)
      .limit(300);
    const deckTitle = `Révision — ${title}`;
    const userIds = [
      ...new Set(
        (parts || [])
          .map((p: any) => p.user_id as string)
          .filter((uid) => uid && uid !== hostId),
      ),
    ];
    for (const uid of userIds) {
      const { data: existingDeck } = await admin
        .from('recall_decks')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', uid)
        .eq('title', deckTitle)
        .maybeSingle();
      if (existingDeck) continue;
      const { data: deck } = await admin
        .from('recall_decks')
        .insert({ tenant_id: tenantId, user_id: uid, title: deckTitle })
        .select('id')
        .maybeSingle();
      if (!deck?.id) continue;
      const { error: cardsErr } = await admin
        .from('recall_cards')
        .insert(cards.map((c) => ({ tenant_id: tenantId, deck_id: deck.id, ...c })));
      if (!cardsErr) decksCreated++;
    }
  }

  return json(200, {
    ok: true,
    summarized: summarizedNow,
    posted,
    decksCreated,
    cardsPerDeck: cards.length,
    topicId,
    questionsTotal,
    questionsAnswered,
    provider,
  });
});
