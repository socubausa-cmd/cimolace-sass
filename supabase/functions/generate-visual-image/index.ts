/// <reference lib="deno.ns" />

import { corsHeaders } from '../_shared/cors.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CACHE_BUCKET = 'visual-cache';
const CANVAS_BUCKET = 'smartboard-canvas';

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function resolveUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return null;
  const jwt = authHeader.slice(7).trim();
  if (!jwt) return null;
  // @ts-ignore Deno
  const url = Deno.env.get('SUPABASE_URL')!;
  // @ts-ignore Deno
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error } = await client.auth.getUser(jwt);
  if (error || !user?.id) return null;
  return user.id;
}

function jsonResponse(obj: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function ensureDbRow(
  admin: SupabaseClient,
  userId: string,
  bucket: string,
  path: string,
  prompt: string,
  imageSize: string,
  source: string,
): Promise<string | null> {
  const { data: existing } = await admin
    .from('designer_ia_images')
    .select('id')
    .eq('user_id', userId)
    .eq('storage_path', path)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: ins, error } = await admin
    .from('designer_ia_images')
    .insert({
      user_id: userId,
      storage_bucket: bucket,
      storage_path: path,
      prompt: prompt.slice(0, 65535),
      size: imageSize,
      source,
    })
    .select('id')
    .single();
  if (error) {
    console.error('designer_ia_images insert', error);
    return null;
  }
  return (ins?.id as string) ?? null;
}

/** Formats Designer → aspect Imagen (Gemini API). */
function sizeToImagenAspectRatio(size: string): string {
  if (size === '1792x1024') return '16:9';
  if (size === '1024x1792') return '9:16';
  return '1:1';
}

function extractImagenBase64(json: Record<string, unknown>): string | null {
  const preds = json?.predictions;
  if (!Array.isArray(preds) || !preds[0]) return null;
  const p = preds[0] as Record<string, unknown>;
  if (typeof p.bytesBase64Encoded === 'string') return p.bytesBase64Encoded;
  if (typeof p.bytes_base64_encoded === 'string') return p.bytes_base64_encoded;
  const img = (p.generatedImage ?? p.image) as Record<string, unknown> | undefined;
  if (img && typeof img === 'object') {
    if (typeof img.bytesBase64Encoded === 'string') return img.bytesBase64Encoded;
    if (typeof img.imageBytes === 'string') return img.imageBytes;
  }
  return null;
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

/** Suffixe envoyé au moteur image — aligné LIRI IMAGE MASTER (scène réelle, pas diagramme parasites). */
function appendLiriDirectorSuffix(prompt: string): string {
  const marker = '\n--- LIRI director constraints ---\n';
  if (prompt.includes('--- LIRI director constraints ---')) return prompt;
  return (
    prompt +
    marker +
    'Apply unless the user prompt above explicitly contradicts: prioritize ONE strong cinematic real-world scene with a human subject or clear ritual/educational action; visible emotion; dramatic directional light; believable place or ritual context; clear typographic hierarchy when text appears. ' +
    'Do NOT add unsolicited abstract diagrams, decorative circle arrays, generic icon clutter, or multi-panel infographic triptychs unless the user explicitly asked for a diagram. ' +
    'LIRI / PRORASCIENCE aesthetic when fitting: deep black, sacred gold accents, warm rim light, mystical mood, authentic African spiritual symbolism where relevant, premium photorealistic or high-end editorial photography. ' +
    'The image must read clearly within about 2 seconds. Any French text on the image must be spelled and accented correctly.'
  );
}

/** Groq : reformuler le concept utilisateur — plus d’infographie scientifique forcée en 4 panneaux. */
const GROQ_LIRI_DIRECTOR_SYSTEM =
  'You are an expert art director and image prompt engineer for LIRI / PRORASCIENCE (premium spiritual-education brand). ' +
  'Transform the user concept into ONE precise English prompt for DALL-E 3 or Google Imagen.\n\n' +
  'STEP 1 — Infer: image type (sales poster, brand cover, explanatory diagram, video thumbnail), goal (sell, teach, inspire, attract), dominant emotion (mystery, power, calm, authority).\n\n' +
  'STEP 2 — CRITICAL: Unless the user explicitly asked for a diagram, do NOT invent abstract diagrams, floating circles, useless decorative icons, or busy infographic grids. Avoid humans absent from the scene unless the user asked for abstract-only. PRIORITY = REAL SCENE.\n\n' +
  'STEP 3 — Every prompt must imply: main subject (human or action), visible emotion, strong cinematic light, context (place or ritual), clear text hierarchy if text is needed.\n\n' +
  'STEP 4 — LIRI style when fitting: deep black, sacred gold, warm light, mystical mood, authentic African symbols where relevant, premium realistic render.\n\n' +
  'STEP 5 — Structure the OUTPUT prompt like: Create an image [format/aspect] for [goal]. Subject: … Scene: … Ambiance: … Setting: … Text on image (if any, spell French carefully): … Constraints: …\n\n' +
  'If the result would not be readable in 2 seconds, emotional, and clear — revise.\n\n' +
  'Write ONLY the final image prompt in English, no explanations.';

/** Google AI Studio / Gemini API — Imagen (même clé que `GEMINI_API_KEY`). */
async function callImagenPredict(
  finalPrompt: string,
  aspectRatio: string,
  geminiKey: string,
): Promise<{ b64: string } | { error: string }> {
  // @ts-ignore Deno
  const model = String(Deno.env.get('GEMINI_IMAGEN_MODEL') || 'imagen-4.0-fast-generate-001').trim();
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predict?key=${encodeURIComponent(geminiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: finalPrompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio,
      },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errObj = json?.error as { message?: string } | string | undefined;
    const msg =
      (typeof errObj === 'object' && errObj?.message) ||
      (typeof errObj === 'string' ? errObj : null) ||
      `Imagen HTTP ${res.status}`;
    return { error: String(msg) };
  }
  const b64 = extractImagenBase64(json);
  if (!b64) {
    console.error('imagen predict unexpected body', JSON.stringify(json).slice(0, 1200));
    return { error: 'Réponse Imagen invalide (pas de bytes base64)' };
  }
  return { b64 };
}

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // @ts-ignore - Deno runtime
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
    // @ts-ignore - Deno runtime
    const groqKey = Deno.env.get('GROQ_API_KEY') || '';
    // @ts-ignore - Deno runtime
    const xaiKey = Deno.env.get('XAI_API_KEY') || '';
    // @ts-ignore - Deno runtime — clé [Google AI Studio](https://aistudio.google.com/apikey) / Gemini API
    const geminiKey = String(Deno.env.get('GEMINI_API_KEY') || '').trim();
    if (!openaiKey && !xaiKey && !geminiKey) {
      return jsonResponse({
        error: 'Au moins une clé requise : OPENAI_API_KEY, XAI_API_KEY ou GEMINI_API_KEY (Imagen / Google AI Studio)',
      }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || '').trim();
    if (!prompt) {
      return jsonResponse({ error: 'prompt is required' }, 400);
    }

    const ALLOWED_SIZES = new Set(['1024x1024', '1792x1024', '1024x1792']);
    const rawSize = String(body?.size || '1024x1024').trim();
    const imageSize = ALLOWED_SIZES.has(rawSize) ? rawSize : '1024x1024';

    /** `gemini` = Imagen uniquement ; `dalle` = DALL·E 3 ; `auto` = DALL·E si OPENAI, sinon Imagen si seulement GEMINI. */
    const providerRaw = String(body?.provider || 'auto').trim().toLowerCase();
    const forceDalle = providerRaw === 'dalle' || providerRaw === 'openai';
    const wantsImagen =
      !forceDalle &&
      (providerRaw === 'gemini' || providerRaw === 'google' || providerRaw === 'imagen' ||
        (providerRaw === 'auto' && !openaiKey && !xaiKey && !!geminiKey));

    if (wantsImagen && !geminiKey) {
      return jsonResponse({
        error: 'GEMINI_API_KEY manquant — ajoutez la clé API depuis Google AI Studio (Imagen via Gemini API).',
      }, 500);
    }

    const userId = await resolveUserIdFromRequest(req);

    // @ts-ignore - Deno runtime
    const supabaseAdmin = createClient(
      // @ts-ignore - Deno runtime
      Deno.env.get('SUPABASE_URL')!,
      // @ts-ignore - Deno runtime
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const genMode = wantsImagen ? 'imagen' : 'dalle';
    const ext = wantsImagen ? 'png' : 'jpg';
    const hashInput = userId
      ? `${userId}\n${prompt}\n${imageSize}\n${genMode}`
      : `${prompt}\n${imageSize}\n${genMode}`;
    const hash = await sha256Hex(hashInput);
    const filePath = userId ? `${userId}/ia-gen/${genMode}-${hash}.${ext}` : `${genMode}3-${hash}.${ext}`;
    const targetBucket = userId ? CANVAS_BUCKET : CACHE_BUCKET;
    const cacheSource = wantsImagen ? 'gemini' : 'dalle';

    // ── Cache hit (fichier déjà présent) ───────────────────────────────────
    const { data: pubData } = supabaseAdmin.storage.from(targetBucket).getPublicUrl(filePath);
    const candidateUrl = pubData?.publicUrl;
    if (candidateUrl) {
      try {
        const headRes = await fetch(candidateUrl, { method: 'HEAD' });
        if (headRes.ok) {
          let rowId: string | null = null;
          if (userId) {
            rowId = await ensureDbRow(supabaseAdmin, userId, targetBucket, filePath, prompt, imageSize, cacheSource);
          }
          return jsonResponse({
            imageUrl: candidateUrl,
            cached: true,
            size: imageSize,
            persisted: Boolean(userId),
            id: rowId,
            storagePath: userId ? filePath : undefined,
            provider: wantsImagen ? 'gemini-imagen' : 'dalle',
          });
        }
      } catch (_) { /* continue */ }
    }

    if (!userId) {
      const { data: signedData } = await supabaseAdmin.storage
        .from(CACHE_BUCKET)
        .createSignedUrl(filePath, 365 * 24 * 3600);
      if (signedData?.signedUrl) {
        return jsonResponse({
          imageUrl: signedData.signedUrl,
          cached: true,
          size: imageSize,
          persisted: false,
          provider: wantsImagen ? 'gemini-imagen' : 'dalle',
        });
      }
    }

    // ── Groq refine (optionnel) ───────────────────────────────────────────
    let finalPrompt = prompt;
    if (groqKey) {
      try {
        const imagenEnglish = wantsImagen
          ? ' The final prompt must be in English only (Google Imagen requirement).'
          : '';
        const refineRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 4096,
            messages: [
              {
                role: 'system',
                content: GROQ_LIRI_DIRECTOR_SYSTEM + imagenEnglish,
              },
              {
                role: 'user',
                content: `Create an image generation prompt from this concept:\n\n${prompt}`,
              },
            ],
          }),
        });
        if (refineRes.ok) {
          const refineData = await refineRes.json();
          const refined = refineData?.choices?.[0]?.message?.content?.trim();
          if (refined) finalPrompt = refined;
        }
      } catch (_) { /* keep original */ }
    }

    finalPrompt = appendLiriDirectorSuffix(finalPrompt);

    // ── Google AI Studio / Imagen (Gemini API, même clé que GEMINI_API_KEY) ─
    if (wantsImagen) {
      const aspect = sizeToImagenAspectRatio(imageSize);
      const ir = await callImagenPredict(finalPrompt, aspect, geminiKey);
      if ('error' in ir) {
        return jsonResponse({ imageUrl: null, error: (ir as { error: string }).error, size: imageSize }, 502);
      }
      const { b64 } = ir as { b64: string };
      const blob = base64ToArrayBuffer(b64);
      // @ts-ignore Deno
      const imagenModel = String(Deno.env.get('GEMINI_IMAGEN_MODEL') || 'imagen-4.0-fast-generate-001').trim();
      try {
        if (userId) {
          await supabaseAdmin.storage.from(CANVAS_BUCKET).upload(filePath, blob, {
            contentType: 'image/png',
            upsert: true,
          });
          const { data: upPublic } = supabaseAdmin.storage.from(CANVAS_BUCKET).getPublicUrl(filePath);
          const finalUrl = upPublic?.publicUrl;
          if (finalUrl) {
            const rowId = await ensureDbRow(supabaseAdmin, userId, CANVAS_BUCKET, filePath, prompt, imageSize, 'gemini');
            // ─── LIRI Credits — Débit Imagen (1 image) ─────────────────────
            let _billing: Record<string, unknown> | null = null;
            try {
              const { resolveTenant, debitUsage } = await import('../_shared/aiBilling.ts');
              const billingCtx = await resolveTenant(req, body);
              if (billingCtx) {
                const d = await debitUsage(billingCtx, { functionName: 'generate-visual-image', provider: 'google', model: 'gemini-2.5-flash-image', unitType: 'images', unitAmount: 1, metadata: { prompt: prompt.slice(0, 100), size: imageSize } });
                _billing = { provider: 'google', model: 'gemini-2.5-flash-image', images: 1, credits_charged: d.charged, balance: d.balance };
              }
            } catch (_) { /* non-bloquant */ }
            return jsonResponse({
              imageUrl: finalUrl,
              cached: false,
              size: imageSize,
              model: imagenModel,
              provider: 'gemini-imagen',
              persisted: true,
              id: rowId,
              storagePath: filePath,
              _billing,
            });
          }
        } else {
          await supabaseAdmin.storage.createBucket(CACHE_BUCKET, { public: false }).catch(() => {});
          await supabaseAdmin.storage.from(CACHE_BUCKET).upload(filePath, blob, {
            contentType: 'image/png',
            upsert: true,
          });
          const { data: upPublic } = supabaseAdmin.storage.from(CACHE_BUCKET).getPublicUrl(filePath);
          const { data: upSigned } = await supabaseAdmin.storage
            .from(CACHE_BUCKET)
            .createSignedUrl(filePath, 365 * 24 * 3600);
          const finalUrl = upPublic?.publicUrl || upSigned?.signedUrl;
          if (finalUrl) {
            return jsonResponse({
              imageUrl: finalUrl,
              cached: false,
              size: imageSize,
              model: imagenModel,
              provider: 'gemini-imagen',
              persisted: false,
            });
          }
        }
      } catch (e) {
        console.error('generate-visual-image imagen upload', e);
      }
      return jsonResponse({ imageUrl: null, error: 'Échec stockage image Imagen', size: imageSize }, 500);
    }

    if (!wantsImagen && forceDalle && !openaiKey) {
      return jsonResponse({
        error: 'OPENAI_API_KEY requis pour le mode DALL·E (provider: dalle). Utilisez provider: gemini avec GEMINI_API_KEY pour Imagen.',
      }, 500);
    }

    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort('timeout'), 300_000);

    let dalleRes: Response;
    try {
      dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: finalPrompt,
          n: 1,
          size: imageSize,
          quality: 'hd',
          response_format: 'url',
        }),
        signal: abort.signal,
      });
    } catch (e) {
      clearTimeout(timeout);
      return jsonResponse(
        {
          error: 'DALL-E 3 timeout ou erreur réseau',
          details: String((e as Error)?.message || e),
        },
        504,
      );
    }
    clearTimeout(timeout);

    let remoteUrl: string | null = null;
    let usedModel = 'dall-e-3';

    if (!dalleRes.ok) {
      const errJson = await dalleRes.json().catch(() => ({})) as Record<string, unknown>;
      const detail = (errJson?.error as { message?: string })?.message || String(dalleRes.status);
      if ((dalleRes.status === 429 || dalleRes.status === 402) && xaiKey) {
        try {
          const xaiRes = await fetch('https://api.x.ai/v1/images/generations', {
            method: 'POST',
            headers: { Authorization: `Bearer ${xaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'grok-2-image-1212',
              prompt: finalPrompt,
              n: 1,
              response_format: 'url',
            }),
          });
          if (xaiRes.ok) {
            const xaiData = await xaiRes.json();
            remoteUrl = xaiData?.data?.[0]?.url ?? null;
            usedModel = 'xai';
          }
        } catch (_) { /* fall through */ }
      }
      if (!remoteUrl) {
        return jsonResponse({ imageUrl: null, error: detail, size: imageSize });
      }
    } else {
      const dalleData = await dalleRes.json();
      remoteUrl = dalleData?.data?.[0]?.url ?? null;
    }

    if (!remoteUrl) {
      return jsonResponse({ error: 'Aucune URL image retournée' }, 500);
    }

    // ── Télécharger et stocker ────────────────────────────────────────────
    try {
      const imgRes = await fetch(remoteUrl);
      if (imgRes.ok) {
        const blob = await imgRes.arrayBuffer();

        if (userId) {
          await supabaseAdmin.storage.from(CANVAS_BUCKET).upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });
          const { data: upPublic } = supabaseAdmin.storage.from(CANVAS_BUCKET).getPublicUrl(filePath);
          const finalUrl = upPublic?.publicUrl;
          if (finalUrl) {
            const rowId = await ensureDbRow(supabaseAdmin, userId, CANVAS_BUCKET, filePath, prompt, imageSize, 'dalle');
            return jsonResponse({
              imageUrl: finalUrl,
              cached: false,
              size: imageSize,
              model: usedModel,
              persisted: true,
              id: rowId,
              storagePath: filePath,
            });
          }
        } else {
          await supabaseAdmin.storage.createBucket(CACHE_BUCKET, { public: false }).catch(() => {});
          await supabaseAdmin.storage.from(CACHE_BUCKET).upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });
          const { data: upPublic } = supabaseAdmin.storage.from(CACHE_BUCKET).getPublicUrl(filePath);
          const { data: upSigned } = await supabaseAdmin.storage
            .from(CACHE_BUCKET)
            .createSignedUrl(filePath, 365 * 24 * 3600);
          const finalUrl = upPublic?.publicUrl || upSigned?.signedUrl;
          if (finalUrl) {
            return jsonResponse({
              imageUrl: finalUrl,
              cached: false,
              size: imageSize,
              model: usedModel,
              persisted: false,
            });
          }
        }
      }
    } catch (e) {
      console.error('generate-visual-image upload', e);
    }

    return jsonResponse({
      imageUrl: remoteUrl,
      cached: false,
      size: imageSize,
      model: usedModel,
      persisted: false,
    });
  } catch (e) {
    return jsonResponse({ imageUrl: null, error: String((e as Error)?.message || e) });
  }
});
