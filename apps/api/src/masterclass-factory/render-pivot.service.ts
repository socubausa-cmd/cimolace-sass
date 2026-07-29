import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

export interface PrecepteurCourseShape {
  title: string;
  concepts: { id: string; title: string; scenes: Record<string, unknown>[] }[];
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
    const { data: visualPedagogy } = await (this.supabase.client as any)
      .from('course_pivots')
      .select('id, payload, model')
      .eq('parent_id', ecrit.id)
      .eq('kind', 'visual_pedagogy')
      .maybeSingle();
    return { root, ecrit, visualPedagogy: visualPedagogy ?? null };
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
    const { root, ecrit, visualPedagogy } = await this.loadWrittenPivot(tenantId, sourceType, sourceId);
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
    const analogyFrames = [
      { image: 'une boussole', role: 'oriente sans faire le chemin à la place de l’élève' },
      { image: 'un pont', role: 'relie une situation vécue à une idée nouvelle' },
      { image: 'une loupe', role: 'rend visible ce qui restait implicite' },
      { image: 'un miroir', role: 'permet de reconnaître le concept dans sa propre expérience' },
      { image: 'une carte', role: 'organise les repères avant le passage à l’action' },
      { image: 'une graine', role: 'devient une compréhension solide quand elle est mise en pratique' },
    ];
    const slideKinds: Record<string, string> = {
      Objectif: 'objective', Compétence: 'skill', Connaissance: 'concept',
      'Mise en situation': 'story', Tension: 'tension', 'Expérience de pensée': 'thought-experiment',
      Révélation: 'revelation', 'Leçon simple': 'lesson', 'Leçon développée': 'deep-dive',
      Analogies: 'analogy', Exemples: 'example', Reformulation: 'reformulation', Atelier: 'workshop',
      'Erreurs attendues': 'pitfall', Correction: 'correction', 'JE RETIENS': 'retention',
      Test: 'quiz', 'Cas réel': 'case-study', 'Lien conceptuel': 'connection',
      'Niveau de maîtrise': 'mastery', Transition: 'transition',
    };

    const chapters = lessons.map((lesson, index) => {
      const notion = notions.find((n: any) => n.id === lesson.notion_id) || notions[index] || {};
      const retain = Array.isArray(lesson.je_retiens?.phrases) ? lesson.je_retiens.phrases : [];
      const quiz = Array.isArray(lesson.quiz) ? lesson.quiz : [];
      const analogyFrame = analogyFrames[index % analogyFrames.length];
      const analogyAnchor = String(notion.idee_centrale || lesson.intuition || '').trim();
      const analogy = analogyAnchor
        ? {
            type: 'analogie pédagogique dérivée',
            content: `On peut comparer « ${lesson.titre || notion.titre || `Leçon ${index + 1}`} » à ${analogyFrame.image} : ${analogyFrame.role}. Ici, le repère essentiel est : ${analogyAnchor}`,
            provenance: 'master-factory-derived',
          }
        : null;
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
        analogy?.content || '',
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
        chapter_id: index + 1,
        order: index,
        title: String(lesson.titre || notion.titre || `Leçon ${index + 1}`),
        objective: String(notion.pourquoi || notion.idee_centrale || ''),
        duration: '25 min',
        recommended_duration_minutes: 25,
        difficulty: 'medium',
        skill_to_acquire: value(lesson.mise_en_situation, 'reussite', 'consigne'),
        knowledge_to_transmit: value(lesson.definition, 'enonce') || String(lesson.definition || ''),
        real_life_situation: join(
          value(lesson.mise_en_situation, 'contexte'),
          value(lesson.mise_en_situation, 'consigne'),
        ),
        pedagogical_tension: value(lesson.contre_exemple, 'pourquoi_faux'),
        thought_experiment: join(
          value(lesson.experience_pensee, 'consigne'),
          value(lesson.experience_pensee, 'deroule'),
          value(lesson.experience_pensee, 'ce_que_ca_montre'),
        ),
        revelation_moment: String(notion.idee_centrale || ''),
        main_revelation: String(notion.idee_centrale || ''),
        simple_lesson: String(lesson.intuition || ''),
        deep_lesson: join(
          value(lesson.definition, 'enonce') || lesson.definition,
          value(lesson.exemple, 'deroule'),
        ),
        reformulation: retain.join('\n'),
        analogies: analogy ? [analogy] : [],
        examples: value(lesson.exemple, 'deroule')
          ? [{ type: value(lesson.exemple, 'titre') || 'Exemple', content: value(lesson.exemple, 'deroule') }]
          : [],
        workshop: {
          instructions: join(value(lesson.amorce, 'situation'), value(lesson.amorce, 'question')),
          questions: value(lesson.amorce, 'question') ? [value(lesson.amorce, 'question')] : [],
          expected_answers: value(lesson.mise_en_situation, 'reussite')
            ? [value(lesson.mise_en_situation, 'reussite')]
            : [],
        },
        je_retiens: retain,
        understanding_test: quiz.map((q: any) => ({
          question: q.question,
          expected_answer: q.options?.[q.correctAnswer] || q.explication || '',
          explanation: q.explication || '',
        })),
        transition_to_next: notions[index + 1]?.titre
          ? `La suite conduit vers : ${notions[index + 1].titre}.`
          : 'Synthèse et mise en pratique.',
        source_notion_id: notion.id || lesson.notion_id || null,
        segments,
      };
    });
    const filled = chapters.reduce(
      (n, chapter) => n + chapter.segments.filter((segment) => segment.status === 'done').length,
      0,
    );
    const total = chapters.length * segmentNames.length;
    const missingSegments = chapters.flatMap((chapter) => chapter.segments
      .filter((segment) => segment.status !== 'done')
      .map((segment) => `Chapitre ${chapter.chapter_id} · ${segment.name}`));
    const rawText = lessons.map((lesson) => join(lesson.titre, lesson.intuition, value(lesson.definition, 'enonce'), value(lesson.exemple, 'deroule'))).join('\n\n');

    const project = {
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
      // Le SmartBoard ne doit pas réduire un chapitre riche à une carte unique :
      // chaque segment pédagogique devient une scène éditable et ordonnée.
      slides: chapters.flatMap((chapter) => chapter.segments
        .filter((segment) => segment.status === 'done')
        .map((segment, segmentIndex) => ({
          id: `slide-${chapter.id}-${segment.segment_id}`,
          slide_id: `slide-${chapter.id}-${segment.segment_id}`,
          chapter_id: chapter.chapter_id,
          segment_id: segment.segment_id,
          sequence_number: segmentIndex + 1,
          sequence_total: chapter.segments.filter((candidate) => candidate.status === 'done').length,
          kind: slideKinds[segment.name] || 'lesson',
          title: segment.name,
          subtitle: chapter.title,
          body: segment.content,
          content: segment.content,
          bullets: segment.key_points || [],
          speaker_notes: segment.oral_script || segment.teacher_note || '',
          interaction: segment.interaction || '',
          duration_seconds: ['Atelier', 'Test'].includes(segment.name) ? 120 : 60,
          provenance: segment.name === 'Analogies' ? 'master-factory-derived' : 'written-pivot',
        }))),
      scripts: chapters.map((chapter) => ({
        id: `script-${chapter.id}`,
        chapter_id: chapter.chapter_id,
        title: chapter.title,
        lines: chapter.segments
          .filter((segment) => segment.status === 'done')
          .map((segment) => `${segment.name} — ${segment.oral_script || segment.content}`),
        duration: chapter.duration,
      })),
      quality: {
        score: total ? Math.round((filled / total) * 100) : 0,
        segments_filled: filled,
        segments_total: total,
        missing_requirements: missingSegments,
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
    return this.applyVisualPedagogy(project, visualPedagogy?.payload, visualPedagogy?.id);
  }

  /**
   * Adaptateur officiel pivot écrit → cours joué du Précepteur. La conversion
   * est déterministe et persistée en `joue` : ouvrir plusieurs fois le même
   * rendu ne consomme aucun jeton et conserve exactement les mêmes scènes.
   */
  async renderPrecepteur(tenantId: string, sourceType: SourceType, sourceId: string) {
    const { ecrit } = await this.loadWrittenPivot(tenantId, sourceType, sourceId);
    const { data: cached } = await (this.supabase.client as any)
      .from('course_pivots')
      .select('id, payload')
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('parent_id', ecrit.id)
      .eq('kind', 'joue')
      .maybeSingle();
    if (cached?.payload) return { course: cached.payload, pivotId: cached.id, cached: true };

    const project = await this.renderMasterclassProject(tenantId, sourceType, sourceId);
    const course = this.masterclassToPrecepteur(project);
    if (!course.concepts.length) throw new NotFoundException('Le pivot écrit ne contient aucune scène jouable.');
    const row = {
      tenant_id: tenantId,
      source_type: sourceType,
      source_id: sourceId,
      kind: 'joue',
      parent_id: ecrit.id,
      payload: course,
      model: 'deterministic-precepteur-v1',
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await (this.supabase.client as any).from('course_pivots').insert(row).select('id').single();
    if (error) {
      // Deux requêtes simultanées peuvent rencontrer l'index unique partiel.
      const { data: concurrent } = await (this.supabase.client as any).from('course_pivots')
        .select('id, payload').eq('tenant_id', tenantId).eq('source_type', sourceType)
        .eq('source_id', sourceId).eq('parent_id', ecrit.id).eq('kind', 'joue').maybeSingle();
      if (concurrent?.payload) return { course: concurrent.payload, pivotId: concurrent.id, cached: true };
      throw new BadRequestException(`Rendu Précepteur impossible : ${error.message}`);
    }
    return { course, pivotId: data.id, cached: false };
  }

  /** Conversion pure exposée aux tests : aucune base, aucun fournisseur IA. */
  masterclassToPrecepteur(project: any): PrecepteurCourseShape {
    const text = (value: any) => String(value ?? '').trim();
    const list = (value: any) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
    const chapters = Array.isArray(project?.pedagogy) && project.pedagogy.length
      ? project.pedagogy : (Array.isArray(project?.chapters) ? project.chapters : []);
    const concepts = chapters.map((chapter: any, index: number) => {
      const scenes: Record<string, unknown>[] = [];
      const simple = text(chapter.simple_lesson);
      const deep = text(chapter.deep_lesson);
      const fallback = text(chapter.knowledge_to_transmit);
      if (simple) scenes.push({ type: 'lecon', title: text(chapter.title), board_text: simple, narration: simple });
      if (deep) scenes.push({ type: 'lecon', ...(!simple ? { title: text(chapter.title) } : {}), board_text: deep, narration: deep });
      if (!simple && !deep && fallback) scenes.push({ type: 'lecon', title: text(chapter.title), board_text: fallback, narration: fallback });
      if (text(chapter.thought_experiment)) scenes.push({ type: 'amorce_croquis', narration: text(chapter.thought_experiment) });
      const workshop = chapter.workshop || {};
      const question = list(workshop.questions)[0] || '';
      const reveal = text(chapter.revelation_moment || chapter.main_revelation);
      if (question || reveal) scenes.push({
        type: 'atelier', address: '{{student_name}}',
        question: question || `Que retiens-tu de « ${text(chapter.title) || 'ce chapitre'} » ?`,
        expected_answers: list(workshop.expected_answers), expected_errors: list(workshop.expected_errors),
        ack_variants: { ok: ['Exactement.', 'Tu y es.'], partial: ['Bonne direction.'], wrong: ["Regarde encore : l'erreur est instructive."] },
        reveal_narration: reveal || 'Voilà l’essentiel de ce que nous venons de voir.',
        ...(text(workshop.instructions) ? { hint: text(workshop.instructions) } : {}),
      });
      const analogy = Array.isArray(chapter.analogies) ? chapter.analogies[0] : null;
      const analogyText = text(typeof analogy === 'string' ? analogy : analogy?.content);
      if (analogyText) {
        const slide = (project?.slides || []).find((candidate: any) => Number(candidate.chapter_id) === Number(chapter.chapter_id)
          && (candidate.visual_role === 'analogy' || text(candidate.title).toLocaleLowerCase('fr') === 'analogies'));
        scenes.push({
          type: 'image_analogie', analogie: analogyText, narration: analogyText,
          ...(slide?.image_status === 'approved' && slide?.image_url ? { image_url: slide.image_url } : {}),
          ...(slide?.image_prompt ? { image_prompt: slide.image_prompt } : {}),
          ...(slide?.alt_text ? { alt_text: slide.alt_text } : {}),
        });
      }
      if (text(chapter.transition_to_next)) scenes.push({ type: 'transition', narration: text(chapter.transition_to_next) });
      return { id: String(chapter.chapter_id ?? chapter.id ?? index + 1), title: text(chapter.title) || `Chapitre ${index + 1}`, scenes };
    }).filter((concept: any) => concept.scenes.length);
    return {
      title: text(project?.analysis?.global_subject || project?.title) || 'Cours du Précepteur',
      concepts,
      meta: { rendered_from: 'master-factory-pivot', adapter: 'deterministic-precepteur-v1', rendered_at: new Date().toISOString() },
    };
  }

  /** Manuel Markdown, dérivé du PDF riche sans seconde intelligence. */
  async renderManual(tenantId: string, sourceType: SourceType, sourceId: string) {
    const course = await this.renderPdf(tenantId, sourceType, sourceId);
    const markdown = [
      `# ${course.title}`,
      course.subtitle ? `> ${course.subtitle}` : '',
      course.summary,
      course.objectives.length ? `## Objectifs\n${course.objectives.map((item) => `- ${item}`).join('\n')}` : '',
      ...course.modules.flatMap((module) => [
        `## ${module.title}`,
        module.description || '',
        ...module.lessons.flatMap((lesson) => [
          `### ${lesson.title}`,
          lesson.content,
          lesson.key_points?.length ? `#### Je retiens\n${lesson.key_points.map((point) => `- ${point}`).join('\n')}` : '',
        ]),
      ]),
      course.glossary.length ? `## Glossaire\n${course.glossary.map((entry) => `- **${entry.term}** — ${entry.definition}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
    return { title: course.title, markdown, meta: { ...course.meta, format: 'markdown', rendered_without_ai: true } };
  }

  /**
   * Fusion pure et testable du brief Visual Pedagogy dans le projet. Les scènes
   * sans ancrage fort restent textuelles : le moteur choisit où un visuel aide,
   * au lieu de produire 125 images décoratives et coûteuses.
   */
  applyVisualPedagogy(project: any, plan: any, pivotId: string | null = null) {
    if (!plan?.chapters?.length) return project;
    const byChapter = new Map(plan.chapters.map((chapter: any) => [Number(chapter.chapter_id), chapter]));
    const normalize = (value: unknown) => String(value || '').trim().toLocaleLowerCase('fr');
    const fallbackSegment: Record<string, string> = {
      situation: 'mise en situation',
      concept: 'connaissance',
      analogy: 'analogies',
      synthesis: 'je retiens',
    };
    const consumedAnchors = new Map<number, Set<any>>();
    const findAnchor = (chapterPlan: any, slide: any) => {
      const anchors = chapterPlan?.visual_anchors || [];
      const chapterId = Number(slide.chapter_id);
      const consumed = consumedAnchors.get(chapterId) || new Set<any>();
      consumedAnchors.set(chapterId, consumed);
      const anchor = anchors.find((candidate: any) => !consumed.has(candidate)
        && normalize(candidate.linked_segment) === normalize(slide.title))
        || anchors.find((candidate: any) => !consumed.has(candidate)
          && fallbackSegment[candidate.role] === normalize(slide.title))
        || null;
      if (anchor) consumed.add(anchor);
      return anchor;
    };
    const enrichChapter = (chapter: any) => {
      const chapterPlan: any = byChapter.get(Number(chapter.chapter_id));
      if (!chapterPlan) return chapter;
      return {
        ...chapter,
        visual_pedagogy: chapterPlan,
        reformulation: chapterPlan.reformulation?.precise || chapter.reformulation,
        analogies: chapterPlan.analogy?.explanation ? [{
          type: 'analogie pédagogique IA',
          content: chapterPlan.analogy.explanation,
          title: chapterPlan.analogy.title,
          mappings: chapterPlan.analogy.mappings,
          limit: chapterPlan.analogy.limit,
          narration: chapterPlan.analogy.teacher_narration,
          provenance: 'visual-pedagogy-ai',
        }] : chapter.analogies,
      };
    };
    const chapters = (project.chapters || []).map(enrichChapter);
    const slides = (project.slides || []).map((slide: any) => {
      const chapterPlan: any = byChapter.get(Number(slide.chapter_id));
      const anchor = findAnchor(chapterPlan, slide);
      if (!anchor) return slide;
      return {
        ...slide,
        visual_anchor: true,
        visual_role: anchor.role,
        visual_mode: anchor.mode,
        visual_brief: anchor.visual_concept,
        learning_job: anchor.learning_job,
        composition: anchor.composition,
        pictograms: anchor.pictograms,
        diagram: anchor.diagram,
        on_screen_text: anchor.on_screen_text_fr,
        image_prompt: anchor.image_prompt_en,
        negative_prompt: anchor.negative_prompt_en,
        must_show: anchor.must_show,
        reject_if: anchor.reject_if,
        analogy_map: anchor.role === 'analogy' ? chapterPlan.analogy : null,
        scenario_map: anchor.role === 'situation' ? chapterPlan.scenario : null,
        alt_text: anchor.alt_text_fr,
        teacher_cue: anchor.teacher_cue_fr,
        source_fidelity_note: anchor.source_fidelity_note,
        image_url: anchor.generated_image?.url || undefined,
        image_provider: anchor.generated_image?.provider || undefined,
        image_status: anchor.generated_image?.status || 'brief_ready',
        provenance: 'visual-pedagogy-ai',
      };
    });
    return {
      ...project,
      chapters,
      pedagogy: chapters,
      slides,
      visualPedagogy: plan,
      master_factory: {
        ...project.master_factory,
        visual_pedagogy_pivot_id: pivotId,
        visual_pedagogy_provider: plan?.meta?.provider || null,
        visual_pedagogy_model: plan?.meta?.model || null,
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
      ...(has('ecrit') ? ['pdf', 'manual', 'masterclass'] : []),
      ...(courseJob?.course_id ? ['parcours'] : []),
      ...(has('joue') ? ['precepteur'] : []),
      ...(has('master_script') ? ['master_script'] : []),
      ...(has('smartboard_timeline') ? ['smartboard'] : []),
      ...(has('live_scenario') ? ['live'] : []),
      ...(has('replay_postprod') ? ['video_semaine'] : []),
      ...(has('visual_pedagogy') ? ['visual_pedagogy'] : []),
    ];
    return {
      comprehension: !!root,
      ecrit: has('ecrit'),
      joue: has('joue'),
      master_script: has('master_script'),
      smartboard_timeline: has('smartboard_timeline'),
      live_scenario: has('live_scenario'),
      replay_postprod: has('replay_postprod'),
      visual_pedagogy: has('visual_pedagogy'),
      course: courseJob?.course_id
        ? { id: courseJob.course_id, jobId: courseJob.id, pivotId: courseJob.pivot_id || root?.id || null }
        : null,
      /** Ce qui peut être rendu SANS nouveau coût IA. */
      rendusGratuits,
      pivots: rows.map((r: any) => ({ kind: r.kind, model: r.model, created_at: r.created_at })),
    };
  }
}
