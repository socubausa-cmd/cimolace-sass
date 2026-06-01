/// <reference lib="deno.ns" />

/**
 * LONGIA — assistance rédactionnelle pour le studio document administratif (secrétariat).
 * Modes : 5 propositions, paragraphe composé, texte intelligent (adaptation au sujet).
 */
import { corsHeaders } from '../_shared/cors.ts';
import { aiChat, type AiUsageInfo } from '../_shared/aiClaudeDeepSeekGrok.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseNumberedLines(text: string, max = 5): string[] {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: string[] = [];
  const numRe = /^\d+[\.\)]\s*(.+)$/;
  for (const l of lines) {
    const m = l.match(numRe);
    if (m?.[1]) {
      out.push(m[1].trim());
      if (out.length >= max) break;
    }
  }
  if (out.length >= 3) return out.slice(0, max);
  const fallback = lines.filter((l) => l.length > 12 && !/^(voici|propositions)/i.test(l));
  return fallback.slice(0, max);
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Missing Authorization' });

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return json(401, { error: 'Invalid token' });

  let body: {
    mode?: string;
    documentTitle?: string;
    topicHint?: string;
    selection?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const mode = String(body?.mode || 'suggestions').trim();
  const documentTitle = String(body?.documentTitle || 'Document sans titre').trim().slice(0, 200);
  const topicHint = String(body?.topicHint || '').trim().slice(0, 800);
  const selection = String(body?.selection || '').trim().slice(0, 4000);

  // ─── LIRI Credits — Tenant + preflight ────────────────────────────────
  const ctx = await resolveTenant(req, body);
  if (ctx) {
    const preflightText = documentTitle + topicHint + selection;
    const estimate = await estimateLlmCost(ctx, 'deepseek', 'deepseek-chat', preflightText, 900);
    const reject = await preflightCheck(ctx, estimate);
    if (reject) {
      const errBody = await reject.json();
      return new Response(JSON.stringify(errBody), {
        status: reject.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  async function billAndPack(payload: Record<string, unknown>, usage: AiUsageInfo | undefined): Promise<Record<string, unknown>> {
    if (!ctx || !usage) return payload;
    const debitIn = await debitUsage(ctx, {
      functionName: 'longia-admin-document', provider: usage.provider, model: usage.model,
      unitType: 'tokens_in', unitAmount: usage.tokens_in, metadata: { mode },
    });
    const debitOut = await debitUsage(ctx, {
      functionName: 'longia-admin-document', provider: usage.provider, model: usage.model,
      unitType: 'tokens_out', unitAmount: usage.tokens_out,
    });
    return {
      ...payload,
      _billing: {
        provider: usage.provider, model: usage.model,
        tokens_in: usage.tokens_in, tokens_out: usage.tokens_out,
        credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
        balance: debitOut.balance ?? debitIn.balance,
      },
    };
  }

  const system = `Tu es LONGIA, assistant expert en rédaction administrative pour une école, une association ou une organisation professionnelle.
Style : français, ton sobre, précis, respectueux, sans familiarité. Pas de markdown. Pas d’emojis. Pas de guillemets englobant tout le bloc.`;

  try {
    if (mode === 'suggestions') {
      const userPrompt = `Document (titre de dossier) : « ${documentTitle} »
Consigne ou thème : ${topicHint || 'non précisé — reste générique mais utile pour un document administratif'}

Propose exactement 5 formulations DISTINCTES que l’utilisateur peut coller dans son document. Varie les natures :
- une ligne type titre de section ou objet ;
- une phrase de transition ;
- un court paragraphe argumentatif (2 phrases) ;
- une formule de courtoisie ou de clôture courte ;
- une phrase avec date / référence / suite à donner.

Format OBLIGATOIRE : une ligne par proposition, numérotée exactement ainsi :
1. ...
2. ...
3. ...
4. ...
5. ...`;

      const { text, provider, usage } = await aiChat({
        system,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 900,
        temperature: 0.55,
      });
      if (!text) return json(200, { suggestions: [], provider: null, fallback: true });
      const suggestions = parseNumberedLines(text, 5);
      return json(200, await billAndPack({ suggestions, provider }, usage));
    }

    if (mode === 'compose') {
      const userPrompt = `Rédige un seul paragraphe administratif (4 à 7 phrases) pour introduire ou structurer le propos, dans le cadre du document intitulé « ${documentTitle} ».
Thème ou intention : ${topicHint || 'rédaction générale du dossier.'}
Ne cite pas ce prompt. Texte continu, sans titre ni numérotation.`;

      const { text, provider, usage } = await aiChat({
        system,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 600,
        temperature: 0.45,
      });
      const result = (text || '').trim();
      return json(200, await billAndPack({ result: result || '', provider }, usage));
    }

    if (mode === 'intelligent') {
      if (!selection && !topicHint) {
        return json(400, { error: 'Sélectionnez du texte ou saisissez un thème.' });
      }
      const userPrompt = `Document : « ${documentTitle} »
${selection ? `Texte à adapter ou à enrichir :\n"""${selection}"""\n` : ''}
${topicHint ? `Thème ou consigne complémentaire : ${topicHint}\n` : ''}
Réécris en style administratif clair et fluide (une ou plusieurs phrases selon le besoin). Conserve le fond et les faits.`;

      const { text, provider, usage } = await aiChat({
        system,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 900,
        temperature: 0.4,
      });
      const result = (text || '').trim();
      return json(200, await billAndPack({ result: result || '', provider }, usage));
    }

    return json(400, { error: 'mode inconnu (suggestions | compose | intelligent)' });
  } catch (err) {
    console.error('[longia-admin-document]', (err as Error)?.message);
    return json(500, { error: 'Erreur IA', details: (err as Error)?.message });
  }
});
