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

@Injectable()
export class TwinAiService {
  private readonly logger = new Logger(TwinAiService.name);

  constructor(private readonly config: ConfigService) {}

  private get model(): string {
    return this.config.get<string>('TWIN_AI_MODEL') || 'claude-3-5-sonnet-20241022';
  }

  private async callClaude<T>(system: string, user: string, maxTokens = 1500): Promise<AiResult<T>> {
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
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Claude API error ${response.status}: ${body.slice(0, 300)}`);
      throw new ServiceUnavailableException(`Échec de l'analyse IA (${response.status})`);
    }
    const result: any = await response.json();
    const rawText: string = result?.content?.[0]?.text ?? '';
    const tokens: number = result?.usage?.output_tokens ?? 0;
    const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    let data: T;
    try {
      data = JSON.parse(cleaned);
    } catch {
      this.logger.error('Réponse IA non parsable', rawText.slice(0, 300));
      throw new ServiceUnavailableException(`La réponse IA n'était pas un JSON valide.`);
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
    return this.callClaude(system, user, 2000);
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
}
