import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { AiBillingService } from '../ai-billing/ai-billing.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { SourceType } from './pivot.types';
import { RenderPivotService } from './render-pivot.service';
import { TranscriptCourseService } from './transcript-course.service';
import {
  buildVisualPedagogyRepairPrompt,
  buildVisualPedagogyUserPrompt,
  VISUAL_ANCHOR_ROLES,
  VISUAL_PEDAGOGY_PROMPT_VERSION,
  VISUAL_PEDAGOGY_SYSTEM_PROMPT,
} from './visual-pedagogy.prompt';

type ProviderResult = {
  payload: any;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

@Injectable()
export class VisualPedagogyService {
  private readonly log = new Logger(VisualPedagogyService.name);
  private readonly inFlight = new Map<string, Promise<any>>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly billing: AiBillingService,
    private readonly render: RenderPivotService,
  ) {}

  private get db(): any { return this.supabase.client as any; }

  async reviewImage(
    tenantId: string,
    userId: string,
    sourceType: SourceType,
    sourceId: string,
    input: { chapterId: number; role: string; status: string; imageUrl?: string; provider?: string; note?: string },
  ) {
    const allowedRoles = new Set<string>(VISUAL_ANCHOR_ROLES);
    const allowedStatuses = new Set(['pending_review', 'approved', 'rejected']);
    if (!allowedRoles.has(input.role) || !allowedStatuses.has(input.status)) {
      throw new BadGatewayException('Revue visuelle invalide.');
    }
    if (input.imageUrl && (!input.imageUrl.startsWith('https://') || input.imageUrl.length > 4096)) {
      throw new BadGatewayException('URL du visuel invalide.');
    }
    const project = await this.render.renderMasterclassProject(tenantId, sourceType, sourceId);
    const writtenPivotId = String(project?.master_factory?.written_pivot_id || '');
    const { data: pivot, error } = await this.db.from('course_pivots')
      .select('id, payload')
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('parent_id', writtenPivotId)
      .eq('kind', 'visual_pedagogy')
      .single();
    if (error || !pivot?.id) throw new ServiceUnavailableException('Brief visuel persistant introuvable.');
    const plan = structuredClone(pivot.payload || {});
    const chapter = (plan.chapters || []).find((item: any) => Number(item.chapter_id) === Number(input.chapterId));
    const anchor = (chapter?.visual_anchors || []).find((item: any) => item.role === input.role);
    if (!anchor) throw new BadGatewayException('Ancrage visuel introuvable.');
    const existing = anchor.generated_image || {};
    const imageUrl = input.imageUrl || existing.url;
    if ((input.status === 'pending_review' || input.status === 'approved') && !imageUrl) {
      throw new BadGatewayException('Aucune image à soumettre à la revue.');
    }
    anchor.generated_image = {
      url: imageUrl || null,
      provider: String(input.provider || existing.provider || '').slice(0, 80) || null,
      status: input.status,
      note: String(input.note || '').slice(0, 500) || null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    };
    const { error: updateError } = await this.db.from('course_pivots')
      .update({ payload: plan, updated_at: new Date().toISOString() })
      .eq('id', pivot.id)
      .eq('tenant_id', tenantId);
    if (updateError) throw new ServiceUnavailableException(`Sauvegarde de la revue impossible : ${updateError.message}`);
    const enrichedProject = this.render.applyVisualPedagogy(project, plan, pivot.id);
    return { pivotId: pivot.id, visualPedagogy: plan, project: enrichedProject, persisted: true };
  }

  /** Produit le brief visuel intelligent, le met en cache puis le fusionne au storyboard. */
  async generate(
    tenantId: string,
    userId: string,
    sourceType: SourceType,
    sourceId: string,
    opts: { force?: boolean } = {},
  ) {
    const lockKey = `${tenantId}:${sourceType}:${sourceId}:${opts.force ? 'force' : 'cached'}`;
    const running = this.inFlight.get(lockKey);
    if (running) return running;
    const operation = this.generateOnce(tenantId, userId, sourceType, sourceId, opts)
      .finally(() => this.inFlight.delete(lockKey));
    this.inFlight.set(lockKey, operation);
    return operation;
  }

  private async generateOnce(
    tenantId: string,
    userId: string,
    sourceType: SourceType,
    sourceId: string,
    opts: { force?: boolean } = {},
  ) {
    const project = await this.render.renderMasterclassProject(tenantId, sourceType, sourceId);
    const writtenPivotId = String(project?.master_factory?.written_pivot_id || '');
    if (!writtenPivotId) throw new ServiceUnavailableException('Pivot écrit introuvable pour la pédagogie visuelle.');

    const courseInput = this.compactCourse(project);
    const inputHash = createHash('sha256').update(JSON.stringify(courseInput)).digest('hex');

    const { data: cached, error: cacheError } = await this.db
      .from('course_pivots')
      .select('id, payload, model')
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('parent_id', writtenPivotId)
      .eq('kind', 'visual_pedagogy')
      .maybeSingle();
    if (cacheError) throw new ServiceUnavailableException(`Lecture du cache visuel impossible : ${cacheError.message}`);
    const cacheIsCurrent = cached?.payload?.meta?.input_hash === inputHash
      && cached?.payload?.meta?.prompt_version === VISUAL_PEDAGOGY_PROMPT_VERSION
      && this.auditPlan(cached.payload, project.chapters || []).length === 0;
    if (cached && !opts.force && cacheIsCurrent) {
      cached.payload.meta = { ...(cached.payload.meta || {}), persisted: true };
      const cachedProject = this.render.applyVisualPedagogy(project, cached.payload, cached.id);
      cachedProject.master_factory = { ...cachedProject.master_factory, visual_pedagogy_persisted: true };
      return {
        visualPedagogy: cached.payload,
        project: cachedProject,
        pivotId: cached.id,
        persisted: true,
        cached: true,
        provider: cached.payload?.meta?.provider || 'cache',
        model: cached.model || cached.payload?.meta?.model || 'cache',
      };
    }

    const usages: ProviderResult[] = [];
    const canResume = !opts.force
      && cached?.payload?.meta?.input_hash === inputHash
      && cached?.payload?.meta?.prompt_version === VISUAL_PEDAGOGY_PROMPT_VERSION;
    const generatedChapters: any[] = canResume
      ? (cached.payload.chapters || []).filter((chapter: any) => {
          const expected = (project.chapters || []).find((item: any) => Number(item.chapter_id) === Number(chapter.chapter_id));
          return expected && this.auditPlan({ chapters: [chapter] }, [expected]).length === 0;
        })
      : [];
    let workingPivotId: string | null = cached?.id || null;
    const completedIds = new Set(generatedChapters.map((chapter: any) => Number(chapter.chapter_id)));
    const remainingChapters = courseInput.chapters.filter((chapter: any) => !completedIds.has(Number(chapter.chapter_id)));

    // Un chapitre par appel : sortie plus profonde, réparation ciblée et panne
    // isolée. Deux appels au plus tournent ensemble pour ménager les quotas.
    for (let index = 0; index < remainingChapters.length; index += 2) {
      const batch = remainingChapters.slice(index, index + 2);
      const batchResults = await Promise.all(batch.map(async (chapterInput: any) => {
        const expected = (project.chapters || []).find((chapter: any) => Number(chapter.chapter_id) === Number(chapterInput.chapter_id));
        const scopedCourse = { ...courseInput, chapters: [chapterInput] };
        let usage = await this.callModel(buildVisualPedagogyUserPrompt(scopedCourse));
        usages.push(usage);
        await this.chargeBestEffort(tenantId, userId, usage);
        let scopedPlan: any = this.normalizePlan(usage.payload, [expected]);
        let scopedIssues = this.auditPlan(scopedPlan, [expected]);
        if (scopedIssues.length) {
          const repaired = await this.callModel(buildVisualPedagogyRepairPrompt(scopedPlan, scopedIssues));
          usages.push(repaired);
          await this.chargeBestEffort(tenantId, userId, repaired);
          usage = repaired;
          scopedPlan = this.normalizePlan(repaired.payload, [expected]);
          scopedIssues = this.auditPlan(scopedPlan, [expected]);
        }
        if (scopedIssues.length) {
          throw new BadGatewayException(`Chapitre ${chapterInput.chapter_id} refusé : ${scopedIssues.slice(0, 6).join(' ; ')}`);
        }
        return scopedPlan.chapters[0];
      }));
      generatedChapters.push(...batchResults);
      const checkpoint = {
        schema_version: 1,
        title: courseInput.title || '',
        chapters: generatedChapters,
        meta: {
          source_type: sourceType,
          source_id: sourceId,
          written_pivot_id: writtenPivotId,
          input_hash: inputHash,
          prompt_version: VISUAL_PEDAGOGY_PROMPT_VERSION,
          generation_status: 'in_progress',
          completed_chapters: generatedChapters.map((chapter: any) => chapter.chapter_id),
          updated_at: new Date().toISOString(),
        },
      };
      workingPivotId = await this.savePlan(tenantId, sourceType, sourceId, writtenPivotId, checkpoint, usages.at(-1)?.model || 'checkpoint', workingPivotId);
    }

    const providers = [...new Set(usages.map((usage) => usage.provider))];
    const models = [...new Set(usages.map((usage) => usage.model))];
    const generated: ProviderResult = {
      payload: null,
      provider: providers.join('+'),
      model: models.join('+'),
      tokensIn: usages.reduce((total, usage) => total + usage.tokensIn, 0),
      tokensOut: usages.reduce((total, usage) => total + usage.tokensOut, 0),
    };
    const plan: any = { schema_version: 1, title: courseInput.title || '', chapters: generatedChapters };

    const reviewChapters = plan.chapters
      .filter((chapter: any) => ['fidelity', 'clarity', 'cognitive_load', 'transfer', 'cultural_respect', 'visual_specificity', 'non_decorative']
        .some((key) => Number(chapter.quality?.[key]) < 75))
      .map((chapter: any) => chapter.chapter_id);
    plan.meta = {
      source_type: sourceType,
      source_id: sourceId,
      written_pivot_id: writtenPivotId,
      provider: generated.provider,
      model: generated.model,
      generated_at: new Date().toISOString(),
      input_hash: inputHash,
      prompt_version: VISUAL_PEDAGOGY_PROMPT_VERSION,
      quality_gate: reviewChapters.length ? 'needs_review' : 'passed',
      review_chapters: reviewChapters,
    };

    let pivotId: string | null = workingPivotId;
    let persisted = false;
    try {
      pivotId = await this.savePlan(tenantId, sourceType, sourceId, writtenPivotId, plan, generated.model, workingPivotId);
      persisted = true;
    } catch (error) {
      this.log.error(`Persistance de la pédagogie visuelle impossible : ${(error as Error).message}`);
      throw new ServiceUnavailableException('Le brief visuel a été généré mais sa sauvegarde a échoué. Relancez la génération.');
    }

    plan.meta.persisted = persisted;
    const enrichedProject = this.render.applyVisualPedagogy(project, plan, pivotId);
    enrichedProject.master_factory = { ...enrichedProject.master_factory, visual_pedagogy_persisted: persisted };
    return {
      visualPedagogy: plan,
      project: enrichedProject,
      pivotId,
      persisted,
      cached: false,
      provider: generated.provider,
      model: generated.model,
    };
  }

  private async savePlan(
    tenantId: string,
    sourceType: SourceType,
    sourceId: string,
    writtenPivotId: string,
    payload: any,
    model: string,
    existingId: string | null,
  ): Promise<string> {
    const row = {
      tenant_id: tenantId,
      source_type: sourceType,
      source_id: sourceId,
      kind: 'visual_pedagogy',
      parent_id: writtenPivotId,
      payload,
      model,
      updated_at: new Date().toISOString(),
    };
    if (existingId) {
      const { data, error } = await this.db.from('course_pivots').update(row)
        .eq('id', existingId).eq('tenant_id', tenantId).select('id').single();
      if (error) throw error;
      return data.id;
    }
    const { data, error } = await this.db.from('course_pivots').insert(row).select('id').single();
    if (!error) return data.id;
    if (error.code !== '23505') throw error;
    const { data: raced, error: racedError } = await this.db.from('course_pivots').select('id')
      .eq('tenant_id', tenantId).eq('source_type', sourceType).eq('source_id', sourceId)
      .eq('kind', 'visual_pedagogy').eq('parent_id', writtenPivotId).single();
    if (racedError || !raced?.id) throw error;
    const { error: updateError } = await this.db.from('course_pivots').update(row)
      .eq('id', raced.id).eq('tenant_id', tenantId);
    if (updateError) throw updateError;
    return raced.id;
  }

  private compactCourse(project: any) {
    return {
      title: project?.analysis?.global_subject,
      central_theme: project?.analysis?.central_theme,
      audience: project?.analysis?.target_audience,
      chapters: (project?.chapters || []).map((chapter: any) => ({
        chapter_id: chapter.chapter_id,
        title: chapter.title,
        objective: chapter.objective,
        skill: chapter.skill_to_acquire,
        knowledge: chapter.knowledge_to_transmit,
        situation: chapter.real_life_situation,
        tension: chapter.pedagogical_tension,
        thought_experiment: chapter.thought_experiment,
        revelation: chapter.revelation_moment,
        simple_lesson: chapter.simple_lesson,
        deep_lesson: chapter.deep_lesson,
        examples: chapter.examples,
        retention: chapter.je_retiens,
        tests: chapter.understanding_test,
        allowed_segments: Array.from(new Set((chapter.segments || [])
          .map((segment: any) => String(segment?.name || '').trim())
          .filter(Boolean))),
      })),
    };
  }

  /** Normalisation stricte : aucune invention de secours si le modèle omet un champ clé. */
  normalizePlan(raw: any, expectedChapters: any[]) {
    const chapters = Array.isArray(raw?.chapters) ? raw.chapters : [];
    const normalizeQuality = (quality: any) => {
      const keys = ['fidelity', 'clarity', 'cognitive_load', 'transfer', 'cultural_respect', 'visual_specificity', 'non_decorative'];
      return {
        ...quality,
        ...Object.fromEntries(keys.map((key) => [key, Number.isFinite(Number(quality?.[key]))
          ? Math.max(0, Math.min(100, Math.round(Number(quality[key]))))
          : quality?.[key]])),
      };
    };
    const normalized = expectedChapters.map((expected) => {
      const found = chapters.find((chapter: any) => Number(chapter?.chapter_id) === Number(expected?.chapter_id)) || {};
      const anchors = Array.isArray(found.visual_anchors) ? found.visual_anchors : [];
      return {
        chapter_id: Number(expected?.chapter_id),
        diagnostic: found.diagnostic || {},
        reformulation: found.reformulation || {},
        scenario: found.scenario || {},
        analogy: {
          ...(found.analogy || {}),
          mappings: Array.isArray(found?.analogy?.mappings) ? found.analogy.mappings.slice(0, 5) : [],
        },
        visual_anchors: anchors.slice(0, 6).map((anchor: any) => ({
          role: String(anchor?.role || ''),
          linked_segment: String(anchor?.linked_segment || ''),
          mode: String(anchor?.mode || ''),
          learning_job: String(anchor?.learning_job || ''),
          visual_concept: String(anchor?.visual_concept || ''),
          composition: String(anchor?.composition || ''),
          pictograms: Array.isArray(anchor?.pictograms) ? anchor.pictograms.slice(0, 3) : [],
          diagram: anchor?.diagram && typeof anchor.diagram === 'object'
            ? { ...anchor.diagram, nodes: Array.isArray(anchor.diagram.nodes) ? anchor.diagram.nodes.slice(0, 5) : [] }
            : { nodes: [], links: [], reveal_order: [] },
          on_screen_text_fr: Array.isArray(anchor?.on_screen_text_fr) ? anchor.on_screen_text_fr.slice(0, 3) : [],
          image_prompt_en: String(anchor?.image_prompt_en || ''),
          negative_prompt_en: String(anchor?.negative_prompt_en || ''),
          must_show: Array.isArray(anchor?.must_show) ? anchor.must_show.slice(0, 5).map(String) : [],
          reject_if: Array.isArray(anchor?.reject_if) ? anchor.reject_if.slice(0, 5).map(String) : [],
          alt_text_fr: String(anchor?.alt_text_fr || ''),
          teacher_cue_fr: String(anchor?.teacher_cue_fr || ''),
          source_fidelity_note: String(anchor?.source_fidelity_note || ''),
        })),
        quality: normalizeQuality(found.quality || {}),
      };
    });
    return { schema_version: 1, title: String(raw?.title || ''), chapters: normalized };
  }

  auditPlan(plan: any, expectedChapters: any[]): string[] {
    const issues: string[] = [];
    const frames = new Set(['source_claim', 'testimony', 'doctrine', 'metaphor', 'established_fact', 'mixed']);
    const modes = new Set(['narrative_scene', 'explanatory_diagram', 'comparison', 'timeline', 'process', 'map', 'pictograms', 'symbolic_metaphor']);
    const rawIds = (plan?.chapters || []).map((chapter: any) => Number(chapter?.chapter_id));
    if (new Set(rawIds).size !== rawIds.length) issues.push('chapter_id dupliqué');
    if (plan?.chapters?.length !== expectedChapters.length) issues.push('nombre de chapitres incorrect');
    for (const chapter of plan?.chapters || []) {
      const prefix = `chapitre ${chapter.chapter_id}`;
      const expected = expectedChapters.find((candidate: any) => Number(candidate?.chapter_id) === Number(chapter.chapter_id));
      if (!expected) issues.push(`${prefix}: chapter_id inattendu`);
      if (!chapter.diagnostic?.learning_obstacle || !chapter.diagnostic?.likely_misconception || !chapter.diagnostic?.cognitive_leap) issues.push(`${prefix}: diagnostic incomplet`);
      if (!frames.has(String(chapter.diagnostic?.epistemic_frame || ''))) issues.push(`${prefix}: cadre épistémique invalide`);
      if (!chapter.reformulation?.plain || !chapter.reformulation?.precise || !chapter.reformulation?.one_sentence_memory) issues.push(`${prefix}: reformulation incomplète`);
      if (!chapter.scenario?.observable_problem || !chapter.scenario?.student_question || !chapter.scenario?.debrief) issues.push(`${prefix}: mise en situation incomplète`);
      const mappings = chapter.analogy?.mappings || [];
      if (mappings.length < 2 || !chapter.analogy?.shared_mechanism || !chapter.analogy?.limit
        || mappings.some((mapping: any) => !mapping?.familiar || !mapping?.target || !mapping?.why)) issues.push(`${prefix}: analogie non démontrée ou sans limite`);
      const roles = chapter.visual_anchors?.map((anchor: any) => anchor.role) || [];
      for (const role of VISUAL_ANCHOR_ROLES) if (roles.filter((value: string) => value === role).length !== 1) issues.push(`${prefix}: rôle visuel ${role} absent ou dupliqué`);
      for (const anchor of chapter.visual_anchors || []) {
        if (!anchor.learning_job || !anchor.visual_concept || !anchor.composition) issues.push(`${prefix}/${anchor.role}: intention visuelle vague`);
        if (!modes.has(anchor.mode)) issues.push(`${prefix}/${anchor.role}: mode visuel invalide`);
        const segmentNames = new Set((expected?.segments || []).map((segment: any) => String(segment?.name || '').trim().toLocaleLowerCase('fr')));
        if (!segmentNames.has(String(anchor.linked_segment || '').trim().toLocaleLowerCase('fr'))) issues.push(`${prefix}/${anchor.role}: segment lié introuvable`);
        if (anchor.image_prompt_en.length < 120 || !anchor.negative_prompt_en || !anchor.alt_text_fr) issues.push(`${prefix}/${anchor.role}: prompt ou accessibilité insuffisant`);
        if ((anchor.must_show || []).length < 3 || (anchor.reject_if || []).length < 2) issues.push(`${prefix}/${anchor.role}: contrat de vérification visuelle incomplet`);
        if ((anchor.pictograms || []).length > 3 || (anchor.diagram?.nodes || []).length > 5 || (anchor.on_screen_text_fr || []).length > 3) issues.push(`${prefix}/${anchor.role}: charge visuelle excessive`);
        if ((anchor.on_screen_text_fr || []).some((line: string) => line.trim().split(/\s+/).length > 12)) issues.push(`${prefix}/${anchor.role}: texte écran trop long`);
      }
      const scores = ['fidelity', 'clarity', 'cognitive_load', 'transfer', 'cultural_respect', 'visual_specificity', 'non_decorative'];
      if (scores.some((key) => !Number.isFinite(Number(chapter.quality?.[key])))) issues.push(`${prefix}: auto-évaluation absente`);
      if (!String(chapter.quality?.weakness || '').trim()) issues.push(`${prefix}: faiblesse résiduelle non déclarée`);
    }
    return [...new Set(issues)];
  }

  private async callModel(userPrompt: string): Promise<ProviderResult> {
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    const deepseekKey = this.config.get<string>('DEEPSEEK_API_KEY');
    const mistralKey = this.config.get<string>('MISTRAL_API_KEY');
    const groqKey = this.config.get<string>('GROQ_API_KEY');
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    const providers: { provider: string; model: string; run: () => Promise<ProviderResult> }[] = [];

    if (anthropicKey && anthropicKey !== 'replace_me') {
      const model = this.config.get<string>('VISUAL_PEDAGOGY_ANTHROPIC_MODEL') || 'claude-sonnet-4-6';
      providers.push({ provider: 'anthropic', model, run: async () => {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model, max_tokens: 8000, temperature: 0.25, system: VISUAL_PEDAGOGY_SYSTEM_PROMPT, messages: [{ role: 'user', content: userPrompt }] }),
          signal: AbortSignal.timeout(90000),
        });
        if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 220)}`);
        const json: any = await res.json();
        const text = (json.content || []).filter((part: any) => part.type === 'text').map((part: any) => part.text).join('\n');
        return { payload: TranscriptCourseService.parseJsonLoose(text), provider: 'anthropic', model, tokensIn: Number(json.usage?.input_tokens || 0), tokensOut: Number(json.usage?.output_tokens || 0) };
      }});
    }
    const addOpenAiCompatible = (provider: string, url: string, key: string | undefined, model: string) => {
      if (!key || key === 'replace_me') return;
      providers.push({ provider, model, run: async () => {
        const res = await fetch(url, {
          method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: [{ role: 'system', content: VISUAL_PEDAGOGY_SYSTEM_PROMPT }, { role: 'user', content: userPrompt }], response_format: { type: 'json_object' }, max_tokens: 8000, temperature: 0.25 }),
          signal: AbortSignal.timeout(90000),
        });
        if (!res.ok) throw new Error(`${provider} ${res.status}: ${(await res.text()).slice(0, 220)}`);
        const json: any = await res.json();
        return { payload: TranscriptCourseService.parseJsonLoose(String(json.choices?.[0]?.message?.content || '')), provider, model, tokensIn: Number(json.usage?.prompt_tokens || 0), tokensOut: Number(json.usage?.completion_tokens || 0) };
      }});
    };
    addOpenAiCompatible('groq', 'https://api.groq.com/openai/v1/chat/completions', groqKey, this.config.get<string>('VISUAL_PEDAGOGY_GROQ_MODEL') || 'llama-3.3-70b-versatile');
    addOpenAiCompatible('mistral', 'https://api.mistral.ai/v1/chat/completions', mistralKey, this.config.get<string>('VISUAL_PEDAGOGY_MISTRAL_MODEL') || 'mistral-large-latest');
    addOpenAiCompatible('deepseek', 'https://api.deepseek.com/chat/completions', deepseekKey, this.config.get<string>('VISUAL_PEDAGOGY_DEEPSEEK_MODEL') || 'deepseek-v4-pro');
    addOpenAiCompatible('openai', 'https://api.openai.com/v1/chat/completions', openaiKey, this.config.get<string>('VISUAL_PEDAGOGY_OPENAI_MODEL') || 'gpt-4o');

    if (!providers.length) throw new ServiceUnavailableException('Aucun modèle IA configuré pour la pédagogie visuelle.');
    let last: Error | null = null;
    const failures: string[] = [];
    for (const provider of providers) {
      try { return await provider.run(); }
      catch (error) {
        last = error as Error;
        failures.push(`${provider.provider}/${provider.model}: ${last.message}`);
        this.log.warn(failures[failures.length - 1]);
      }
    }
    throw new ServiceUnavailableException(failures.slice(0, 5).join(' | ') || last?.message || 'Tous les modèles de pédagogie visuelle sont indisponibles.');
  }

  private async chargeBestEffort(tenantId: string, userId: string, usage: ProviderResult) {
    try {
      if (usage.tokensIn > 0) await this.billing.chargeUsage(tenantId, { function_name: 'master-factory-visual-pedagogy', provider: usage.provider, model: usage.model, unit_type: 'tokens_in', unit_amount: usage.tokensIn, user_id: userId });
      if (usage.tokensOut > 0) await this.billing.chargeUsage(tenantId, { function_name: 'master-factory-visual-pedagogy', provider: usage.provider, model: usage.model, unit_type: 'tokens_out', unit_amount: usage.tokensOut, user_id: userId });
    } catch (error) {
      this.log.warn(`Décompte IA visual pedagogy non enregistré : ${(error as Error).message}`);
    }
  }
}
