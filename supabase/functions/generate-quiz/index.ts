/// <reference lib="deno.ns" />

import { corsHeaders } from '../_shared/cors.ts';
import {
  resolveTenant,
  preflightCheck,
  debitUsage,
  estimateLlmCost,
} from '../_shared/aiBilling.ts';

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // @ts-ignore - Deno runtime
    const groqKey = Deno.env.get('GROQ_API_KEY') || '';
    // @ts-ignore - Deno runtime
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
    // @ts-ignore - Deno runtime
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY') || '';

    if (!groqKey && !openaiKey && !deepseekKey) {
      return new Response(JSON.stringify({ error: 'Missing API keys' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const nodeLabel: string = String(body?.nodeLabel || '').trim();
    const nodeSummary: string = String(body?.nodeSummary || '').trim();
    const videoTitle: string = String(body?.videoTitle || '').trim();
    const nodeExplanation: string = String(body?.nodeExplanation || '').trim();

    if (!nodeLabel) {
      return new Response(JSON.stringify({ error: 'nodeLabel is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const context = [
      nodeSummary && `Résumé : ${nodeSummary}`,
      nodeExplanation && `Explication : ${nodeExplanation.slice(0, 800)}`,
    ].filter(Boolean).join('\n');

    // ─── LIRI Credits — Tenant + preflight ────────────────────────────────
    const ctx = await resolveTenant(req, body);
    if (!ctx) {
      return new Response(JSON.stringify({
        error: 'TENANT_NOT_RESOLVED',
        message: 'Fournissez X-Liri-Api-Key, X-Tenant-Slug ou un JWT user authentifié',
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Estimation preflight basée sur la longueur du prompt (Groq par défaut)
    const promptText = nodeLabel + nodeSummary + nodeExplanation + videoTitle;
    const estimate = await estimateLlmCost(ctx, 'groq', 'llama-3.3-70b-versatile', promptText, 600);
    const reject = await preflightCheck(ctx, estimate);
    if (reject) {
      const errBody = await reject.json();
      return new Response(JSON.stringify(errBody), {
        status: reject.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const system =
      'Tu génères une question pédagogique à choix multiples en français, basée UNIQUEMENT sur le contenu fourni. ' +
      'Output ONLY valid JSON, no markdown. ' +
      'Schema strict : { ' +
      '"question": string (question claire et précise), ' +
      '"choices": [string, string, string, string] (4 options A/B/C/D, une seule correcte), ' +
      '"correctIndex": number (0-3, index de la bonne réponse), ' +
      '"explanation": string (explication de la bonne réponse en 2-3 phrases, issue du contenu fourni), ' +
      '"difficulty": "facile"|"moyen"|"difficile" ' +
      '} ' +
      'RÈGLES : la question doit tester la compréhension réelle du concept, pas juste la mémorisation. ' +
      'Les 3 mauvaises réponses doivent être plausibles. Tout en français.';

    const userPrompt = {
      concept: nodeLabel,
      courseTitle: videoTitle || undefined,
      content: context || `Concept du cours : ${nodeLabel}`,
      instruction: 'Génère une question à choix multiples rigoureuse sur ce concept.',
    };

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(userPrompt) },
    ];

    // Tracking provider/usage utilisé pour le débit réel après l'appel
    const billingTrack: { provider: string; model: string; tokens_in: number; tokens_out: number } = {
      provider: '', model: '', tokens_in: 0, tokens_out: 0,
    };

    const callGroq = async () => {
      const abort = new AbortController();
      const t = setTimeout(() => abort.abort('timeout'), 30_000);
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.4,
            messages,
            max_tokens: 600,
            response_format: { type: 'json_object' },
          }),
          signal: abort.signal,
        });
        clearTimeout(t);
        if (!res.ok) return null;
        const data = await res.json();
        billingTrack.provider = 'groq';
        billingTrack.model = 'llama-3.3-70b-versatile';
        billingTrack.tokens_in = data?.usage?.prompt_tokens ?? 0;
        billingTrack.tokens_out = data?.usage?.completion_tokens ?? 0;
        return String(data?.choices?.[0]?.message?.content || '').trim() || null;
      } catch (_) {
        clearTimeout(t);
        return null;
      }
    };

    const callOpenAI = async () => {
      if (!openaiKey) return null;
      const abort = new AbortController();
      const t = setTimeout(() => abort.abort('timeout'), 30_000);
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.4,
            messages,
            max_tokens: 600,
            response_format: { type: 'json_object' },
          }),
          signal: abort.signal,
        });
        clearTimeout(t);
        if (!res.ok) return null;
        const data = await res.json();
        billingTrack.provider = 'openai';
        billingTrack.model = 'gpt-4o-mini';
        billingTrack.tokens_in = data?.usage?.prompt_tokens ?? 0;
        billingTrack.tokens_out = data?.usage?.completion_tokens ?? 0;
        return String(data?.choices?.[0]?.message?.content || '').trim() || null;
      } catch (_) {
        clearTimeout(t);
        return null;
      }
    };

    const callDeepSeek = async () => {
      if (!deepseekKey) return null;
      const abort = new AbortController();
      const t = setTimeout(() => abort.abort('timeout'), 30_000);
      try {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${deepseekKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'deepseek-chat',
            temperature: 0.4,
            messages,
            max_tokens: 600,
            response_format: { type: 'json_object' },
          }),
          signal: abort.signal,
        });
        clearTimeout(t);
        if (!res.ok) return null;
        const data = await res.json();
        billingTrack.provider = 'deepseek';
        billingTrack.model = 'deepseek-chat';
        billingTrack.tokens_in = data?.usage?.prompt_tokens ?? 0;
        billingTrack.tokens_out = data?.usage?.completion_tokens ?? 0;
        return String(data?.choices?.[0]?.message?.content || '').trim() || null;
      } catch (_) {
        clearTimeout(t);
        return null;
      }
    };

    let content = await callGroq();
    if (!content) content = await callOpenAI();
    if (!content) content = await callDeepSeek();

    if (!content) {
      return new Response(JSON.stringify({ error: 'LLM unavailable' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Invalid JSON from LLM' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const question = String(parsed?.question || '').trim();
    const choices = Array.isArray(parsed?.choices)
      ? (parsed.choices as unknown[]).map(String).slice(0, 4)
      : [];
    const correctIndex = Number.isInteger(parsed?.correctIndex)
      ? Math.min(Math.max(Number(parsed.correctIndex), 0), 3)
      : 0;
    const explanation = String(parsed?.explanation || '').trim();
    const difficulty = ['facile', 'moyen', 'difficile'].includes(String(parsed?.difficulty))
      ? String(parsed.difficulty)
      : 'moyen';

    if (!question || choices.length < 4) {
      return new Response(JSON.stringify({ error: 'Incomplete quiz data from LLM' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── LIRI Credits — Débit atomique avec l'usage réel ───────────────────
    if (billingTrack.provider) {
      // Débit input tokens
      const debitIn = await debitUsage(ctx, {
        functionName: 'generate-quiz',
        provider: billingTrack.provider,
        model: billingTrack.model,
        unitType: 'tokens_in',
        unitAmount: billingTrack.tokens_in,
        metadata: { node_label: nodeLabel, video_title: videoTitle },
      });
      // Débit output tokens
      const debitOut = await debitUsage(ctx, {
        functionName: 'generate-quiz',
        provider: billingTrack.provider,
        model: billingTrack.model,
        unitType: 'tokens_out',
        unitAmount: billingTrack.tokens_out,
      });

      return new Response(
        JSON.stringify({
          question, choices, correctIndex, explanation, difficulty,
          _billing: {
            provider: billingTrack.provider,
            model: billingTrack.model,
            tokens_in: billingTrack.tokens_in,
            tokens_out: billingTrack.tokens_out,
            credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
            balance: debitOut.balance ?? debitIn.balance,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ question, choices, correctIndex, explanation, difficulty }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
