import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  Comprehension,
  MasterScriptMoment,
  PivotNotion,
  SmartboardGptSlide,
} from './pivot.types';

/**
 * LE FOND DU TABLEAU — production pédagogique réelle, moment par moment.
 *
 * Le tableau vivant est vivant côté RENDU (révélation séquentielle, écriture à la
 * main, croquis, surlignage) mais ce qu'il RACONTE sortait d'un gabarit
 * déterministe : mêmes phrases, mêmes enchaînements, quelle que soit la notion.
 * Ce service produit la slide au vocabulaire exact du rendu — et rien d'autre :
 * il ne touche ni à la narration, ni aux timings, ni aux croquis.
 *
 * ⚠️ CONTRAT DE REPLI : l'IA est un BONUS. Un moment qui échoue, qui revient
 * vide ou qui viole la garde anti-invention retombe sur le gabarit déterministe
 * de `MasterFactoryService`. Aucun appel de ce service ne doit empêcher la
 * production d'un tableau.
 */

/** Slide au vocabulaire du rendu, hors habillage visuel (croquis/images restent dérivés). */
export type PedagogySlide = Omit<SmartboardGptSlide, 'sketch' | 'hero_visual' | 'illustration'>;

export interface PedagogyEnrichment {
  /** Clé = `MasterScriptMoment.id`. Un moment absent = gabarit déterministe. */
  slides: Record<string, PedagogySlide>;
  ai_moments: number;
  template_moments: number;
  /** Slides écartées par la garde anti-invention (comptées aussi en gabarit). */
  rejected_moments: number;
  /** Moments perdus faute de réponse exploitable (comptés aussi en gabarit). */
  failed_moments: number;
  /** Étiquette de modèle, seulement si au moins un moment est réellement IA. */
  model: string | null;
}

@Injectable()
export class PedagogyAiService {
  private readonly log = new Logger(PedagogyAiService.name);

  /** Étiquette écrite dans `course_pivots.model` quand l'IA a réellement servi. */
  static readonly MODEL_TAG = 'pedagogy-ai-v1';

  /** Lots de moments traités en parallèle (même ménagement du fournisseur que ComprehensionService). */
  private static readonly BATCH = 4;

  constructor(private readonly config: ConfigService) {}

  // ───────────────────────────── LLM ─────────────────────────────
  //
  // ⚠️ DUPLICATION ASSUMÉE de `resolveLlm`/`askLlm`/`parseJsonLoose`
  // (ComprehensionService, TranscriptCourseService, ReplayChaptersService les
  // portent déjà chacun). L'extraction dans un helper partagé du dossier
  // supposerait de modifier ces trois services, qui sont hors du périmètre de
  // ce chantier. Le mécanisme est repris À L'IDENTIQUE (DeepSeek puis Groq,
  // `json_object`, réparation de JSON tronqué, 3 essais à budget croissant) :
  // toute correction faite là-bas doit être reportée ici tant que la
  // factorisation n'est pas faite.

  private resolveLlm(fast: boolean) {
    const deepseek = this.config.get<string>('DEEPSEEK_API_KEY');
    const groq = this.config.get<string>('GROQ_API_KEY');
    if (deepseek && deepseek !== 'replace_me') {
      return {
        url: 'https://api.deepseek.com/chat/completions',
        key: deepseek,
        model: fast ? 'deepseek-v4-flash' : 'deepseek-v4-pro',
      };
    }
    if (groq && groq !== 'replace_me') {
      return {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: groq,
        model: 'llama-3.3-70b-versatile',
      };
    }
    throw new ServiceUnavailableException(
      'Aucune clé IA configurée (DEEPSEEK_API_KEY ou GROQ_API_KEY).',
    );
  }

  /**
   * Appel LLM résilient.
   *
   * ⛔ Deux leçons mesurées en production, conservées telles quelles :
   * 1. `deepseek-v4-pro` (modèle à raisonnement) rend un `content` VIDE en HTTP
   *    200 sur une extraction JSON structurée : on travaille en `v4-flash`.
   * 2. Un `max_tokens` trop bas ne lève AUCUNE erreur — il rend un trou
   *    silencieux. Une slide est courte, mais le budget monte à chaque essai.
   */
  private async askLlm(
    system: string,
    user: string,
    opts: { maxTokens?: number; timeoutMs?: number; label?: string } = {},
  ): Promise<any> {
    const maxTokens = opts.maxTokens ?? 2500;
    const timeoutMs = opts.timeoutMs ?? 90000;
    let lastErr: Error | null = null;

    for (let i = 0; i < 3; i += 1) {
      const llm = this.resolveLlm(true); // toujours le modèle non-raisonnant ici
      const budget = Math.min(16000, Math.round(maxTokens * (1 + i * 0.4)));
      try {
        const res = await fetch(llm.url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${llm.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: llm.model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: budget,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: any = await res.json();
        const content = String(json?.choices?.[0]?.message?.content || '').trim();
        if (!content) {
          // Journalisé : une réponse vide est un TROU, pas une erreur visible.
          this.log.warn(
            `[${opts.label ?? 'llm'}] réponse VIDE (essai ${i + 1}, budget ${budget}, finish=${json?.choices?.[0]?.finish_reason})`,
          );
          throw new Error('Réponse vide');
        }
        return this.parseJsonLoose(content);
      } catch (e) {
        lastErr = e as Error;
      }
    }
    throw new ServiceUnavailableException(
      `Production impossible (${opts.label ?? 'llm'}) : ${lastErr?.message ?? 'inconnu'}`,
    );
  }

  /** Répare un JSON tronqué (referme les structures ouvertes) plutôt que de tout perdre. */
  private parseJsonLoose(raw: string): any {
    const text = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try {
      return JSON.parse(text);
    } catch {
      /* on tente la réparation */
    }
    const start = text.search(/[[{]/);
    if (start < 0) throw new Error('Réponse IA illisible');
    let inStr = false;
    let esc = false;
    const stack: string[] = [];
    let out = '';
    for (let i = start; i < text.length; i += 1) {
      const c = text[i];
      out += c;
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
      else if (c === '}' || c === ']') stack.pop();
    }
    if (inStr) out += '"';
    while (stack.length) out += stack.pop();
    return JSON.parse(out);
  }

  // ─────────────────────────── Le prompt ───────────────────────────

  private static readonly SYS_SLIDE = `Tu écris le TABLEAU d'un professeur pour UN SEUL moment de cours. Ce tableau est projeté pendant qu'il parle : ce qui est écrit doit être VRAI, COURT et UTILE.

MATIÈRE AUTORISÉE : la notion fournie et ses APPUIS (extraits réels de la source). RIEN D'AUTRE.

RÈGLES ABSOLUES :
- ⛔ INTERDIT d'inventer un fait, un chiffre, une date, un auteur, une définition ou un exemple qui ne soit pas dans la matière fournie.
- ⛔ INTERDIT de remplir pour remplir : pas de phrase décorative, pas de généralité creuse (« il est important de comprendre que… »), pas de méta-discours sur le cours lui-même.
- TITRE : formulé comme une IDÉE, pas comme une étiquette. Mauvais : « Loi de variance ». Bon : « Toute transformation provient d'une variation ».
- SUBTITLE : ce que ce moment ajoute à ce qui précède. Une ligne, ou rien.
- CORE_IDEA : UNE phrase, la thèse du moment, avec les mots de la notion.
- DEVELOPMENT : 1 à 3 groupes, 2 à 4 points chacun. Un point = une affirmation courte tirée de la matière, PAS un titre de rubrique.
- SLIDE_SUMMARY : une phrase mémorisable de MOINS DE 15 MOTS.
- STUDENT_PROMPT : une question qui oblige l'élève à reformuler ou à appliquer. Jamais une question fermée par oui/non.
- Si la matière est trop maigre, rends "development": [] — un tableau honnête vaut mieux qu'un tableau gonflé.

RÉPONSE — JSON strict, sans texte autour :
{"title":"…","subtitle":"…","core_idea":"…","development":[{"label":"…","points":["…"]}],"slide_summary":"…","student_prompt":"…"}`;

  private buildUserPrompt(
    comprehension: Comprehension,
    moment: MasterScriptMoment,
    notion: PivotNotion | undefined,
  ): string {
    const appuis = this.usableAppuis(notion);
    const glossaire = (comprehension.glossaire || [])
      .filter((g) => g?.terme && this.mentions(moment, notion, g.terme))
      .slice(0, 6)
      .map((g) => `- ${g.terme} : ${g.simple}`)
      .join('\n');
    return [
      `COURS : ${comprehension.titre}`,
      comprehension.promesse ? `PROMESSE DU COURS : ${comprehension.promesse}` : null,
      comprehension.public ? `PUBLIC : ${comprehension.public}` : null,
      '',
      `MOMENT ${moment.id} — ${moment.title}`,
      moment.intention ? `INTENTION : ${moment.intention}` : null,
      moment.message_central ? `MESSAGE CENTRAL : ${moment.message_central}` : null,
      notion?.idee_centrale ? `IDÉE CENTRALE DE LA NOTION : ${notion.idee_centrale}` : null,
      notion?.pourquoi ? `POURQUOI CE POINT COMPTE : ${notion.pourquoi}` : null,
      '',
      appuis.length
        ? `APPUIS (SEULE MATIÈRE FACTUELLE AUTORISÉE) :\n${appuis.map((a) => `- ${a}`).join('\n')}`
        : 'APPUIS : aucun appui exploitable — reste STRICTEMENT sur le message central, ne complète rien.',
      glossaire ? `\nGLOSSAIRE UTILE :\n${glossaire}` : null,
      '',
      'Produis le tableau de CE moment, au format JSON demandé.',
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  // ─────────────────── Garde anti-invention (⛔ obligatoire) ───────────────────

  /**
   * Mots vides français d'au moins 4 lettres : sans eux, « comprendre », « chaque »
   * ou « toutes » suffiraient à faire passer une slide entièrement inventée.
   */
  private static readonly STOPWORDS = new Set([
    'alors', 'ainsi', 'aussi', 'autre', 'autres', 'avec', 'avoir', 'avons', 'bien', 'cela',
    'celle', 'celles', 'celui', 'cette', 'ceux', 'chaque', 'chose', 'comme', 'comment',
    'dans', 'depuis', 'donc', 'dont', 'elle', 'elles', 'encore', 'entre', 'etait', 'etre',
    'faire', 'fait', 'faut', 'leur', 'leurs', 'lorsque', 'mais', 'meme', 'memes', 'moins',
    'notre', 'nous', 'parce', 'pendant', 'peut', 'peuvent', 'plus', 'pour', 'pourquoi',
    'quand', 'quel', 'quelle', 'quelles', 'quels', 'sans', 'sera', 'seront', 'sont', 'sous',
    'sur', 'tous', 'tout', 'toute', 'toutes', 'tres', 'votre', 'vous',
  ]);

  /** Mots significatifs : ≥ 4 lettres, accents neutralisés, mots vides écartés. */
  private significantWords(text: unknown): Set<string> {
    return new Set(
      String(text || '')
        .toLocaleLowerCase('fr')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length >= 4 && !PedagogyAiService.STOPWORDS.has(word)),
    );
  }

  /** Vocabulaire réellement présent dans la source pour ce moment. */
  private sourceVocabulary(moment: MasterScriptMoment, notion: PivotNotion | undefined): Set<string> {
    const parts = [
      moment.title,
      moment.message_central,
      moment.intention,
      ...(moment.key_points || []),
      notion?.titre,
      notion?.idee_centrale,
      notion?.pourquoi,
      ...this.usableAppuis(notion),
    ];
    const out = new Set<string>();
    for (const part of parts) {
      for (const word of this.significantWords(part)) out.add(word);
    }
    return out;
  }

  private mentions(moment: MasterScriptMoment, notion: PivotNotion | undefined, term: string): boolean {
    const vocabulary = this.sourceVocabulary(moment, notion);
    for (const word of this.significantWords(term)) {
      if (vocabulary.has(word)) return true;
    }
    return false;
  }

  /**
   * Des pivots historiques portent `appuis` en CHAÎNE : un spread l'éclaterait
   * caractère par caractère (origine réelle des points « K »/« a »).
   */
  private usableAppuis(notion: PivotNotion | undefined): string[] {
    const raw: unknown[] = Array.isArray(notion?.appuis)
      ? (notion?.appuis as unknown[])
      : notion?.appuis
        ? [notion.appuis]
        : [];
    return raw
      .map((appui) => String(appui || '').trim())
      .filter((appui) => appui.length >= 3)
      .slice(0, 6);
  }

  // ────────────────────────── Normalisation ──────────────────────────

  private text(value: unknown, max: number): string {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  /** LOI DU PROMPT : moins de 15 mots. Le modèle déborde — on coupe pour de vrai. */
  private clampSummary(value: unknown): string {
    const words = this.text(value, 220).split(' ').filter(Boolean);
    return words.length <= 14 ? words.join(' ') : words.slice(0, 14).join(' ');
  }

  private normalizeSlide(raw: any): PedagogySlide | null {
    const title = this.text(raw?.title, 160);
    const coreIdea = this.text(raw?.core_idea ?? raw?.coreIdea, 400);
    if (!title || !coreIdea) return null;

    const rawDev = Array.isArray(raw?.development) ? raw.development : [];
    const development = rawDev
      .slice(0, 3)
      .map((group: any) => ({
        label: this.text(group?.label, 80),
        points: (Array.isArray(group?.points) ? group.points : [])
          .map((point: unknown) => this.text(point, 220))
          .filter((point: string) => point.length >= 3)
          .slice(0, 4),
      }))
      .filter((group: { label: string; points: string[] }) => group.points.length > 0)
      .map((group: { label: string; points: string[] }) => ({
        label: group.label || 'À retenir',
        points: group.points,
      }));

    const subtitle = this.text(raw?.subtitle, 200);
    const studentPrompt = this.text(raw?.student_prompt ?? raw?.studentPrompt, 240);
    return {
      title,
      subtitle: subtitle || undefined,
      core_idea: coreIdea,
      development,
      slide_summary: this.clampSummary(raw?.slide_summary ?? raw?.slideSummary) || undefined,
      student_prompt: studentPrompt || undefined,
    };
  }

  // ──────────────────────────── Production ────────────────────────────

  /**
   * Produit la slide de CHAQUE moment. Traitement par lots, échec TOLÉRÉ par
   * moment : l'appelant complète les moments manquants avec son gabarit.
   *
   * `tenantId` ne sert ici qu'à tracer les journaux — aucun compteur de
   * facturation IA n'est branché sur ce service (à faire si l'usage grossit).
   */
  async enrichScenes(
    tenantId: string,
    comprehension: Comprehension,
    moments: MasterScriptMoment[],
    opts: { batchSize?: number } = {},
  ): Promise<PedagogyEnrichment> {
    const list = Array.isArray(moments) ? moments : [];
    const batch = Math.max(1, Math.min(8, opts.batchSize ?? PedagogyAiService.BATCH));
    const notionById = new Map<string, PivotNotion>(
      (comprehension?.notions || []).map((notion) => [notion.id, notion]),
    );

    const slides: Record<string, PedagogySlide> = {};
    let rejected = 0;
    let failed = 0;

    for (let i = 0; i < list.length; i += batch) {
      const lot = list.slice(i, i + batch);
      const produced = await Promise.all(
        lot.map(async (moment, k) => {
          const index = i + k + 1;
          const notion = moment.notion_id ? notionById.get(moment.notion_id) : undefined;
          try {
            const raw = await this.askLlm(
              PedagogyAiService.SYS_SLIDE,
              this.buildUserPrompt(comprehension, moment, notion),
              { maxTokens: 2500, label: `slide#${index}` },
            );
            const slide = this.normalizeSlide(raw);
            if (!slide) {
              this.log.warn(`[pedagogy-ai][${tenantId}] moment ${moment.id} : slide illisible`);
              return { moment, slide: null as PedagogySlide | null, rejected: false };
            }
            // ⛔ GARDE ANTI-INVENTION : une idée centrale qui ne partage AUCUN mot
            // significatif avec la notion ou ses appuis ne vient pas de la source.
            // ⚠️ PORTÉE RÉELLE : seul `core_idea` est contrôlé. Un point de
            // développement inventé sous une idée centrale fidèle PASSE encore.
            const vocabulary = this.sourceVocabulary(moment, notion);
            const shared = [...this.significantWords(slide.core_idea)].filter((word) =>
              vocabulary.has(word),
            );
            if (!shared.length) {
              this.log.warn(
                `[pedagogy-ai][${tenantId}] moment ${moment.id} ÉCARTÉ (anti-invention) : « ${slide.core_idea.slice(0, 80)} »`,
              );
              return { moment, slide: null as PedagogySlide | null, rejected: true };
            }
            return { moment, slide, rejected: false };
          } catch (e) {
            // Un moment perdu ne tue pas la production — il retombe sur le gabarit.
            this.log.warn(
              `[pedagogy-ai][${tenantId}] moment ${moment.id} perdu : ${(e as Error).message}`,
            );
            return { moment, slide: null as PedagogySlide | null, rejected: false };
          }
        }),
      );
      for (const res of produced) {
        if (res.slide) slides[res.moment.id] = res.slide;
        else if (res.rejected) rejected += 1;
        else failed += 1;
      }
    }

    const aiMoments = Object.keys(slides).length;
    this.log.log(
      `[pedagogy-ai][${tenantId}] ${aiMoments}/${list.length} moment(s) IA — ${rejected} écarté(s), ${failed} perdu(s)`,
    );
    return {
      slides,
      ai_moments: aiMoments,
      template_moments: list.length - aiMoments,
      rejected_moments: rejected,
      failed_moments: failed,
      // Étiquette posée UNIQUEMENT si l'IA a réellement produit : sinon le cache
      // servirait un gabarit déguisé en production IA.
      model: aiMoments > 0 ? PedagogyAiService.MODEL_TAG : null,
    };
  }
}
