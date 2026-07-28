import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { SourceType } from './pivot.types';

/**
 * RENDUS DEPUIS LE PIVOT — lot 4 de l'Atelier unifié.
 *
 * Un cours construit une fois doit pouvoir ressortir dans plusieurs formats
 * SANS rappeler le modèle. Le worker range désormais ses leçons rédigées dans
 * un pivot « ecrit » ; ce service les relit et les met à la forme demandée.
 *
 * Le format PDF est un SOUS-ENSEMBLE du pivot écrit (3 champs par leçon contre
 * 11) : c'est donc un rendu DÉGRADÉ, jamais une seconde génération.
 */

/** Forme attendue par `apps/app/src/lib/exportCoursePdf.js` — ne pas dévier. */
export interface ExtractedCourseShape {
  title: string;
  subtitle?: string;
  summary: string;
  objectives: string[];
  modules: { title: string; description?: string; lessons: { title: string; content: string; key_points?: string[] }[] }[];
  glossary: { term: string; definition: string }[];
  meta: Record<string, unknown>;
}

@Injectable()
export class RenderPivotService {
  private readonly log = new Logger(RenderPivotService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * PDF depuis le pivot. Ne génère RIEN : si le cours écrit n'existe pas encore,
   * on le dit franchement plutôt que de relancer une facture IA en douce.
   */
  async renderPdf(
    tenantId: string,
    sourceType: SourceType,
    sourceId: string,
  ): Promise<ExtractedCourseShape> {
    const { data: root } = await (this.supabase.client as any)
      .from('course_pivots')
      .select('id, payload')
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('kind', 'comprehension')
      .is('parent_id', null)
      .maybeSingle();
    if (!root) {
      throw new NotFoundException(
        "Cette source n'a pas encore été comprise : lance d'abord l'analyse dans l'Atelier.",
      );
    }

    const { data: ecrit } = await (this.supabase.client as any)
      .from('course_pivots')
      .select('payload')
      .eq('parent_id', root.id)
      .eq('kind', 'ecrit')
      .maybeSingle();
    if (!ecrit) {
      throw new NotFoundException(
        "Le cours écrit n'existe pas encore pour cette source : construis-le d'abord (le PDF en découlera sans nouveau coût).",
      );
    }

    const comp = root.payload ?? {};
    const lecons: any[] = Array.isArray(ecrit.payload?.lecons) ? ecrit.payload.lecons : [];

    // Une leçon riche (11 blocs) → un texte suivi lisible en PDF.
    const lessons = lecons.map((l) => ({
      title: String(l.titre || 'Leçon'),
      content: [
        l.amorce?.situation,
        l.amorce?.question,
        l.intuition,
        typeof l.definition === 'string' ? l.definition : l.definition?.enonce,
        l.exemple?.deroule ? `Exemple — ${l.exemple.deroule}` : null,
        l.contre_exemple?.pourquoi_faux ? `Ce que ce n'est pas — ${l.contre_exemple.pourquoi_faux}` : null,
        l.erreur_frequente?.erreur
          ? `Erreur fréquente — ${l.erreur_frequente.erreur}${l.erreur_frequente.correction ? ` ${l.erreur_frequente.correction}` : ''}`
          : (typeof l.erreur_frequente === 'string' ? `Erreur fréquente — ${l.erreur_frequente}` : null),
        l.mise_en_situation?.consigne ? `À faire cette semaine — ${l.mise_en_situation.consigne}` : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      key_points: Array.isArray(l.je_retiens?.phrases) ? l.je_retiens.phrases : undefined,
    }));

    // Le PDF actuel attend des MODULES. Le pivot écrit est une liste plate de
    // leçons : on la présente en un module unique plutôt que d'inventer un
    // découpage qui ne viendrait d'aucune analyse.
    const course: ExtractedCourseShape = {
      title: String(ecrit.payload?.titre || comp.titre || 'Cours'),
      subtitle: comp.promesse ? String(comp.promesse) : undefined,
      summary: String(ecrit.payload?.promesse || comp.promesse || ''),
      objectives: Array.isArray(comp.notions)
        ? comp.notions.map((n: any) => String(n.pourquoi || n.idee_centrale || n.titre)).filter(Boolean).slice(0, 8)
        : [],
      modules: [{ title: 'Programme', description: undefined, lessons }],
      glossary: Array.isArray(comp.glossaire)
        ? comp.glossaire.map((g: any) => ({ term: String(g.terme), definition: String(g.simple || '') }))
        : [],
      meta: {
        ...(comp.meta ?? {}),
        rendered_from: 'pivot',
        lessons: lessons.length,
        rendered_at: new Date().toISOString(),
      },
    };
    this.log.log(
      `[render] pdf depuis pivot — ${sourceType}/${sourceId} — ${lessons.length} leçon(s), 0 appel IA`,
    );
    return course;
  }

  /** Inventaire des pivots d'une source : ce qui existe déjà, donc gratuit. */
  async status(tenantId: string, sourceType: SourceType, sourceId: string) {
    const { data } = await (this.supabase.client as any)
      .from('course_pivots')
      .select('id, kind, parent_id, model, created_at')
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId);
    const rows = data ?? [];
    const root = rows.find((r: any) => r.kind === 'comprehension');
    const has = (kind: string) => rows.some((r: any) => r.kind === kind);
    const rendusGratuits = [
      ...(has('ecrit') ? ['pdf', 'parcours', 'masterclass', 'manuel', 'quiz', 'forum', 'faq'] : []),
      ...(has('joue') ? ['precepteur'] : []),
      ...(has('master_script') ? ['master_script'] : []),
      ...(has('smartboard_timeline') ? ['smartboard'] : []),
      ...(has('live_scenario') ? ['live'] : []),
      ...(has('replay_postprod') ? ['video_semaine'] : []),
    ];
    return {
      comprehension: !!root,
      ecrit: has('ecrit'),
      joue: has('joue'),
      master_script: has('master_script'),
      smartboard_timeline: has('smartboard_timeline'),
      live_scenario: has('live_scenario'),
      replay_postprod: has('replay_postprod'),
      /** Ce qui peut être rendu SANS nouveau coût IA. */
      rendusGratuits,
      pivots: rows.map((r: any) => ({ kind: r.kind, model: r.model, created_at: r.created_at })),
    };
  }
}
