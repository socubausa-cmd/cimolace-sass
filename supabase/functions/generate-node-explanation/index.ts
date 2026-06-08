/// <reference lib="deno.ns" />

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // @ts-ignore - Deno runtime
    const apiKey = Deno.env.get('OPENAI_API_KEY') || '';
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { nodeLabel, nodeSummary, nodeTime, videoTitle, transcript } = body as {
      nodeLabel?: string;
      nodeSummary?: string;
      nodeTime?: string;
      videoTitle?: string;
      transcript?: Array<{ t?: string; x?: string }>;
    };

    if (!nodeLabel) {
      return new Response(JSON.stringify({ error: 'nodeLabel is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Step 1: Search knowledge base via pgvector ──────────────────────────
    let knowledgeContext = '';
    try {
      // @ts-ignore - Deno runtime
      const SupabaseGlobal = typeof Supabase !== 'undefined' ? (Supabase as any) : null;
      if (!SupabaseGlobal?.ai?.Session) throw new Error('Supabase.ai not available');
      const aiSession = new SupabaseGlobal.ai.Session('gte-small');
      const queryText = [nodeLabel, nodeSummary].filter(Boolean).join(' ');
      const embeddingRaw = await aiSession.run(queryText, { mean_pool: true, normalize: true });
      const embedding = Array.from(embeddingRaw as number[]);

      // @ts-ignore - Deno runtime
      const supabaseAdmin = createClient(
        // @ts-ignore - Deno runtime
        Deno.env.get('SUPABASE_URL')!,
        // @ts-ignore - Deno runtime
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: kbResults } = await supabaseAdmin.rpc('match_knowledge', {
        query_embedding: embedding,
        match_threshold: 0.40,
        match_count: 4,
      });

      if (Array.isArray(kbResults) && kbResults.length > 0) {
        const passages = (kbResults as Array<{ title: string; content: string; similarity: number }>)
          .map((r) => `[${r.title}]\n${r.content.slice(0, 600)}`)
          .join('\n\n---\n\n');
        knowledgeContext = passages;
      }
    } catch (_kbErr) {
      // KB search failed silently — generate without context
    }

    // ── Step 2: Build prompt ──────────────────────────────────────────────────
    const openaiBaseUrl = 'https://api.openai.com/v1';
    const openaiModel = 'gpt-4o-mini';

    const kbSection = knowledgeContext
      ? `\n\n=== SOURCE 1 : BASE DE CONNAISSANCES PRORASCIENCE ===\nPassages issus des documents officiels de la doctrine Prorascience. Priorité maximale — formulations exactes à respecter.\n${knowledgeContext}\n=== FIN SOURCE 1 ===`
      : '';

    const system =
      'Tu es un EXTRACTEUR-SYNTHÉTISEUR FIDÈLE de contenu pédagogique. ' +
      'Tu as accès à DEUX sources internes : (1) la base de connaissances Prorascience, (2) la transcription de la vidéo. ' +
      'Ta mission : croiser ces deux sources pour produire une explication enrichie, sans jamais sortir de ces deux sources. ' +
      'RÈGLES ABSOLUES — NE JAMAIS VIOLER : ' +
      '1. Utilise UNIQUEMENT les informations présentes dans les deux sources fournies (base de connaissances + transcription). ' +
      '   AUTORISÉ : synthétiser, croiser, relier ce que dit la base de connaissances avec ce que dit la transcription sur le même concept. ' +
      '   INTERDIT : introduire un concept, théorie ou exemple absent de ces deux sources. ' +
      '2. Ne reformule JAMAIS un principe fondamental de la Prorascience — copie la FORMULATION EXACTE du document source. ' +
      '   Exemple : si la base dit «Ce qui se ressemble se repousse» écris EXACTEMENT cela, jamais l\'inverse. ' +
      '   Exemple : si la base dit «les charges opposées s\'attirent», copie exactement — jamais «se repoussent». ' +
      '3. La base de connaissances Prorascience a priorité absolue sur la transcription en cas de contradiction. ' +
      '4. Si les deux sources ne contiennent pas assez d\'information pour un champ, mets "" ou [] — N\'invente RIEN. ' +
      '5. Tout le texte en français. ' +
      'Output ONLY valid JSON, no markdown, no text outside JSON. ' +
      'Schema: {sourceQuotes, deepExplanation, corePrinciple, concepts, relations, examples, insights, visuals}. ' +
      'sourceQuotes: tableau de 2-5 CITATIONS VERBATIM EXACTES extraites des documents source qui fondent cette explication. C\'est ta preuve de fidélité. ' +
      'deepExplanation: 4-6 phrases EXCLUSIVEMENT basées sur les documents source. Chaque affirmation doit être traçable aux sourceQuotes. ' +
      'corePrinciple: la FORMULATION EXACTE du principe tel qu\'il apparaît dans le document source. Copie mot pour mot. ' +
      'concepts: tableau de {label, definition} pour 3-5 concepts clés — définitions issues du texte source uniquement. ' +
      'relations: tableau de {from, to, type} montrant les liens causaux ou logiques explicitement décrits dans la source (type = "cause", "résultat", "implique", "oppose", "inclut"). ' +
      'examples: tableau de 2-3 exemples PRÉSENTS dans le texte source uniquement. Si la source n\'en donne pas, retourne []. ' +
      'insights: tableau de 2-3 points clés formulés avec les mots du document source. ' +
      'visuals: tableau de 2-3 specs visuelles structurées — jamais de strings simples. Chaque élément DOIT avoir un champ "type". ' +
      'Formats disponibles : ' +
      '(1) Diagramme Mermaid : {"type":"diagram","title":"...","format":"mermaid","code":"..."} — pour flux, hiérarchies, séquences. ' +
      'OBLIGATOIRE : commence le code avec classDef pour 3 rôles visuels, applique-les à TOUS les nœuds. ' +
      'Structure : "graph TD\\n  classDef main fill:#1e3a5f,stroke:#D4AF37,stroke-width:2px,color:#fff\\n  classDef secondary fill:#2d1b4e,stroke:#a855f7,stroke-width:2px,color:#f3e8ff\\n  classDef accent fill:#0f3320,stroke:#22c55e,stroke-width:2px,color:#dcfce7\\n  A([Concept]):::main --> B{Processus}:::secondary\\n  B --> C[Résultat]:::accent". ' +
      'Formes variées : [text] rect, (text) round, {text} diamond, ([text]) stadium. Un nœud par ligne, jamais de point-virgule. ' +
      '(2) Graphique : {"type":"chart","title":"...","chartType":"bar","labels":[...],"values":[...],"unit":"..."} — uniquement si la source contient des données chiffrées. ' +
      '(3) Sketch : {"type":"sketch","title":"...","elements":[{"shape":"circle","label":"..."},{"shape":"arrow","label":"","from":0,"to":1},{"shape":"box","label":"..."}]}. ' +
      '(4) Infographic : {"type":"infographic","title":"...","mindmap":{"center":"...","branches":[{"label":"...","items":["...","..."]}]},"scientific":{"formula":"A + B = C","elements":[{"label":"...","sub":"..."},{"label":"...","sub":"..."},{"label":"...","sub":"..."}]},"pedagogic":{"steps":[{"label":"...","sub":"..."},{"label":"...","sub":"..."},{"label":"...","sub":"..."}],"math":"..."},"cosmological":{"elements":["...","...","..."],"sequence":"Etape1 → Etape2 → Etape3 → Résultat"}} — utilise ce type comme second visuel. ' +
      '(5) Image DALL-E — TOUJOURS inclure comme 3ème visuel : {"type":"image","title":"Illustration pédagogique","prompt":"..."} ' +
      'Le champ prompt DOIT être en anglais, max 300 mots, et décrire une infographie pédagogique réaliste style académique illustrant le concept. ' +
      'Structure du prompt : "A high-quality educational infographic illustration for the concept [CONCEPT]. ' +
      'Realistic and symbolic visuals organized in a 4-quadrant layout: ' +
      '(1) top-left: mindmap with central concept and 3-4 branches showing key ideas from the source, ' +
      '(2) top-right: scientific diagram showing the conceptual equation [FORMULA] with symbolic realistic elements (e.g. nature, cosmos, light), ' +
      '(3) bottom-left: pedagogical flow [STEP1] → [STEP2] → [STEP3] with arrows, icons, and the mathematical model, ' +
      '(4) bottom-right: cosmological/philosophical illustration with cosmic and symbolic imagery representing the universal law. ' +
      'Style: clean modern academic infographic, color-coded sections (blue=origin/past, green=process/present, gold=emergence/future, deep purple=cosmic), ' +
      'title at top in bold French, professional scientific design, light gradient background, subtle glow effects, ' +
      'photorealistic symbolic elements blended with infographic layout, suitable for educational platform." ' +
      'Remplace les placeholders [CONCEPT], [FORMULA], [STEP1-3] par les vraies données du nœud issues du document source. ' +
      'Toutes les données des visuels doivent refléter les concepts du document source.' +
      kbSection;

    // ── Module 2: Text Cleaner ─────────────────────────────────────────────────
    function cleanTranscript(lines: Array<{ t?: string; x?: string }>): string {
      const FILLERS = /\b(euh|hum+|donc|voil[aà]|ben|ah+|oh+|hein|quoi|l[aà]|alors|bon|ok|oui|non|bah|enfin|genre|ouais|c'est-[aà]-dire)\b/gi;
      const seen = new Set<string>();
      return lines
        .map((l) => String(l?.x || '').trim())
        .filter((t) => t.length > 8)
        .map((t) =>
          t
            .replace(FILLERS, '')
            .replace(/([.!?])\s*\1+/g, '$1') // deduplicate punctuation
            .replace(/\s{2,}/g, ' ')
            .trim()
        )
        .filter((t) => {
          const key = t.toLowerCase().slice(0, 40);
          if (seen.has(key)) return false;
          seen.add(key);
          return t.length > 8;
        })
        .slice(0, 30)
        .join(' ')
        .slice(0, 2500);
    }

    const cleanedTranscript = Array.isArray(transcript) ? cleanTranscript(transcript) : '';

    const userPrompt = {
      task: 'Croise la SOURCE 1 (base de connaissances Prorascience) et la SOURCE 2 (transcription vidéo) pour produire une explication enrichie et fidèle de ce concept. Priorité : formulations exactes de la SOURCE 1. Ne reformule jamais un principe — cite-le mot pour mot.',
      nodeLabel,
      nodeSummary: nodeSummary || '',
      nodeTime: nodeTime || '',
      videoTitle: videoTitle || '',
      'SOURCE 2 — transcription vidéo': cleanedTranscript,
      reminder: 'INTERDIT : concepts absents des deux sources. INTERDIT : inverser/reformuler un principe Prorascience. OBLIGATOIRE : sourceQuotes = citations verbatim issues des deux sources.',
    };

    // ── JSON validator ────────────────────────────────────────────────────────
    type ValidationResult = { valid: boolean; missing: string[] };
    function validateJSON(obj: Record<string, unknown>): ValidationResult {
      const missing: string[] = [];
      if (!obj.deepExplanation || typeof obj.deepExplanation !== 'string' || (obj.deepExplanation as string).trim().length < 20) missing.push('deepExplanation');
      if (!Array.isArray(obj.sourceQuotes) || (obj.sourceQuotes as unknown[]).length === 0) missing.push('sourceQuotes');
      if (!Array.isArray(obj.examples)) missing.push('examples');
      if (!Array.isArray(obj.insights) || (obj.insights as unknown[]).length === 0) missing.push('insights');
      if (!Array.isArray(obj.visuals) || (obj.visuals as unknown[]).length === 0) missing.push('visuals');
      if (Array.isArray(obj.visuals)) {
        const hasValidVisual = (obj.visuals as unknown[]).some(
          (v) => v !== null && typeof v === 'object' && typeof (v as Record<string, unknown>).type === 'string'
        );
        if (!hasValidVisual) missing.push('visuals[].type');
      }
      return { valid: missing.length === 0, missing };
    }

    // ── LLM callers — Groq PRIMARY, OpenAI SECONDARY, DeepSeek TERTIARY ──────
    // @ts-ignore - Deno runtime
    const groqApiKey = Deno.env.get('GROQ_API_KEY') || '';
    // @ts-ignore - Deno runtime
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY') || '';

    const billingTrack = { provider: '', model: '', tokens_in: 0, tokens_out: 0 };

    // ─── LIRI Credits — Tenant + preflight ────────────────────────────────
    const ctx = await resolveTenant(req, body);
    if (ctx) {
      const promptText = system + (nodeLabel || '') + (nodeSummary || '');
      const estimate = await estimateLlmCost(ctx, 'groq', 'llama-3.3-70b-versatile', promptText, 3500);
      const reject = await preflightCheck(ctx, estimate);
      if (reject) {
        const errBody = await reject.json();
        return new Response(JSON.stringify(errBody), {
          status: reject.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    async function callGroq(messages: Array<{ role: string; content: string }>): Promise<{ content: string | null; error: string | null }> {
      if (!groqApiKey) return { content: null, error: 'GROQ_API_KEY not set' };
      const abort = new AbortController();
      const t = setTimeout(() => abort.abort('timeout'), 55_000);
      let res: Response;
      try {
        res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.05,
            messages,
            max_tokens: 3500,
            response_format: { type: 'json_object' },
          }),
          signal: abort.signal,
        });
      } catch (e) {
        clearTimeout(t);
        return { content: null, error: `Groq timeout: ${String((e as Error)?.message || e)}` };
      }
      clearTimeout(t);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return { content: null, error: `Groq error ${res.status}: ${txt}` };
      }
      const data = await res.json();
      const c = String(data?.choices?.[0]?.message?.content || '').trim();
      if (c) {
        billingTrack.provider = 'groq';
        billingTrack.model = 'llama-3.3-70b-versatile';
        billingTrack.tokens_in = data?.usage?.prompt_tokens ?? 0;
        billingTrack.tokens_out = data?.usage?.completion_tokens ?? 0;
      }
      return { content: c || null, error: c ? null : 'Empty response from Groq' };
    }

    async function callOpenAI(messages: Array<{ role: string; content: string }>): Promise<{ content: string | null; error: string | null }> {
      if (!apiKey) return { content: null, error: 'OPENAI_API_KEY not set' };
      const abort = new AbortController();
      const t = setTimeout(() => abort.abort('timeout'), 55_000);
      let res: Response;
      try {
        res = await fetch(`${openaiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: openaiModel,
            temperature: 0.0,
            messages,
            max_tokens: 3500,
            response_format: { type: 'json_object' },
          }),
          signal: abort.signal,
        });
      } catch (e) {
        clearTimeout(t);
        return { content: null, error: `OpenAI timeout: ${String((e as Error)?.message || e)}` };
      }
      clearTimeout(t);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return { content: null, error: `OpenAI error ${res.status}: ${txt}` };
      }
      const data = await res.json();
      const c = String(data?.choices?.[0]?.message?.content || '').trim();
      if (c) {
        billingTrack.provider = 'openai';
        billingTrack.model = openaiModel;
        billingTrack.tokens_in = data?.usage?.prompt_tokens ?? 0;
        billingTrack.tokens_out = data?.usage?.completion_tokens ?? 0;
      }
      return { content: c || null, error: c ? null : 'Empty response from OpenAI' };
    }

    async function callDeepSeek(messages: Array<{ role: string; content: string }>): Promise<{ content: string | null; error: string | null }> {
      if (!deepseekApiKey) return { content: null, error: 'DEEPSEEK_API_KEY not set' };
      const abort = new AbortController();
      const t = setTimeout(() => abort.abort('timeout'), 55_000);
      let res: Response;
      try {
        res = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${deepseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'deepseek-chat',
            temperature: 0.05,
            messages,
            max_tokens: 3500,
            response_format: { type: 'json_object' },
          }),
          signal: abort.signal,
        });
      } catch (e) {
        clearTimeout(t);
        return { content: null, error: `DeepSeek timeout: ${String((e as Error)?.message || e)}` };
      }
      clearTimeout(t);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return { content: null, error: `DeepSeek error ${res.status}: ${txt}` };
      }
      const data = await res.json();
      const c = String(data?.choices?.[0]?.message?.content || '').trim();
      if (c) {
        billingTrack.provider = 'deepseek';
        billingTrack.model = 'deepseek-chat';
        billingTrack.tokens_in = data?.usage?.prompt_tokens ?? 0;
        billingTrack.tokens_out = data?.usage?.completion_tokens ?? 0;
      }
      return { content: c || null, error: c ? null : 'Empty response from DeepSeek' };
    }

    async function callLLM(messages: Array<{ role: string; content: string }>): Promise<{ content: string | null; error: string | null }> {
      // Groq first (fast), OpenAI second, DeepSeek as final fallback
      const groqResult = await callGroq(messages);
      if (groqResult.content) return groqResult;
      const openaiResult = await callOpenAI(messages);
      if (openaiResult.content) return openaiResult;
      return callDeepSeek(messages);
    }

    // ── Step 3: Call GPT-4o mini ─────────────────────────────────────────────
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(userPrompt) },
    ];

    const { content: rawContent, error: llmError } = await callLLM(messages);
    if (!rawContent) {
      return new Response(
        JSON.stringify({ error: llmError || 'Réponse vide du modèle' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 4: Validate JSON ────────────────────────────────────────────────
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawContent);
    } catch (_) {
      return new Response(
        JSON.stringify({ error: 'JSON invalide retourné par le modèle' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validateJSON(parsed);
    if (!validation.valid) {
      // ── Step 4b: Retry with correction prompt ────────────────────────────
      const retryMessages = [
        ...messages,
        { role: 'assistant', content: rawContent },
        {
          role: 'user',
          content:
            `The JSON you returned is incomplete. Missing or invalid fields: ${validation.missing.join(', ')}. ` +
            'Please return the complete corrected JSON with ALL required fields: ' +
            'sourceQuotes (array ≥1 verbatim string from source), deepExplanation (string ≥20 chars), ' +
            'examples (array), insights (array ≥1 string), visuals (array ≥1 object with type field). ' +
            'Output ONLY valid JSON, nothing else.',
        },
      ];
      const { content: retryContent } = await callLLM(retryMessages);
      if (retryContent) {
        try {
          const retryParsed = JSON.parse(retryContent);
          const retryValidation = validateJSON(retryParsed);
          if (retryValidation.valid) parsed = retryParsed;
          else {
            // Merge: use retry values where available, keep original for missing
            for (const field of ['sourceQuotes', 'deepExplanation', 'examples', 'insights', 'visuals'] as const) {
              if (retryParsed[field]) parsed[field] = retryParsed[field];
            }
          }
        } catch (_) { /* keep original parsed */ }
      }
    }

    const result = {
      sourceQuotes: Array.isArray(parsed?.sourceQuotes) ? (parsed.sourceQuotes as unknown[]).map(String).filter(Boolean) : [],
      deepExplanation: String(parsed?.deepExplanation || '').trim(),
      corePrinciple: String(parsed?.corePrinciple || '').trim(),
      concepts: Array.isArray(parsed?.concepts)
        ? (parsed.concepts as unknown[]).filter(
            (c) => c !== null && typeof c === 'object' && (c as Record<string, unknown>).label
          )
        : [],
      relations: Array.isArray(parsed?.relations)
        ? (parsed.relations as unknown[]).filter(
            (r) => r !== null && typeof r === 'object' &&
              (r as Record<string, unknown>).from && (r as Record<string, unknown>).to
          )
        : [],
      examples: Array.isArray(parsed?.examples) ? (parsed.examples as unknown[]).map(String).filter(Boolean) : [],
      insights: Array.isArray(parsed?.insights) ? (parsed.insights as unknown[]).map(String).filter(Boolean) : [],
      visuals: Array.isArray(parsed?.visuals)
        ? (parsed.visuals as unknown[]).filter(
            (v) => v !== null && typeof v === 'object' && typeof (v as Record<string, unknown>).type === 'string'
          )
        : [],
      usedKnowledgeBase: knowledgeContext.length > 0,
    };

    if (ctx && billingTrack.provider) {
      const debitIn = await debitUsage(ctx, {
        functionName: 'generate-node-explanation', provider: billingTrack.provider, model: billingTrack.model,
        unitType: 'tokens_in', unitAmount: billingTrack.tokens_in, metadata: { node_label: nodeLabel },
      });
      const debitOut = await debitUsage(ctx, {
        functionName: 'generate-node-explanation', provider: billingTrack.provider, model: billingTrack.model,
        unitType: 'tokens_out', unitAmount: billingTrack.tokens_out,
      });
      (result as Record<string, unknown>)._billing = {
        provider: billingTrack.provider, model: billingTrack.model,
        tokens_in: billingTrack.tokens_in, tokens_out: billingTrack.tokens_out,
        credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
        balance: debitOut.balance ?? debitIn.balance,
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
