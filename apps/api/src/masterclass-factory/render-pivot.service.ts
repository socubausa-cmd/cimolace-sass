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

  private async loadWrittenPivot(tenantId: string, sourceType: SourceType, sourceId: string) {
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
      .select('id, payload')
      .eq('parent_id', root.id)
      .eq('kind', 'ecrit')
      .maybeSingle();
    if (!ecrit) {
      throw new NotFoundException(
        "Le cours écrit n'existe pas encore pour cette source : construis-le d'abord.",
      );
    }
    return { root, ecrit };
  }

  /**
   * PDF depuis le pivot. Ne génère RIEN : si le cours écrit n'existe pas encore,
   * on le dit franchement plutôt que de relancer une facture IA en douce.
   */
  async renderPdf(
    tenantId: string,
    sourceType: SourceType,
    sourceId: string,
  ): Promise<ExtractedCourseShape> {
    const { root, ecrit } = await this.loadWrittenPivot(tenantId, sourceType, sourceId);

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

  /**
   * Adaptateur officiel `CoursEcritPivot` → projet éditable Masterclass Factory.
   * Il ne reconvertit jamais le cours en texte pour le faire ré-analyser : chaque
   * bloc riche de la leçon est rangé dans le segment LIRI correspondant.
   */
  async renderMasterclassProject(tenantId: string, sourceType: SourceType, sourceId: string) {
    const { root, ecrit } = await this.loadWrittenPivot(tenantId, sourceType, sourceId);
    const comp = root.payload ?? {};
    const lessons: any[] = Array.isArray(ecrit.payload?.lecons) ? ecrit.payload.lecons : [];
    const notions: any[] = Array.isArray(comp.notions) ? comp.notions : [];
    const value = (v: any, ...keys: string[]) => {
      if (typeof v === 'string') return v;
      if (!v || typeof v !== 'object') return '';
      return keys.map((k) => v[k]).find((x) => typeof x === 'string' && x.trim()) || '';
    };
    const join = (...parts: any[]) => parts.flat().filter(Boolean).map(String).join('\n\n');
    const segmentNames = [
      'Objectif', 'Compétence', 'Connaissance', 'Mise en situation', 'Tension',
      'Expérience de pensée', 'Révélation', 'Leçon simple', 'Leçon développée', 'Analogies',
      'Exemples', 'Reformulation', 'Atelier', 'Erreurs attendues', 'Correction', 'JE RETIENS',
      'Test', 'Cas réel', 'Lien conceptuel', 'Niveau de maîtrise', 'Transition',
    ];

    const chapters = lessons.map((lesson, index) => {
      const notion = notions.find((n: any) => n.id === lesson.notion_id) || notions[index] || {};
      const retain = Array.isArray(lesson.je_retiens?.phrases) ? lesson.je_retiens.phrases : [];
      const quiz = Array.isArray(lesson.quiz) ? lesson.quiz : [];
      const contents = [
        notion.pourquoi || comp.promesse,
        value(lesson.mise_en_situation, 'reussite', 'consigne'),
        value(lesson.definition, 'enonce') || lesson.definition,
        value(lesson.mise_en_situation, 'contexte', 'consigne'),
        value(lesson.contre_exemple, 'pourquoi_faux'),
        value(lesson.experience_pensee, 'consigne', 'deroule'),
        notion.idee_centrale,
        lesson.intuition,
        join(value(lesson.definition, 'enonce'), value(lesson.exemple, 'deroule')),
        value(lesson.exemple, 'deroule'),
        value(lesson.exemple, 'deroule'),
        retain.join('\n'),
        join(value(lesson.amorce, 'situation'), value(lesson.amorce, 'question')),
        value(lesson.erreur_frequente, 'erreur') || lesson.erreur_frequente,
        value(lesson.erreur_frequente, 'correction'),
        retain.join('\n'),
        quiz.map((q: any) => `${q.question}\n${(q.options || []).join(' · ')}\n${q.explication || ''}`).join('\n\n'),
        value(lesson.mise_en_situation, 'contexte', 'consigne'),
        Array.isArray(notion.prerequis) ? notion.prerequis.join(' · ') : '',
        value(lesson.mise_en_situation, 'reussite'),
        notions[index + 1]?.titre ? `La suite conduit vers : ${notions[index + 1].titre}.` : 'Synthèse et mise en pratique.',
      ];
      const segments = segmentNames.map((name, segmentIndex) => ({
        segment_id: segmentIndex + 1,
        name,
        title: name,
        content: String(contents[segmentIndex] || ''),
        key_points: name === 'JE RETIENS' ? retain : [],
        oral_script: name === 'Leçon développée' ? join(lesson.intuition, value(lesson.definition, 'enonce')) : '',
        teacher_note: name === 'Atelier' ? 'Faire répondre avant de révéler la correction.' : '',
        interaction: name === 'Atelier' ? value(lesson.amorce, 'question') : '',
        status: contents[segmentIndex] ? 'done' : 'pending',
      }));
      return {
        id: `mf-${ecrit.id}-${index + 1}`,
        chapterId: `mf-${ecrit.id}-${index + 1}`,
        order: index,
        title: String(lesson.titre || notion.titre || `Leçon ${index + 1}`),
        objective: String(notion.pourquoi || notion.idee_centrale || ''),
        duration: '25 min',
        source_notion_id: notion.id || lesson.notion_id || null,
        segments,
      };
    });
    const filled = chapters.reduce(
      (n, chapter) => n + chapter.segments.filter((segment) => segment.status === 'done').length,
      0,
    );
    const total = chapters.length * segmentNames.length;
    const rawText = lessons.map((lesson) => join(lesson.titre, lesson.intuition, value(lesson.definition, 'enonce'), value(lesson.exemple, 'deroule'))).join('\n\n');

    return {
      rawText,
      analysis: {
        global_subject: String(ecrit.payload?.titre || comp.titre || 'Cours'),
        central_theme: String(comp.promesse || ''),
        target_audience: comp.public || null,
        level: 'Tous niveaux',
        chapters_count: chapters.length,
        key_revelations: notions.map((n: any) => n.idee_centrale).filter(Boolean).slice(0, 8),
        provider: 'master-factory-pivot',
      },
      blocks: notions.map((notion: any, index: number) => ({
        id: notion.id || `n${index + 1}`,
        order: index,
        title: notion.titre,
        central_idea: notion.idee_centrale,
        core_claim: notion.pourquoi,
        revelations: notion.appuis || [],
      })),
      factoryChapters: chapters,
      chapters,
      pedagogy: chapters,
      slides: chapters.map((chapter) => ({
        id: `slide-${chapter.id}`,
        chapter_id: chapter.id,
        title: chapter.title,
        subtitle: chapter.objective,
        content: chapter.segments.find((s) => s.name === 'JE RETIENS')?.content || '',
        segments: chapter.segments,
      })),
      scripts: chapters.map((chapter) => ({
        id: `script-${chapter.id}`,
        chapter_id: chapter.id,
        title: chapter.title,
        lines: chapter.segments.map((s) => s.oral_script).filter(Boolean),
        duration: chapter.duration,
      })),
      quality: {
        score: total ? Math.round((filled / total) * 100) : 0,
        segments_filled: filled,
        segments_total: total,
        missing_requirements: filled === total ? [] : ['Certains segments restent à enrichir dans l’éditeur.'],
      },
      exports: { downloadable: { json: true, markdown: true, pdf: true } },
      master_factory: {
        source_type: sourceType,
        source_id: sourceId,
        comprehension_pivot_id: root.id,
        written_pivot_id: ecrit.id,
        imported_without_regeneration: true,
      },
    };
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
    const { data: courseJob } = await (this.supabase.client as any)
      .from('course_generation_jobs')
      .select('id, course_id, pivot_id, status')
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const rendusGratuits = [
      ...(has('ecrit') ? ['pdf', 'masterclass'] : []),
      ...(courseJob?.course_id ? ['parcours'] : []),
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
      course: courseJob?.course_id
        ? { id: courseJob.course_id, jobId: courseJob.id, pivotId: courseJob.pivot_id || root?.id || null }
        : null,
      /** Ce qui peut être rendu SANS nouveau coût IA. */
      rendusGratuits,
      pivots: rows.map((r: any) => ({ kind: r.kind, model: r.model, created_at: r.created_at })),
    };
  }
}
