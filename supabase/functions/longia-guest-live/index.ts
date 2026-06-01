/// <reference lib="deno.ns" />
/**
 * LONGIA invité — assistant pédagogique personnel pendant le live (JWT élève).
 *
 * POST {
 *   messages: { role:'user'|'assistant', content:string }[],
 *   studentState: object,
 *   sessionContext: { sessionId, sessionTitle?, stepTitle?, transcriptSnippet?, chatExcerpt? },
 *   uiAction?: string
 * }
 */
import { corsHeaders } from '../_shared/cors.ts';
import { aiChatClaudeDeepSeekGrok } from '../_shared/aiClaudeDeepSeekGrok.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(s);
  if (fence) s = fence[1].trim();
  try {
    const o = JSON.parse(s) as unknown;
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const DEFAULT_REPLY: Record<string, unknown> = {
  message: 'Je suis là pour t’aider pendant le live. Pose une question ou choisis une action ci-dessous.',
  summary: '',
  explanation: '',
  example: '',
  actions: [
    { label: 'Expliquer autrement', action: 'simplify' },
    { label: 'Donner un exemple', action: 'give_example' },
    { label: 'Qu’est-ce qu’il faut retenir ?', action: 'what_to_remember' },
  ],
  notes_update: { enabled: false },
  teacher_signal: { send: false },
};

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  // @ts-ignore Deno
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  // @ts-ignore Deno
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return json(401, { error: 'Missing Authorization' });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) {
    return json(401, { error: 'Invalid token' });
  }

  let body: {
    messages?: Array<{ role?: string; content?: string }>;
    studentState?: Record<string, unknown>;
    sessionContext?: Record<string, unknown>;
    uiAction?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const studentState = body.studentState && typeof body.studentState === 'object' ? body.studentState : {};
  const sessionContextRaw = body.sessionContext && typeof body.sessionContext === 'object' ? body.sessionContext : {};
  const hubMeta = sessionContextRaw.longia_hub;
  const isLiveHostCoach =
    hubMeta &&
    typeof hubMeta === 'object' &&
    !Array.isArray(hubMeta) &&
    String((hubMeta as Record<string, unknown>).surface || '') === 'live_host';
  /** Métadonnée client — ne pas répéter dans le JSON injecté au prompt. */
  const sessionContext = { ...sessionContextRaw };
  delete sessionContext.longia_hub;
  const uiAction = String(body.uiAction || '').trim();

  const jsonShape = `
Tu réponds UNIQUEMENT par un objet JSON valide (pas de markdown hors JSON), avec cette forme exacte :
{
  "message": "string (message principal à afficher)",
  "summary": "string ou vide",
  "explanation": "string ou vide",
  "example": "string ou vide",
  "actions": [ { "label": "string", "action": "string", "payload": {} } ],
  "notes_update": { "enabled": boolean, "content": "string ou absent" },
  "teacher_signal": { "send": boolean, "type": "string ou absent", "payload": {} }
}`;

  const systemStudent = `Tu es LONGIA, assistant pédagogique personnel pour un élève qui suit un live (visio).
Tu n’interromps pas le formateur : tu aides l’élève en parallèle, avec un ton chaleureux et clair (français).

Règles :
- Réponses adaptées au niveau indiqué (beginner = très simple et court, intermediate = structuré, advanced = nuances possibles).
- Mode discreet : peu d’initiative ; assisted/coach : tu peux proposer des pistes.
- sessionContext peut inclure transcriptSnippet (paroles récentes du formateur, STT) et transcriptPartial (brouillon STT) : t’en sers pour ancrer résumés et exemples ; ne cite pas comme parole exacte si incertain.
- Ne jamais inventer le contenu doctrinal du cours : si tu n’as pas assez de contexte, dis-le et propose une question à poser au formateur.
- teacher_signal.send = true UNIQUEMENT si plusieurs incompréhensions graves ou demande explicite de remonter (agrégé), pas pour chaque message.
${jsonShape}

Actions possibles pour le tableau actions (labels en français) : explain_again, simplify, give_example, what_to_remember, add_to_notes, ask_question, mark_confusing, show_definition, simplify_more.

studentState (JSON) :
${JSON.stringify(studentState)}

sessionContext (JSON) :
${JSON.stringify(sessionContext)}

Dernière action UI déclenchée par l’élève (si vide, conversation libre) : ${uiAction || '(aucune)'}`;

  const systemHost = `Tu es LONGIA, **co-pilote** pour un **formateur** pendant un live (visio).
Tu discutes avec lui dans un panneau privé : pas les élèves. Ton professionnel, clair, en français.

**Mode conversation (prioritaire)** : réponses **courtes et rapides**. Le champ "message" = ton échange principal : **2 à 5 phrases maximum** pour un tour normal ; une phrase suffit pour un simple « bonjour » ou accusé de réception.

**Anti-doublon (obligatoire)** :
- Ne répète **jamais** le même texte dans plusieurs champs. Si tout tient dans "message", mets **summary**, **explanation** et **example** à **""** (chaîne vide).
- Utilise summary / explanation / example **seulement** pour des extraits **distincts** (ex. une accroche oral ≠ la même phrase que dans message).
- Ne fais pas une « carte » séparée qui recopie "message".

Rôles :
- Optionnel : mini-rendus dans summary / explanation / example (pistes oral **différentes** du message principal).
- T’appuyer sur sessionContext : chatExcerpt, transcriptSnippet / transcriptPartial, stepTitle, sessionTitle.
- Ne pas inventer le fond doctrinal : si contexte faible, le signaler brièvement.
- **teacher_signal** : toujours désactivé pour le formateur. Mets systématiquement "teacher_signal": { "send": false }.
- notes_update : mémo optionnel pour le formateur (brouillon) si pertinent.
${jsonShape}

Actions utiles (labels en français) : what_to_remember, simplify, give_example, suggest_transition, rephrase_oral, check_pacing, classroom_check, add_to_notes.

studentState (JSON) :
${JSON.stringify(studentState)}

sessionContext (JSON) :
${JSON.stringify(sessionContext)}

Dernière action UI (si vide, conversation libre) : ${uiAction || '(aucune)'}`;

  const system = isLiveHostCoach ? systemHost : systemStudent;

  const conv = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.content!,
    }));

  if (conv.length === 0) {
    conv.push({
      role: 'user',
      content: isLiveHostCoach
        ? '[Ouverture coach formateur] Accueil très court (2 phrases max), JSON conforme. teacher_signal.send = false.'
        : '[Ouverture panneau] L’élève vient d’ouvrir LONGIA. Donne un accueil bref + un résumé placeholder si tu n’as pas encore de transcript, et 3 actions utiles.',
    });
  }

  // @ts-ignore Deno
  const coachClaudeOverride = String(Deno.env.get('LONGIA_COACH_CLAUDE_MODEL') || '').trim();

  try {
    const { text, provider } = await aiChatClaudeDeepSeekGrok({
      system,
      messages: conv,
      max_tokens: isLiveHostCoach ? 420 : 900,
      temperature: isLiveHostCoach ? 0.22 : 0.35,
      preferDeepseekFirst: isLiveHostCoach,
      claudeModel: isLiveHostCoach && coachClaudeOverride ? coachClaudeOverride : undefined,
    });
    const raw = String(text || '').trim();
    const parsed = parseJsonObject(raw);
    if (!parsed || typeof parsed.message !== 'string') {
      return json(200, { ok: true, ...DEFAULT_REPLY, provider, parseError: true });
    }
    const merged = { ...DEFAULT_REPLY, ...parsed };
    if (!Array.isArray(merged.actions)) merged.actions = DEFAULT_REPLY.actions;
    return json(200, { ok: true, ...merged, provider });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(200, {
      ok: true,
      ...DEFAULT_REPLY,
      message: `LONGIA est temporairement indisponible (${msg}). Réessaie dans un instant.`,
      provider: null,
    });
  }
});
