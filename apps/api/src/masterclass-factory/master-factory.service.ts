import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  Comprehension,
  CoursePivotPayload,
  LiveScenarioPivot,
  MasterScriptPivot,
  RenderTarget,
  SmartboardTimelinePivot,
  SourceType,
} from './pivot.types';
import { ComprehensionService } from './comprehension.service';
import { CourseJobService } from './course-job.service';
import { RenderPivotService } from './render-pivot.service';
import { SourceAdaptersService } from './source-adapters.service';

/**
 * MASTER FACTORY — façade d'orchestration.
 *
 * Ce service ne remplace pas les moteurs existants : il devient leur porte
 * d'entrée officielle. Les anciens endpoints peuvent continuer à vivre, mais
 * ils doivent progressivement appeler cette façade au lieu de relire une source
 * et de refaire leur propre intelligence.
 *
 * Chaîne cible :
 *   Source → Comprehension → Master Script → SmartBoard → Live / Cours / Replay
 */
@Injectable()
export class MasterFactoryService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly sources: SourceAdaptersService,
    private readonly comprehension: ComprehensionService,
    private readonly courseJobs: CourseJobService,
    private readonly renderPivot: RenderPivotService,
  ) {}

  private get db(): any {
    return this.supabase.client as any;
  }

  /** Inventaire des sources prêtes ou à préparer pour l'atelier unifié. */
  listSources(tenantId: string, sourceType: SourceType) {
    return this.sources.listSources(tenantId, sourceType);
  }

  /**
   * Étape 1 : comprendre une source. C'est le seul endroit autorisé à produire
   * le fond invariant (`kind = comprehension`).
   */
  understandSource(
    tenantId: string,
    sourceType: SourceType,
    sourceId: string,
    opts: { force?: boolean } = {},
  ) {
    return this.comprehension.build(tenantId, sourceType, sourceId, opts);
  }

  /**
   * Étape 2-A : demander un cours écrit/parcours. Le worker actuel reste le
   * producteur réel, mais l'appel passe par la façade pour figer la direction.
   */
  requestWrittenCourse(
    tenantId: string,
    userId: string,
    sourceType: SourceType,
    sourceId: string,
    opts: { force?: boolean } = {},
  ) {
    return this.courseJobs.requestAny(tenantId, userId, sourceType, sourceId, opts);
  }

  /** État des formes/rendus déjà disponibles pour une source. */
  status(tenantId: string, sourceType: SourceType, sourceId: string) {
    return this.renderPivot.status(tenantId, sourceType, sourceId);
  }

  /** Rendu PDF gratuit depuis le pivot écrit, sans nouveau coût IA. */
  renderPdf(tenantId: string, sourceType: SourceType, sourceId: string) {
    return this.renderPivot.renderPdf(tenantId, sourceType, sourceId);
  }

  /** Étape 2-B : construire le conducteur oral officiel depuis la compréhension. */
  async buildMasterScript(
    tenantId: string,
    sourceType: SourceType,
    sourceId: string,
    opts: { force?: boolean } = {},
  ) {
    const root = await this.requireComprehension(tenantId, sourceType, sourceId);
    if (!opts.force) {
      const existing = await this.findChildPivot(root.pivotId, 'master_script');
      if (existing) return { pivotId: existing.id, masterScript: existing.payload, cached: true };
    }

    const masterScript = this.makeMasterScript(root.comprehension, root.pivotId);
    const pivotId = await this.replaceChildPivot({
      tenantId,
      sourceType,
      sourceId,
      parentId: root.pivotId,
      kind: 'master_script',
      payload: masterScript,
      model: 'deterministic-master-script-v0',
    });
    return { pivotId, masterScript, cached: false };
  }

  /** Étape 2-C : transformer le Master Script en timeline de tableau vivant. */
  async buildSmartboardTimeline(
    tenantId: string,
    sourceType: SourceType,
    sourceId: string,
    opts: { force?: boolean } = {},
  ) {
    const master = await this.buildMasterScript(tenantId, sourceType, sourceId, { force: false });
    const masterPivotId = master.pivotId;
    if (!opts.force) {
      const existing = await this.findChildPivot(masterPivotId, 'smartboard_timeline');
      if (existing) return { pivotId: existing.id, smartboardTimeline: existing.payload, cached: true };
    }

    const smartboardTimeline = this.makeSmartboardTimeline(master.masterScript as MasterScriptPivot, masterPivotId);
    const pivotId = await this.replaceChildPivot({
      tenantId,
      sourceType,
      sourceId,
      parentId: masterPivotId,
      kind: 'smartboard_timeline',
      payload: smartboardTimeline,
      model: 'deterministic-smartboard-timeline-v0',
    });
    return { pivotId, smartboardTimeline, cached: false };
  }

  /** Étape 2-D : produire le scénario Liri Live pilotable depuis le script + smartboard. */
  async buildLiveScenario(
    tenantId: string,
    sourceType: SourceType,
    sourceId: string,
    opts: { force?: boolean } = {},
  ) {
    const master = await this.buildMasterScript(tenantId, sourceType, sourceId, { force: false });
    const smartboard = await this.buildSmartboardTimeline(tenantId, sourceType, sourceId, { force: false });
    if (!opts.force) {
      const existing = await this.findChildPivot(master.pivotId, 'live_scenario');
      if (existing) return { pivotId: existing.id, liveScenario: existing.payload, cached: true };
    }

    const liveScenario = this.makeLiveScenario(
      master.masterScript as MasterScriptPivot,
      smartboard.smartboardTimeline as SmartboardTimelinePivot,
      master.pivotId,
      smartboard.pivotId,
    );
    const pivotId = await this.replaceChildPivot({
      tenantId,
      sourceType,
      sourceId,
      parentId: master.pivotId,
      kind: 'live_scenario',
      payload: liveScenario,
      model: 'deterministic-live-scenario-v0',
    });
    return { pivotId, liveScenario, cached: false };
  }

  /** Convenience : chaîne complète pour préparer Liri Live depuis une source déjà comprise. */
  async buildLiveStack(
    tenantId: string,
    sourceType: SourceType,
    sourceId: string,
    opts: { force?: boolean } = {},
  ) {
    const masterScript = await this.buildMasterScript(tenantId, sourceType, sourceId, opts);
    const smartboardTimeline = await this.buildSmartboardTimeline(tenantId, sourceType, sourceId, opts);
    const liveScenario = await this.buildLiveScenario(tenantId, sourceType, sourceId, opts);
    return {
      ok: true,
      source: { sourceType, sourceId },
      pivots: {
        master_script: masterScript.pivotId,
        smartboard_timeline: smartboardTimeline.pivotId,
        live_scenario: liveScenario.pivotId,
      },
      cached: {
        master_script: masterScript.cached,
        smartboard_timeline: smartboardTimeline.cached,
        live_scenario: liveScenario.cached,
      },
      masterScript: masterScript.masterScript,
      smartboardTimeline: smartboardTimeline.smartboardTimeline,
      liveScenario: liveScenario.liveScenario,
    };
  }

  /**
   * Publie la chaîne vivante dans une vraie session Liri Live.
   *
   * Tables alimentées :
   * - live_blueprints       : contexte / objectifs / notes
   * - live_scenes           : scènes SmartBoard lisibles par la régie
   * - live_script_sections  : Master Script / prompteur hôte
   */
  async publishLiveStackToSession(
    tenantId: string,
    userId: string,
    sourceType: SourceType,
    sourceId: string,
    liveSessionId: string,
    opts: { replaceExisting?: boolean; force?: boolean } = {},
  ) {
    if (!liveSessionId) throw new BadRequestException('liveSessionId manquant');
    await this.assertLiveSessionBelongsToTenant(tenantId, liveSessionId);

    const stack = await this.buildLiveStack(tenantId, sourceType, sourceId, { force: opts.force === true });
    const masterScript = stack.masterScript as MasterScriptPivot;
    const smartboard = stack.smartboardTimeline as SmartboardTimelinePivot;
    const liveScenario = stack.liveScenario as LiveScenarioPivot;

    const blueprint = {
      live_session_id: liveSessionId,
      outline_json: {
        source: { sourceType, sourceId },
        live_title: liveScenario.live_title,
        scenes: liveScenario.scenes.map((s) => ({
          id: s.id,
          order: s.order,
          type: s.type,
          script_moment_id: s.script_moment_id,
          smartboard_scene_id: s.smartboard_scene_id,
        })),
      },
      goals_json: {
        intention: masterScript.intention_generale,
        audience: masterScript.audience,
        waiting_room_message: liveScenario.waiting_room_message,
        closing_sequence: liveScenario.closing_sequence,
      },
      key_points_json: masterScript.moments.flatMap((m) => m.key_points.slice(0, 2)).slice(0, 12),
      private_notes: liveScenario.preparation_notes.join('\n'),
      estimated_duration_minutes: masterScript.estimated_duration_minutes ?? null,
      blueprint_score: 92,
    };
    const { error: blueprintError } = await this.db
      .from('live_blueprints')
      .upsert(blueprint, { onConflict: 'live_session_id' });
    if (blueprintError) throw new ServiceUnavailableException(blueprintError.message);

    if (opts.replaceExisting) {
      await this.db.from('live_scenes').delete().eq('live_session_id', liveSessionId);
      await this.db.from('live_script_sections').delete().eq('session_id', liveSessionId);
    }

    const sceneRows = this.makeLiveSceneRows(liveSessionId, smartboard, liveScenario);
    const scriptRows = this.makeLiveScriptRows(liveSessionId, userId, masterScript);

    let scenesInserted = 0;
    if (sceneRows.length) {
      const { data: existingScenes } = await this.db
        .from('live_scenes')
        .select('id')
        .eq('live_session_id', liveSessionId)
        .limit(1);
      if (opts.replaceExisting || !(existingScenes || []).length) {
        const { error } = await this.db.from('live_scenes').insert(sceneRows);
        if (error) throw new ServiceUnavailableException(error.message);
        scenesInserted = sceneRows.length;
      }
    }

    let scriptSectionsInserted = 0;
    if (scriptRows.length) {
      const { data: existingScripts } = await this.db
        .from('live_script_sections')
        .select('id')
        .eq('session_id', liveSessionId)
        .limit(1);
      if (opts.replaceExisting || !(existingScripts || []).length) {
        const { error } = await this.db.from('live_script_sections').insert(scriptRows);
        if (error) throw new ServiceUnavailableException(error.message);
        scriptSectionsInserted = scriptRows.length;
      }
    }

    return {
      ok: true,
      liveSessionId,
      source: { sourceType, sourceId },
      pivots: stack.pivots,
      published: {
        blueprint: true,
        live_scenes: scenesInserted,
        live_script_sections: scriptSectionsInserted,
      },
      skipped: {
        live_scenes: scenesInserted === 0,
        live_script_sections: scriptSectionsInserted === 0,
      },
    };
  }

  private async requireComprehension(tenantId: string, sourceType: SourceType, sourceId: string) {
    if (!sourceId) throw new BadRequestException('sourceId manquant');
    const { data, error } = await this.db
      .from('course_pivots')
      .select('id, payload')
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('kind', 'comprehension')
      .is('parent_id', null)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException(error.message);
    if (!data?.payload) {
      throw new NotFoundException("Cette source n'a pas encore de pivot comprehension. Lance d'abord /master-factory/understand.");
    }
    return { pivotId: data.id as string, comprehension: data.payload as Comprehension };
  }

  private async assertLiveSessionBelongsToTenant(tenantId: string, liveSessionId: string) {
    const { data, error } = await this.db
      .from('live_sessions')
      .select('id, tenant_id')
      .eq('id', liveSessionId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException(error.message);
    if (!data) throw new NotFoundException("Live introuvable pour ce tenant.");
  }

  private async findChildPivot(parentId: string, kind: string) {
    const { data, error } = await this.db
      .from('course_pivots')
      .select('id, payload')
      .eq('parent_id', parentId)
      .eq('kind', kind)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException(error.message);
    return data ?? null;
  }

  private async replaceChildPivot(args: {
    tenantId: string;
    sourceType: SourceType;
    sourceId: string;
    parentId: string;
    kind: Exclude<string, 'comprehension'>;
    payload: CoursePivotPayload;
    model: string;
  }) {
    await this.db.from('course_pivots').delete().eq('parent_id', args.parentId).eq('kind', args.kind);
    const { data, error } = await this.db
      .from('course_pivots')
      .insert({
        tenant_id: args.tenantId,
        source_type: args.sourceType,
        source_id: args.sourceId,
        kind: args.kind,
        parent_id: args.parentId,
        payload: args.payload,
        model: args.model,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) throw new ServiceUnavailableException(error.message);
    return data.id as string;
  }

  private makeMasterScript(comprehension: Comprehension, comprehensionPivotId: string): MasterScriptPivot {
    const notions = comprehension.notions.slice(0, 12);
    const minutes = Math.max(15, Math.min(90, notions.length * 7));
    return {
      schema_version: 1,
      kind: 'master_script',
      title: comprehension.titre,
      audience: comprehension.public,
      intention_generale:
        comprehension.promesse ||
        "Transformer la source en explication claire, progressive et actionnable pour l'apprenant.",
      estimated_duration_minutes: minutes,
      moments: notions.map((notion, index) => ({
        id: `ms-${index + 1}`,
        notion_id: notion.id,
        title: notion.titre,
        intention: notion.pourquoi || `Faire comprendre ${notion.titre}.`,
        message_central: notion.idee_centrale,
        teacher_script: [
          `On aborde maintenant ${notion.titre}.`,
          notion.idee_centrale,
          notion.pourquoi ? `L'enjeu est simple : ${notion.pourquoi}` : null,
          notion.appuis?.[0] ? `Dans la source, on s'appuie sur ce repère : « ${notion.appuis[0]} ». ` : null,
          "Je vais le rendre concret, puis vérifier que le point est bien compris avant de continuer.",
        ]
          .filter(Boolean)
          .join(' '),
        key_points: [
          notion.idee_centrale,
          ...(notion.appuis || []).slice(0, 2),
        ].filter(Boolean).slice(0, 3),
        student_understanding: `L'élève doit pouvoir expliquer ${notion.titre} avec ses propres mots et l'appliquer dans un exemple.`,
        simple_version: notion.idee_centrale,
        transition:
          index < notions.length - 1
            ? `Ce point prépare ${notions[index + 1].titre}.`
            : "On peut maintenant conclure et transformer ces idées en action.",
        duration_sec: 360,
        interaction: {
          question: `Peux-tu reformuler l'idée principale de « ${notion.titre} » ?`,
          expected_answers: [notion.idee_centrale].filter(Boolean),
          remediation: `Revenir à l'appui source principal et redonner un exemple simple.`,
        },
      })),
      meta: {
        source_kind: comprehension.meta.source_type,
        source_id: comprehension.meta.source_id,
        comprehension_pivot_id: comprehensionPivotId,
        generated_at: new Date().toISOString(),
        model: 'deterministic-master-script-v0',
      },
    };
  }

  private makeSmartboardTimeline(masterScript: MasterScriptPivot, masterScriptPivotId: string): SmartboardTimelinePivot {
    return {
      schema_version: 1,
      kind: 'smartboard_timeline',
      title: `${masterScript.title} — Tableau vivant`,
      scenes: masterScript.moments.map((moment, index) => {
        const sceneId = `sb-${index + 1}`;
        return {
          id: sceneId,
          script_moment_id: moment.id,
          title: moment.title,
          visual_intent: `Faire respirer l'idée : ${moment.message_central}`,
          camera_zone: 'bottom-right',
          blocks: [
            { id: `${sceneId}-title`, type: 'title', text: moment.title },
            { id: `${sceneId}-idea`, type: 'key-idea', text: moment.message_central },
            { id: `${sceneId}-retain`, type: 'retain', items: moment.key_points.slice(0, 3) },
            { id: `${sceneId}-prompt`, type: 'paragraph', text: moment.interaction?.question },
          ],
          timeline: [
            { id: `${sceneId}-a1`, at_sec: 0, type: 'write', target_id: `${sceneId}-title`, duration_sec: 4 },
            { id: `${sceneId}-a2`, at_sec: 5, type: 'show', target_id: `${sceneId}-idea`, duration_sec: 3 },
            { id: `${sceneId}-a3`, at_sec: 12, type: 'highlight', target_id: `${sceneId}-idea`, duration_sec: 5 },
            { id: `${sceneId}-a4`, at_sec: 20, type: 'draw', target_id: `${sceneId}-retain`, duration_sec: 8 },
            { id: `${sceneId}-a5`, at_sec: 34, type: 'student_prompt', target_id: `${sceneId}-prompt`, duration_sec: 12 },
          ],
        };
      }),
      meta: {
        master_script_pivot_id: masterScriptPivotId,
        generated_at: new Date().toISOString(),
        model: 'deterministic-smartboard-timeline-v0',
      },
    };
  }

  private makeLiveScenario(
    masterScript: MasterScriptPivot,
    smartboard: SmartboardTimelinePivot,
    masterScriptPivotId: string,
    smartboardPivotId: string,
  ): LiveScenarioPivot {
    const targets: RenderTarget[] = ['parcours', 'video_semaine', 'quiz', 'forum', 'precepteur'];
    return {
      schema_version: 1,
      kind: 'live_scenario',
      live_title: masterScript.title,
      preparation_notes: [
        "Ouvrir la salle 5 minutes avant.",
        "Vérifier micro, caméra, SmartBoard et salle d'attente.",
        "Suivre le Master Script, mais reformuler si les élèves bloquent.",
      ],
      waiting_room_message: `Bienvenue. Le live « ${masterScript.title} » va commencer. Préparez de quoi noter une question.`,
      closing_sequence:
        "Résumer les trois idées principales, demander une reformulation aux élèves, puis annoncer les supports post-live.",
      scenes: masterScript.moments.map((moment, index) => ({
        id: `live-${index + 1}`,
        order: index + 1,
        type: index === 0 ? 'intro' : 'teaching',
        script_moment_id: moment.id,
        smartboard_scene_id: smartboard.scenes[index]?.id,
        host_instruction: `Présenter « ${moment.title} », puis déclencher le tableau vivant et poser la question de vérification.`,
        student_action: moment.interaction?.question,
        duration_minutes: Math.max(4, Math.round((moment.duration_sec || 360) / 60)),
      })),
      replay_postprod_targets: targets,
      meta: {
        master_script_pivot_id: masterScriptPivotId,
        smartboard_timeline_pivot_id: smartboardPivotId,
        generated_at: new Date().toISOString(),
        model: 'deterministic-live-scenario-v0',
      },
    };
  }

  private makeLiveSceneRows(
    liveSessionId: string,
    smartboard: SmartboardTimelinePivot,
    liveScenario: LiveScenarioPivot,
  ) {
    return smartboard.scenes.map((scene, index) => {
      const liveScene = liveScenario.scenes.find((s) => s.smartboard_scene_id === scene.id);
      return {
        live_session_id: liveSessionId,
        name: scene.title || `Scène ${index + 1}`,
        scene_type: 'smartboard',
        order_index: index,
        is_active: index === 0,
        content_payload_json: {
          source: 'master_factory',
          live_scenario_scene_id: liveScene?.id,
          script_moment_id: scene.script_moment_id,
          ia_data: {
            title: scene.title,
            core_idea: scene.visual_intent,
            camera_zone: scene.camera_zone,
            timeline: scene.timeline,
            blocks: scene.blocks,
          },
          smartboard_timeline_scene: scene,
        },
      };
    });
  }

  private makeLiveScriptRows(liveSessionId: string, userId: string, masterScript: MasterScriptPivot) {
    return masterScript.moments.map((moment, index) => ({
      session_id: liveSessionId,
      created_by: userId,
      slide_index: index,
      order_index: index,
      title: moment.title,
      content: [
        `【Intention du slide】\n${moment.intention}`,
        `【Message central】\n${moment.message_central}`,
        `【Discours du professeur】\n${moment.teacher_script}`,
        moment.key_points.length ? `【Grandes idées à insister】\n${moment.key_points.map((k) => `• ${k}`).join('\n')}` : null,
        moment.student_understanding ? `【Ce que l'élève doit comprendre】\n${moment.student_understanding}` : null,
        moment.transition ? `【Transition】\n${moment.transition}` : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      master_agent: {
        slide_title: moment.title,
        intention: moment.intention,
        message_central: moment.message_central,
        teacher_script: moment.teacher_script,
        key_points: moment.key_points,
        student_understanding: moment.student_understanding,
        transition: moment.transition,
        simple_version: moment.simple_version,
        interaction: moment.interaction,
      },
    }));
  }
}
