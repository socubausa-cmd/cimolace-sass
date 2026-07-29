import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { SourceAdaptersService } from './source-adapters.service';
import type { Comprehension, PivotNotion, SourceType } from './pivot.types';

/**
 * LE NOYAU — lot 2 de l'Atelier unifié.
 *
 * Produit le pivot NIVEAU 1 (`Comprehension`) : le FOND d'une source, extrait
 * UNE SEULE FOIS. C'est l'étape coûteuse. Toutes les formes (cours écrit, cours
 * joué) et tous les rendus (PDF, parcours, masterclass…) en découlent ensuite
 * SANS rappeler le modèle.
 *
 * Avant, cinq moteurs refaisaient ce travail chacun de leur côté, sur la même
 * transcription, pour n'écrire qu'à la fin dans des formats incompatibles.
 */
@Injectable()
export class ComprehensionService {
  private readonly log = new Logger(ComprehensionService.name);

  /** Découpe : ~9 000 caractères, 600 de chevauchement (une notion à cheval
   *  sur deux tranches doit rester lisible dans au moins l'une des deux). */
  private static readonly CHUNK = 9000;
  private static readonly OVERLAP = 600;
  private static readonly MAX_SEGMENTS = 40;
  /** Lots de segments traités en parallèle (ménage le fournisseur). */
  private static readonly BATCH = 4;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly sources: SourceAdaptersService,
  ) {}

  // ───────────────────────────── LLM ─────────────────────────────

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
   * ⛔ DEUX LEÇONS MESURÉES EN PRODUCTION, appliquées ici :
   * 1. `deepseek-v4-pro` (modèle à raisonnement) ne rend RIEN sur une extraction
   *    JSON structurée, même à 12 000 jetons : sa réflexion consomme tout le
   *    budget et le `content` revient VIDE en HTTP 200. On travaille donc en
   *    `v4-flash` sur ce type de tâche.
   * 2. Un `max_tokens` trop bas ne lève AUCUNE erreur — il rend un trou
   *    silencieux. Plancher ~9 000 pour du JSON structuré ; le plafond ne coûte
   *    rien tant qu'il n'est pas consommé.
   */
  private async askLlm(
    system: string,
    user: string,
    opts: { maxTokens?: number; timeoutMs?: number; label?: string } = {},
  ): Promise<any> {
    const maxTokens = opts.maxTokens ?? 9000;
    const timeoutMs = opts.timeoutMs ?? 150000;
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
      `Analyse impossible (${opts.label ?? 'llm'}) : ${lastErr?.message ?? 'inconnu'}`,
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
    let depth = 0;
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
      if (c === '{' || c === '[') { stack.push(c === '{' ? '}' : ']'); depth += 1; }
      else if (c === '}' || c === ']') { stack.pop(); depth -= 1; }
    }
    if (inStr) out += '"';
    while (stack.length) out += stack.pop();
    return JSON.parse(out);
  }

  /** Découpe en tranches, en coupant de préférence en fin de phrase. */
  private segment(text: string): string[] {
    const { CHUNK, OVERLAP, MAX_SEGMENTS } = ComprehensionService;
    if (text.length <= CHUNK) return [text];
    const out: string[] = [];
    let i = 0;
    while (i < text.length && out.length < MAX_SEGMENTS) {
      let end = Math.min(i + CHUNK, text.length);
      if (end < text.length) {
        const window = text.slice(Math.max(i, end - 800), end);
        const dot = window.lastIndexOf('. ');
        if (dot > 200) end = Math.max(i, end - 800) + dot + 1;
      }
      out.push(text.slice(i, end));
      if (end >= text.length) break;
      i = Math.max(i + 1, end - OVERLAP);
    }
    return out;
  }

  /** Rattache un appui textuel au meilleur repère de transcription. */
  private locateSourceSpans(appuis: string[], cues?: { t: number; text: string }[]) {
    if (!Array.isArray(cues) || !cues.length) return undefined;
    const words = (text: string) => new Set(
      String(text || '')
        .toLocaleLowerCase('fr')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length >= 4),
    );
    const spans: { start_sec: number; end_sec: number }[] = [];
    for (const appui of appuis.slice(0, 3)) {
      const needle = words(appui);
      if (!needle.size) continue;
      let best = { index: -1, overlap: 0, score: 0 };
      cues.forEach((cue, index) => {
        const hay = words(cue.text);
        const overlap = [...needle].filter((word) => hay.has(word)).length;
        const score = overlap / needle.size;
        if (overlap > best.overlap || (overlap === best.overlap && score > best.score)) {
          best = { index, overlap, score };
        }
      });
      if (best.index < 0 || best.overlap < 2 || best.score < 0.3) continue;
      const start = Number(cues[best.index].t) || 0;
      const next = Number(cues[best.index + 1]?.t);
      spans.push({ start_sec: start, end_sec: Number.isFinite(next) ? next : start + 30 });
    }
    const unique = spans.filter(
      (span, index) => spans.findIndex((candidate) => candidate.start_sec === span.start_sec) === index,
    );
    return unique.length ? unique : undefined;
  }

  // ─────────────────────── Extraction du FOND ───────────────────────

  private static readonly SYS_MAP = `Tu analyses la TRANSCRIPTION ORALE BRUTE d'un enseignement (dictée automatique : hésitations, répétitions, faux départs, mots mal transcrits, incidents techniques).

Ton travail : en extraire les NOTIONS ENSEIGNÉES — pas résumer.

RÈGLES ABSOLUES :
- Tu n'inventes RIEN. Chaque notion doit s'appuyer sur ce qui est RÉELLEMENT dit.
- Le champ "appuis" contient des extraits ou faits TIRÉS DU TEXTE. Une notion sans appui est interdite.
- Tu ignores salutations, digressions, problèmes de son, bavardages.
- Tu corriges les mots manifestement mal transcrits quand le sens est certain.
- GRANULARITÉ : 3 à 8 notions pour cet extrait. Pas une seule notion fourre-tout.

RÉPONSE — JSON strict :
{"notions":[{"titre":"…","idee_centrale":"une phrase","pourquoi":"pourquoi ça compte pour l'élève","appuis":["extrait réel du texte"]}],
 "glossaire":[{"terme":"…","simple":"définition en langage ordinaire"}]}`;

  private static readonly SYS_REDUCE = `Tu reçois les NOTIONS extraites de plusieurs extraits d'un même enseignement. Tu construis la CHARPENTE du cours.

RÈGLES ABSOLUES :
- ⛔ INTERDICTION D'INVENTER une notion absente de la liste reçue.
- Tu FUSIONNES les doublons (les extraits se chevauchent, une notion revient souvent).
- Tu ORDONNES du plus simple au plus complexe, en respectant les prérequis.
- Mieux vaut 3 notions honnêtes que 10 notions gonflées.
- Tu conserves les "appuis" d'origine : ils tracent la notion jusqu'à la source.

RÉPONSE — JSON strict :
{"titre":"titre du cours","promesse":"ce que l'élève saura FAIRE, une phrase concrète",
 "public":"à qui ça s'adresse","prerequis":["…"],
 "notions":[{"id":"n1","titre":"…","idee_centrale":"…","pourquoi":"…","prerequis":["n0"],"appuis":["…"]}],
 "glossaire":[{"terme":"…","simple":"…"}]}`;

  /**
   * Extrait (ou récupère) la `Comprehension` d'une source.
   * Si le pivot existe déjà, il est RENDU TEL QUEL — on ne repaye jamais l'IA
   * deux fois pour la même source, sauf `force`.
   */
  async build(
    tenantId: string,
    sourceType: SourceType,
    sourceId: string,
    opts: { force?: boolean } = {},
  ): Promise<{ pivotId: string; comprehension: Comprehension; cached: boolean }> {
    if (!opts.force) {
      const existing = await this.findPivot(tenantId, sourceType, sourceId);
      if (existing) {
        return { pivotId: existing.id, comprehension: existing.payload, cached: true };
      }
    }

    const src = await this.sources.load(sourceType, sourceId, tenantId);
    const segments = this.segment(src.transcript);
    this.log.log(
      `[comprehension] ${sourceType}/${sourceId} — ${src.transcript.length} car → ${segments.length} segment(s)`,
    );

    // ── MAP : notions par segment, par lots ──
    const notionsBrutes: any[] = [];
    const glossaireBrut: any[] = [];
    for (let i = 0; i < segments.length; i += ComprehensionService.BATCH) {
      const lot = segments.slice(i, i + ComprehensionService.BATCH);
      const res = await Promise.all(
        lot.map((seg, k) =>
          this.askLlm(ComprehensionService.SYS_MAP, `EXTRAIT ${i + k + 1}/${segments.length} :\n\n${seg}`, {
            maxTokens: 9000,
            label: `map#${i + k + 1}`,
          }).catch((e) => {
            // Un segment perdu ne doit pas tuer l'extraction — mais il est TRACÉ.
            this.log.warn(`[comprehension] segment ${i + k + 1} perdu : ${(e as Error).message}`);
            return null;
          }),
        ),
      );
      for (const r of res) {
        if (!r) continue;
        if (Array.isArray(r.notions)) notionsBrutes.push(...r.notions);
        if (Array.isArray(r.glossaire)) glossaireBrut.push(...r.glossaire);
      }
    }
    if (!notionsBrutes.length) {
      throw new ServiceUnavailableException(
        "Aucune notion n'a pu être extraite de cette source.",
      );
    }

    // ── REDUCE : charpente ordonnée ──
    const plan = await this.askLlm(
      ComprehensionService.SYS_REDUCE,
      `NOTIONS EXTRAITES (${notionsBrutes.length}) :\n${JSON.stringify(notionsBrutes).slice(0, 40000)}\n\nGLOSSAIRE :\n${JSON.stringify(glossaireBrut).slice(0, 6000)}`,
      { maxTokens: 12000, label: 'reduce' },
    );

    // ── ⛔ GARDE ANTI-INVENTION : toute notion sans appui est ÉCARTÉE ──
    const notions: PivotNotion[] = (Array.isArray(plan.notions) ? plan.notions : [])
      .filter((n: any) => Array.isArray(n?.appuis) && n.appuis.length > 0 && n?.titre)
      .map((n: any, idx: number) => ({
        id: String(n.id || `n${idx + 1}`),
        titre: String(n.titre),
        idee_centrale: String(n.idee_centrale || ''),
        pourquoi: String(n.pourquoi || ''),
        prerequis: Array.isArray(n.prerequis) ? n.prerequis.map(String) : undefined,
        appuis: n.appuis.map(String).slice(0, 6),
        source_spans: this.locateSourceSpans(n.appuis.map(String), src.cues),
      }));
    const ecartees = (Array.isArray(plan.notions) ? plan.notions.length : 0) - notions.length;
    if (ecartees > 0) {
      this.log.warn(`[comprehension] ${ecartees} notion(s) SANS APPUI écartée(s) (anti-invention)`);
    }
    if (!notions.length) {
      throw new ServiceUnavailableException(
        "Toutes les notions produites étaient sans appui dans la source : rien de fiable à retenir.",
      );
    }

    const comprehension: Comprehension = {
      schema_version: 1,
      titre: String(plan.titre || src.title),
      promesse: String(plan.promesse || ''),
      public: plan.public ? String(plan.public) : undefined,
      prerequis: Array.isArray(plan.prerequis) ? plan.prerequis.map(String) : undefined,
      notions,
      glossaire: (Array.isArray(plan.glossaire) ? plan.glossaire : [])
        .filter((g: any) => g?.terme)
        .map((g: any) => ({ terme: String(g.terme), simple: String(g.simple || '') }))
        .slice(0, 40),
      meta: {
        source_type: sourceType,
        source_id: sourceId,
        source_title: src.title,
        duration_min: src.durationSec ? Math.round(src.durationSec / 60) : undefined,
        transcript_chars: src.transcript.length,
        segments: segments.length,
        model: this.resolveLlm(true).model,
        generated_at: new Date().toISOString(),
      },
    };

    const pivotId = await this.savePivot(tenantId, sourceType, sourceId, comprehension);
    this.log.log(
      `[comprehension] ✅ ${notions.length} notion(s), ${comprehension.glossaire.length} terme(s) — pivot ${pivotId}`,
    );
    return { pivotId, comprehension, cached: false };
  }

  private async findPivot(tenantId: string, sourceType: SourceType, sourceId: string) {
    const { data } = await (this.supabase.client as any)
      .from('course_pivots')
      .select('id, payload')
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('kind', 'comprehension')
      .is('parent_id', null)
      .maybeSingle();
    return data ?? null;
  }

  private async savePivot(
    tenantId: string,
    sourceType: SourceType,
    sourceId: string,
    payload: Comprehension,
  ): Promise<string> {
    const row = {
      tenant_id: tenantId,
      source_type: sourceType,
      source_id: sourceId,
      kind: 'comprehension',
      payload,
      model: payload.meta.model,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await (this.supabase.client as any)
      .from('course_pivots')
      .upsert(row, { onConflict: 'tenant_id,source_type,source_id,kind' })
      .select('id')
      .single();
    if (error) {
      // L'upsert échoue si l'index partiel n'est pas reconnu comme cible :
      // on retombe alors sur un simple insert (le doublon est déjà écarté plus haut).
      const ins = await (this.supabase.client as any)
        .from('course_pivots')
        .insert(row)
        .select('id')
        .single();
      if (ins.error) throw new ServiceUnavailableException(ins.error.message);
      return ins.data.id;
    }
    return data.id;
  }
}
