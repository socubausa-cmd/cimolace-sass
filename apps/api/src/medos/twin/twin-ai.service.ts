import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * MEDOS v2 — Bio Digital Twin · Couche IA (agents cliniques).
 *
 * Reçoit un contexte DÉJÀ PSEUDONYMISÉ (âge, sexe, biomarqueurs, symptômes —
 * jamais de nom/prénom/contact). Renvoie des sorties STRUCTURÉES avec niveau
 * de confiance et explication (XAI). Ne produit jamais de diagnostic.
 *
 * Si ANTHROPIC_API_KEY est absent, lève 503 (le cœur déterministe — scores,
 * alertes — fonctionne sans IA, donc le produit reste utilisable).
 */
export interface PatientAiContext {
  age: number | null;
  sex: string | null;
  symptoms: string[];
  biomarkers: Array<{ code: string; name_fr: string; value: number; unit: string; flag: string }>;
  organ_scores: Array<{ organ_code: string; score: number; color: string }>;
}

export interface AiResult<T> {
  data: T;
  model: string;
  tokens: number;
}

const DISCLAIMER =
  'Tu es un COPILOTE CLINIQUE pour un thérapeute en médecine/nutrition fonctionnelle. ' +
  'Tu ne poses JAMAIS de diagnostic définitif. Tu formules des HYPOTHÈSES, corrélations et ' +
  'pistes, toujours avec un niveau de confiance (0-1). Tu réponds en français, de façon ' +
  'concise et sourcée. Tu réponds STRICTEMENT en JSON valide, sans texte autour.';

/**
 * SYSTEM PROMPT de l'assistant PATIENT — DISTINCT du DISCLAIMER copilote.
 *
 * Le copilote (DISCLAIMER) s'adresse à un thérapeute et autorise hypothèses
 * cliniques + niveaux de confiance. Côté PATIENT, c'est INTERDIT : pas de
 * diagnostic, pas de maladie nommée comme certaine, pas de médicament/posologie.
 * Cadre strictement pédagogique / bien-être, le PRATICIEN reste le référent.
 *
 * Sortie STRICTEMENT JSON {reply, suggestions, escalate} (imposé par le parsing
 * JSON.parse de callClaude). Le contrôleur n'expose que `reply` au patient.
 */
const PATIENT_SYSTEM =
  "Tu es un assistant santé PÉDAGOGIQUE qui s'adresse DIRECTEMENT au PATIENT, " +
  'dans son espace personnel de suivi. Tu parles en français, avec un ton clair, ' +
  'rassurant et accessible (pas de jargon inutile). ' +
  "Tu t'appuies UNIQUEMENT sur les données de suivi fournies (scores d'organes, " +
  'roue de transformation, biomarqueurs, tendances, alertes). Tu ne fabriques jamais ' +
  'de données absentes. ' +
  'RÈGLES ABSOLUES :\n' +
  "(1) JAMAIS de diagnostic. Ne nomme JAMAIS une maladie comme certaine. Ne prescris RIEN : " +
  'aucun médicament, aucune posologie, aucun dosage, aucun examen présenté comme une ordonnance. ' +
  "Tu parles d'hygiène de vie (sommeil, alimentation, activité, stress), de compréhension des " +
  'indicateurs, et de questions utiles à poser à son praticien.\n' +
  "(2) Rappelle, quand c'est pertinent, que ces informations sont éducatives et que SON " +
  'PRATICIEN RESTE SON RÉFÉRENT pour toute décision de santé.\n' +
  '(3) ESCALADE : si le message évoque un signe d\'alerte (douleur thoracique, détresse ' +
  'respiratoire, paralysie ou faiblesse soudaine, trouble de la parole, perte de connaissance, ' +
  'saignement abondant, idées suicidaires ou de se faire du mal), mets escalate=true et écris une ' +
  'réponse qui oriente IMMÉDIATEMENT vers le 15 ou le 112 et vers son praticien, SANS minimiser, ' +
  "SANS analyser le reste, SANS poser de question. Sinon escalate=false.\n" +
  '(4) Reste dans un cadre BIEN-ÊTRE et ÉDUCATION.\n' +
  '(5) Réponds toujours en français.\n' +
  "(6) Ne mentionne JAMAIS le moteur, l'IA, un fournisseur ou une marque interne. " +
  "Tu es simplement « l'assistant de suivi » de la personne.\n" +
  'Les `suggestions` sont 2 à 3 questions de relance courtes que le patient pourrait poser ' +
  "ensuite — JAMAIS des examens à prescrire ni des conseils médicaux déguisés. " +
  'Sortie STRICTEMENT en JSON valide, sans aucun texte autour. ' +
  'Schéma JSON attendu : {"reply": string, "suggestions": string[], "escalate": boolean}.';

/**
 * Extrait le 1er bloc JSON équilibré (objet ou tableau) d'une chaîne, même si
 * le modèle l'a entouré de prose. Renvoie null si aucun bloc plausible.
 */
export function extractJsonBlock(s: string): string | null {
  const candidates = ['{', '['].map((c) => s.indexOf(c)).filter((i) => i >= 0);
  if (!candidates.length) return null;
  const start = Math.min(...candidates);
  const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (end <= start) return null;
  return s.slice(start, end + 1);
}

/**
 * Répare au mieux un JSON TRONQUÉ (sortie LLM coupée par max_tokens) : ferme la
 * chaîne ouverte et les `{`/`[` restants. Renvoie le JSON réparé SEULEMENT s'il
 * parse — sinon null. Donc aucune régression possible (échec = comportement
 * inchangé). Best-effort : la dernière valeur partielle peut être perdue.
 */
export function repairTruncatedJson(s: string): string | null {
  const start = (() => {
    const c = ['{', '['].map((ch) => s.indexOf(ch)).filter((i) => i >= 0);
    return c.length ? Math.min(...c) : -1;
  })();
  if (start < 0) return null;
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  let lastComplete = -1; // fin (exclue) d'une valeur sûre (après } ] " ou chiffre)
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') {
        inStr = false;
        lastComplete = i + 1;
      }
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      stack.pop();
      lastComplete = i + 1;
    } else if (/[0-9eE.+-]/.test(c)) lastComplete = i + 1;
    else if (c === 'e' || /[truefalsn]/.test(c)) lastComplete = i + 1;
  }
  // Repart de la dernière valeur complète pour jeter un token partiel traînant.
  let body = lastComplete > start ? s.slice(start, lastComplete) : s.slice(start);
  // Recompte la profondeur de structure sur le corps tronqué.
  const depth: string[] = [];
  let str = false;
  let e2 = false;
  for (const c of body) {
    if (str) {
      if (e2) e2 = false;
      else if (c === '\\') e2 = true;
      else if (c === '"') str = false;
      continue;
    }
    if (c === '"') str = true;
    else if (c === '{') depth.push('}');
    else if (c === '[') depth.push(']');
    else if (c === '}' || c === ']') depth.pop();
  }
  body = body.replace(/,\s*$/, '');
  while (depth.length) body += depth.pop();
  try {
    JSON.parse(body);
    return body;
  } catch {
    return null;
  }
}

@Injectable()
export class TwinAiService {
  private readonly logger = new Logger(TwinAiService.name);

  constructor(private readonly config: ConfigService) {}

  private get model(): string {
    return this.config.get<string>('TWIN_AI_MODEL') || 'claude-sonnet-4-6';
  }

  private async callClaude<T>(system: string, user: string, maxTokens = 1500): Promise<AiResult<T>> {
    return this.callClaudeRaw<T>(system, [{ type: 'text', text: user }], maxTokens);
  }

  /**
   * Variante bas-niveau acceptant un tableau de content blocks (texte + image
   * base64). Sert pour la vision (M3 — OCR bilans image).
   */
  private async callClaudeRaw<T>(
    system: string,
    content: Array<Record<string, any>>,
    maxTokens = 1500,
  ): Promise<AiResult<T>> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'ANTHROPIC_API_KEY non configuré — analyse IA indisponible (le moteur de scores reste opérationnel).',
      );
    }
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Claude API error ${response.status}: ${body.slice(0, 300)}`);
      throw new ServiceUnavailableException(`Échec de l'analyse IA (${response.status})`);
    }
    const result: any = await response.json();
    // Concatène tous les blocs texte renvoyés (Claude peut splitter la réponse).
    const rawText: string = Array.isArray(result?.content)
      ? result.content
          .filter((c: any) => c?.type === 'text' && typeof c.text === 'string')
          .map((c: any) => c.text)
          .join('')
      : (result?.content?.[0]?.text ?? '');
    const tokens: number = result?.usage?.output_tokens ?? 0;
    const stopReason: string = result?.stop_reason ?? '';
    const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    let data: T;
    try {
      data = JSON.parse(cleaned);
    } catch {
      // Robustesse : le modèle enrobe parfois le JSON de prose (« Voici
      // l'analyse : {…} »), ou la sortie est coupée par max_tokens. On tente
      // dans l'ordre : 1er bloc équilibré, puis réparation d'un JSON tronqué.
      const block = extractJsonBlock(cleaned);
      const looseComma = (x: string | null) =>
        x ? x.replace(/,(\s*[}\]])/g, '$1') : null; // vire les virgules traînantes
      const repaired = repairTruncatedJson(block ?? cleaned);
      let parsed: T | undefined;
      for (const candidate of [
        block,
        looseComma(block),
        repaired,
        looseComma(repaired),
      ]) {
        if (parsed !== undefined || !candidate) continue;
        try {
          parsed = JSON.parse(candidate) as T;
        } catch {
          /* essaie le candidat suivant */
        }
      }
      if (parsed === undefined) {
        this.logger.error(
          `Réponse IA non parsable (stop_reason=${stopReason || 'n/a'}, ${tokens} tokens)`,
          rawText.slice(0, 300),
        );
        throw new ServiceUnavailableException(
          stopReason === 'max_tokens'
            ? 'Réponse IA trop longue (tronquée) — réessayez.'
            : `La réponse IA n'était pas un JSON valide.`,
        );
      }
      data = parsed;
    }
    return { data, model: this.model, tokens };
  }

  private contextBlock(ctx: PatientAiContext): string {
    const bm = ctx.biomarkers
      .map((b) => `- ${b.name_fr} (${b.code}) = ${b.value} ${b.unit} [${b.flag}]`)
      .join('\n');
    const sc = ctx.organ_scores
      .map((o) => `- ${o.organ_code}: ${o.score}/100 (${o.color})`)
      .join('\n');
    return [
      `Patient pseudonymisé — âge: ${ctx.age ?? 'inconnu'}, sexe: ${ctx.sex ?? 'inconnu'}.`,
      ctx.symptoms.length ? `Symptômes rapportés: ${ctx.symptoms.join(', ')}.` : 'Symptômes: non renseignés.',
      bm ? `Biomarqueurs:\n${bm}` : 'Biomarqueurs: aucun.',
      sc ? `Scores d'organes:\n${sc}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  /** Assistant Organe (M11 + M19 XAI) : « pourquoi cet organe est-il en rouge ? » */
  async organAssistant(
    ctx: PatientAiContext,
    organCode: string,
    organNameFr: string,
    question: string | undefined,
    graphEdges: Array<{ from_code: string; to_code: string; relation: string; label_fr: string | null }>,
  ): Promise<AiResult<{
    explanation_fr: string;
    involved_biomarkers: string[];
    correlations: string[];
    recommended_exams: string[];
    confidence: number;
  }>> {
    const edges = graphEdges
      .map((e) => `${e.from_code} --${e.relation}--> ${e.to_code}${e.label_fr ? ` (${e.label_fr})` : ''}`)
      .join('\n');
    const system =
      DISCLAIMER +
      ' Schéma JSON attendu: {"explanation_fr": string, "involved_biomarkers": string[], ' +
      '"correlations": string[], "recommended_exams": string[], "confidence": number}.';
    const user = [
      this.contextBlock(ctx),
      `\nOrgane analysé: ${organNameFr} (${organCode}).`,
      question ? `Question du thérapeute: ${question}` : `Question implicite: pourquoi cet organe a-t-il ce score ?`,
      edges ? `\nArêtes du graphe biologique pertinentes:\n${edges}` : '',
      `\nExplique de façon clinique et prudente, en t'appuyant sur les biomarqueurs et le graphe. Donne 2-4 examens complémentaires pertinents.`,
    ].join('\n');
    return this.callClaude(system, user, 1200);
  }

  /**
   * Assistant santé PATIENT (Chantier 4 — espace « Mon corps »).
   *
   * Réutilise tel quel le helper privé callClaude (fetch Anthropic + parsing
   * JSON strict + 503). Le `user` est construit à partir du même contexte
   * pseudonymisé que le copilote (contextBlock) ENRICHI de la roue de
   * transformation et des alertes ouvertes, puis du fil (~6 derniers tours)
   * et de la question courante.
   *
   * Le contexte chiffré sert au RAISONNEMENT du modèle ; les garde-fous
   * (pas de diagnostic, escalade, FR, white-label) vivent dans PATIENT_SYSTEM.
   * La sortie est STRICTEMENT JSON {reply, suggestions, escalate}.
   */
  async patientAssistant(
    ctx: PatientAiContext,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    extras?: {
      wheel?: Array<{ domain: string; score: number | null }>;
      openAlerts?: Array<{ severity: string; message: string }>;
    },
  ): Promise<AiResult<{ reply: string; suggestions: string[]; escalate: boolean }>> {
    const wheelBlock = (extras?.wheel ?? [])
      .filter((w) => w.score != null)
      .map((w) => `- ${w.domain}: ${w.score}/100`)
      .join('\n');
    const alertsBlock = (extras?.openAlerts ?? [])
      .map((a) => `- [${a.severity}] ${a.message}`)
      .join('\n');

    // Fil tronqué aux ~6 derniers messages pour borner les tokens.
    const recent = history.slice(-6);
    const historyBlock = recent
      .map((t) => `${t.role === 'user' ? 'Patient' : 'Assistant'}: ${t.content}`)
      .join('\n');

    const user = [
      this.contextBlock(ctx),
      wheelBlock ? `Roue de transformation (12 axes, /100) :\n${wheelBlock}` : '',
      alertsBlock ? `Alertes de suivi ouvertes :\n${alertsBlock}` : '',
      historyBlock ? `Conversation précédente :\n${historyBlock}` : '',
      `Nouveau message du patient : ${message}`,
      "Réponds de façon pédagogique et bienveillante, en t'appuyant uniquement sur ces données de suivi. " +
        'Si les données sont pauvres, reste utile de façon générale et invite à compléter le suivi, sans rien inventer.',
    ]
      .filter(Boolean)
      .join('\n\n');

    return this.callClaude<{ reply: string; suggestions: string[]; escalate: boolean }>(
      PATIENT_SYSTEM,
      user,
      900,
    );
  }

  /** Hypothèses différentielles + causes racines (M16/M18). */
  async generateHypotheses(
    ctx: PatientAiContext,
  ): Promise<AiResult<{
    hypotheses: Array<{
      label_fr: string;
      probability: number;
      confidence: number;
      reasoning_fr: string;
      args_for: string[];
      args_against: string[];
    }>;
  }>> {
    const system =
      DISCLAIMER +
      ' Schéma JSON attendu: {"hypotheses": [{"label_fr": string, "probability": number, ' +
      '"confidence": number, "reasoning_fr": string, "args_for": string[], "args_against": string[]}]}. ' +
      'Classe par probabilité décroissante. Donne 3 à 5 hypothèses concurrentes.';
    const user =
      this.contextBlock(ctx) +
      `\n\nGénère des hypothèses cliniques concurrentes (causes racines probables), chacune avec arguments pour/contre. Rappelle implicitement que ce ne sont pas des diagnostics.`;
    return this.callClaude(system, user, 4096);
  }

  /** Root Cause Explorer (M16) : causes racines classées par probabilité. */
  async rootCause(
    ctx: PatientAiContext,
  ): Promise<AiResult<{
    root_causes: Array<{ label_fr: string; probability: number; confidence: number; reasoning_fr: string; supporting_data: string[] }>;
  }>> {
    const system =
      DISCLAIMER +
      ' Identifie les CAUSES RACINES probables derrière le tableau du patient (pas les symptômes). ' +
      'Schéma JSON: {"root_causes": [{"label_fr": string, "probability": number, "confidence": number, ' +
      '"reasoning_fr": string, "supporting_data": string[]}]}. Classe par probabilité décroissante (3 à 5).';
    const user =
      this.contextBlock(ctx) +
      `\n\nRemonte aux causes racines les plus probables (ex: dysbiose, stress chronique, résistance insulinique…), avec les données qui les soutiennent.`;
    return this.callClaude(system, user, 4096);
  }

  /** Conseil de biologie multi-agents (M33) : 5 lentilles d'experts + consensus. */
  async council(
    ctx: PatientAiContext,
  ): Promise<AiResult<{
    experts: Array<{ specialty_fr: string; analysis_fr: string; key_recommendation_fr: string; confidence: number }>;
    consensus_fr: string;
    confidence: number;
  }>> {
    const system =
      DISCLAIMER +
      ' Tu simules un CONSEIL de 5 experts (endocrinologue, gastro-entérologue, nutritionniste fonctionnel, ' +
      'immunologiste, cardiologue). Chacun analyse le cas sous SA lentille, puis tu produis un consensus. ' +
      'Schéma JSON: {"experts": [{"specialty_fr": string, "analysis_fr": string, "key_recommendation_fr": string, ' +
      '"confidence": number}], "consensus_fr": string, "confidence": number}.';
    const user =
      this.contextBlock(ctx) +
      `\n\nFais délibérer le conseil et dégage un consensus clinique prudent (jamais un diagnostic).`;
    return this.callClaude(system, user, 5000);
  }

  /** Extraction de biomarqueurs depuis un texte de bilan (M3). */
  async extractBiomarkers(
    rawText: string,
    knownCodes: Array<{ code: string; name_fr: string }>,
  ): Promise<AiResult<{ values: Array<{ code: string; value: number; unit: string; confidence: number }> }>> {
    const dict = knownCodes.map((k) => `${k.code} = ${k.name_fr}`).join('; ');
    const system =
      DISCLAIMER +
      ' Tu extrais des valeurs de biomarqueurs depuis un compte-rendu de laboratoire. ' +
      'Mappe chaque valeur trouvée au code canonique correspondant. Ignore ce que tu ne reconnais pas. ' +
      'Schéma JSON attendu: {"values": [{"code": string, "value": number, "unit": string, "confidence": number}]}.';
    const user = `Codes canoniques disponibles: ${dict}\n\nTexte du bilan:\n"""\n${rawText.slice(0, 12000)}\n"""`;
    return this.callClaude(system, user, 1500);
  }

  /**
   * Extraction de biomarqueurs depuis une IMAGE de bilan (M3 — Claude Vision).
   * Le buffer est encodé en base64 et envoyé comme content block image.
   * Mêmes contraintes de sortie que extractBiomarkers (codes canoniques, JSON strict).
   */
  async extractBiomarkersFromImage(
    base64Image: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
    knownCodes: Array<{ code: string; name_fr: string }>,
  ): Promise<AiResult<{ values: Array<{ code: string; value: number; unit: string; confidence: number }> }>> {
    const dict = knownCodes.map((k) => `${k.code} = ${k.name_fr}`).join('; ');
    const system =
      DISCLAIMER +
      ' Tu extrais des valeurs de biomarqueurs depuis l\'IMAGE d\'un compte-rendu de laboratoire. ' +
      'Lis attentivement le tableau, identifie chaque ligne (nom du test, valeur, unité), puis mappe au code canonique. ' +
      'Si une valeur est illisible ou ambiguë, baisse la confidence. Ignore ce que tu ne reconnais pas. ' +
      'Schéma JSON attendu: {"values": [{"code": string, "value": number, "unit": string, "confidence": number}]}.';
    const userText =
      `Codes canoniques disponibles: ${dict}\n\n` +
      `Analyse l'image ci-jointe : extrait UNIQUEMENT les biomarqueurs reconnaissables et renvoie le JSON.`;
    const content: Array<Record<string, any>> = [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64Image },
      },
      { type: 'text', text: userText },
    ];
    return this.callClaudeRaw(system, content, 1800);
  }
}
