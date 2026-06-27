/// <reference lib="deno.ns" />

/**
 * Analyse d’un segment vidéo (WebM/MP4) stocké dans Storage `liri-vision-temp`.
 * Téléchargement côté serveur + Gemini (inline_data) — pas de WebRTC : traitement fichier comme pipeline « vidéo serveur ».
 */
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

  let body: { storagePath?: string; centralIdea?: string; lang?: string; deleteAfter?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const rawPath = String(body?.storagePath || '').trim().replace(/^\/+/, '');
  if (!rawPath) return json(400, { error: 'storagePath requis' });
  if (rawPath.includes('..')) return json(400, { error: 'Chemin invalide' });
  if (!rawPath.startsWith(`${user.id}/`)) {
    return json(403, { error: 'Accès refusé à ce fichier' });
  }

  const geminiKey = String(Deno.env.get('GEMINI_API_KEY') || '').trim();
  if (!geminiKey) {
    return json(503, {
      error: 'GEMINI_API_KEY manquant pour l’analyse vidéo serveur.',
    });
  }

  const { data: fileData, error: dlErr } = await admin.storage
    .from('liri-vision-temp')
    .download(rawPath);

  if (dlErr || !fileData) {
    return json(404, { error: dlErr?.message || 'Fichier introuvable' });
  }

  const ab = await fileData.arrayBuffer();
  if (ab.byteLength < 2000) {
    return json(400, { error: 'Vidéo trop courte ou vide' });
  }
  /** ~18 Mo binaire — limite prudente pour Edge + Gemini inline */
  if (ab.byteLength > 18 * 1024 * 1024) {
    return json(413, { error: 'Vidéo trop volumineuse (réduire la durée ou la qualité).' });
  }

  const bytes = new Uint8Array(ab);
  const ext = rawPath.split('.').pop()?.toLowerCase() || 'webm';
  const mime =
    ext === 'mp4' ? 'video/mp4' : 'video/webm';

  const b64 = encodeBase64(bytes);
  const lang = String(body?.lang || 'fr').trim();
  const idea = String(body?.centralIdea || '').trim();

  const prompt =
    lang === 'en'
      ? `You are the LIRI SmartBoard copilot. This is a short screen/camera recording. Describe what happens (context, objects, text if readable) in 4–6 sentences. Then suggest 2 ways to use it in a teaching slide.${idea ? `\n\nAuthor focus: ${idea.slice(0, 600)}` : ''}\n\nReply in English.`
      : `Tu es le Copilot SmartBoard LIRI. Voici un très court enregistrement vidéo (cadre caméra ou écran). Décris ce qui se passe (contexte, objets, texte lisible) en 4 à 6 phrases. Puis propose 2 pistes pour une slide pédagogique.${idea ? `\n\nIntention / idée centrale : ${idea.slice(0, 600)}` : ''}\n\nRéponds en français.`;

  const model = String(Deno.env.get('GEMINI_VISION_MODEL') || '').trim() || 'gemini-2.0-flash';

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;

  const geminiRes = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mime,
                data: b64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 1200,
      },
    }),
  });

  const geminiJson = (await geminiRes.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (!geminiRes.ok) {
    const msg = geminiJson?.error?.message || `Gemini HTTP ${geminiRes.status}`;
    return json(502, { error: msg });
  }

  const text = geminiJson?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || '')
    .join('')
    .trim();

  if (!text) {
    return json(502, { error: 'Réponse Gemini vide' });
  }

  if (body?.deleteAfter !== false) {
    await admin.storage.from('liri-vision-temp').remove([rawPath]);
  }

  // ─── LIRI Credits — Débit Gemini Vision ────────────────────────────────
  const { resolveTenant, debitUsage } = await import('../_shared/aiBilling.ts');
  const billingCtx = await resolveTenant(req, body);
  if (billingCtx) {
    // Gating palier : Smartboard IA réservé aux forfaits LIRI (refus 403 en gratuit).
    const { checkSmartboardAiAccess } = await import('../_shared/checkSmartboardAiAccess.ts');
    const deny = await checkSmartboardAiAccess(billingCtx);
    if (deny) return deny;
  }
  let _billing: Record<string, unknown> | null = null;
  if (billingCtx) {
    // Estimation : image ~ 1500 tokens, prompt + output
    const estInTokens = 1500 + Math.ceil((text.length + 200) / 4);
    const estOutTokens = Math.ceil(text.length / 4);
    await debitUsage(billingCtx, { functionName: 'liri-smartboard-vision-segment', provider: 'google', model, unitType: 'tokens_in', unitAmount: estInTokens, metadata: { image_kb: Math.round(b64.length/1024) } });
    const d = await debitUsage(billingCtx, { functionName: 'liri-smartboard-vision-segment', provider: 'google', model, unitType: 'tokens_out', unitAmount: estOutTokens });
    _billing = { provider: 'google', model, tokens_in: estInTokens, tokens_out: estOutTokens, credits_charged: d.charged, balance: d.balance };
  }

  return json(200, { description: text, provider: 'gemini', model, _billing });
});
