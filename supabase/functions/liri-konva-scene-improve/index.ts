/// <reference lib="deno.ns" />

/**
 * liri-konva-scene-improve
 * POST — Edge Function Supabase (Deno)
 *
 * Reçoit les objets d'une scène Konva (canvas 1037x750) et retourne
 * une version améliorée : hiérarchie visuelle, positions, tailles,
 * couleurs et équilibre pédagogique optimisés par l'IA.
 *
 * Corps : {
 *   objects: KonvaObject[],
 *   canvas: { width: number, height: number, background: string },
 *   sceneName?: string,
 *   intent?: 'balance' | 'typography' | 'premium' | 'pedagogy'
 * }
 * Réponse : {
 *   objects: KonvaObject[],
 *   canvas?: { background?: string },
 *   provider: string,
 *   suggestions?: string[]
 * }
 */

import { corsHeaders } from '../_shared/cors.ts';
import { aiChatClaudeDeepSeekGrok } from '../_shared/aiClaudeDeepSeekGrok.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';

function jsonResp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseJsonBlock(text: string | null | undefined): unknown {
  if (!text) return null;
  const raw = text.trim();
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m?.[0] || raw);
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `Tu es **Konva Layout Architect**, expert en design pédagogique pour le SmartBoard LIRI.

## Ton rôle
Tu reçois un tableau JSON d'objets Konva (canvas 1037x750px) et tu retournes une version améliorée avec :
- Meilleure hiérarchie visuelle (titre en haut, corps au milieu, détails en bas)
- Positions et dimensions optimisées (marges 40px minimum des bords)
- Tailles de police adaptées (titre 48-72px, sous-titre 28-36px, corps 20-26px)
- Couleurs cohérentes (fond sombre, textes clairs, accents or #D4AF37 ou bleu #60a5fa)
- Équilibre visuel (ne pas empiler tous les éléments au même endroit)
- Lisibilité maximale (un texte = une idée, espace généreux)

## Règles strictes
- Conserver les mêmes IDs d'objets (ne pas en ajouter ni supprimer)
- Respecter le canvas 1037x750 : x entre 0 et 1037, y entre 0 et 750
- Ne jamais sortir des bords (x+width <= 1037, y+height <= 750)
- Le champ "type" de chaque objet ne change JAMAIS
- Le champ "content" ne change PAS (ne pas modifier le texte ni les images)
- Ne modifier que : x, y, width, height, rotation, layer, opacity, style (fill, fontSize, fontFamily, fontStyle, letterSpacing, align, stroke, strokeWidth, cornerRadius)
- Pour les objets "line" : modifier "points" si besoin (tableau [x1,y1,x2,y2])

## Zones logiques du canvas 1037x750
- Header / titre : y 30-160
- Zone principale : y 160-560
- Footer / accent : y 560-710
- Colonne gauche (gauche) : x 40-480
- Colonne droite : x 520-1000

## Sortie JSON stricte (un seul objet JSON, rien avant ni après)
{
  "objects": [ /* tableau complet des objets améliorés, memes IDs */ ],
  "canvas": { "background": "#0b0f1a" },
  "suggestions": [ "1 a 3 conseils courts pour l'enseignant" ]
}
`;

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResp(405, { error: 'Method not allowed' });

  // Auth optionnelle — si token fourni, on valide ; sinon on accepte quand même (outil interne)
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (token) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (supabaseUrl && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: { user }, error } = await admin.auth.getUser(token);
      if (error || !user) return jsonResp(401, { error: 'Invalid token' });
    }
  }

  let body: {
    objects?: unknown[];
    canvas?: { width?: number; height?: number; background?: string };
    sceneName?: string;
    intent?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonResp(400, { error: 'Invalid JSON body' });
  }

  const objects = Array.isArray(body?.objects) ? body.objects : [];
  if (objects.length === 0) {
    return jsonResp(400, { error: 'objects est requis et doit etre non vide.' });
  }

  const canvas = body?.canvas || { width: 1037, height: 750, background: '#0b0f1a' };
  const sceneName = String(body?.sceneName || 'Scene').slice(0, 80);
  const intent = String(body?.intent || 'balance');

  // On limite a 40 objets pour eviter les tokens excessifs
  const safeObjects = objects.slice(0, 40);

  const userContent = `
Scene : "${sceneName}"
Intention : ${intent}
Canvas : ${canvas.width || 1037}x${canvas.height || 750}px, fond : ${canvas.background || '#0b0f1a'}

Objets actuels (JSON) :
${JSON.stringify(safeObjects, null, 2)}

Ameliore le layout de cette scene. Retourne uniquement le JSON ameliore.
`.trim();

  // ─── LIRI Credits — Tenant + preflight ────────────────────────────────
  const ctx = await resolveTenant(req, body);
  if (ctx) {
    const estimate = await estimateLlmCost(ctx, 'deepseek', 'deepseek-chat', SYSTEM_PROMPT + userContent, 6000);
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
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
    max_tokens: 6000,
    temperature: 0.3,
  });

  if (!result.text) {
    return jsonResp(502, { error: 'Pas de reponse IA. Verifiez les cles API.', provider: null });
  }

  const parsed = parseJsonBlock(result.text) as {
    objects?: unknown[];
    canvas?: unknown;
    suggestions?: unknown;
  } | null;

  if (!parsed || !Array.isArray(parsed.objects) || parsed.objects.length === 0) {
    return jsonResp(502, {
      error: 'Reponse IA invalide (pas de tableau objects). Reessayez.',
      provider: result.provider,
      raw: result.text?.slice(0, 400),
    });
  }

  let billingInfo: Record<string, unknown> | undefined;
  if (ctx && result?.usage) {
    const u = result.usage;
    const debitIn = await debitUsage(ctx, {
      functionName: 'liri-konva-scene-improve', provider: u.provider, model: u.model,
      unitType: 'tokens_in', unitAmount: u.tokens_in, metadata: { scene_name: sceneName, intent },
    });
    const debitOut = await debitUsage(ctx, {
      functionName: 'liri-konva-scene-improve', provider: u.provider, model: u.model,
      unitType: 'tokens_out', unitAmount: u.tokens_out,
    });
    billingInfo = {
      provider: u.provider, model: u.model, tokens_in: u.tokens_in, tokens_out: u.tokens_out,
      credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
      balance: debitOut.balance ?? debitIn.balance,
    };
  }

  return jsonResp(200, {
    objects: parsed.objects,
    canvas: parsed.canvas || null,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    provider: result.provider || 'unknown',
    ...(billingInfo ? { _billing: billingInfo } : {}),
  });
});
