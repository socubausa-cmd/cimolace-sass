import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  Comprehension,
  CourseMindmap,
  CoursePivotPayload,
  LiveScenarioPivot,
  MasterScriptPivot,
  RenderTarget,
  SmartboardSketch,
  SmartboardTimelinePivot,
  SourceType,
} from './pivot.types';
import { ComprehensionService } from './comprehension.service';
import { CourseJobService } from './course-job.service';
import { RenderPivotService } from './render-pivot.service';
import { SourceAdaptersService } from './source-adapters.service';
import { VisualPedagogyService } from './visual-pedagogy.service';
import { PedagogyAiService } from './pedagogy-ai.service';
import type { PedagogyEnrichment } from './pedagogy-ai.service';

/**
 * Compteurs IA/gabarit du tableau. Ils ne figurent PAS dans le contrat partagé
 * `pivot.types.ts` : l'extension reste locale tant que ce contrat n'est pas
 * repris. Un lecteur qui n'attend que `model` continue donc de fonctionner.
 */
type SmartboardTimelineMeta = NonNullable<SmartboardTimelinePivot['meta']> & {
  ai_moments?: number;
  template_moments?: number;
  rejected_moments?: number;
  failed_moments?: number;
};

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
  private readonly log = new Logger(MasterFactoryService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly sources: SourceAdaptersService,
    private readonly comprehension: ComprehensionService,
    private readonly courseJobs: CourseJobService,
    private readonly renderPivot: RenderPivotService,
    private readonly visualPedagogy: VisualPedagogyService,
    private readonly pedagogyAi: PedagogyAiService,
  ) {}

  private get db(): any {
    return this.supabase.client as any;
  }

  /**
   * Un pivot déterministe de génération `v0` est périmé : ses scènes ne portent ni
   * le vocabulaire lu par le tableau vivant, ni `chapter_id`/`render_mode`, ni les
   * `slide_hint`/`objectives` du conducteur. Le cache ne doit donc PAS le servir —
   * sinon un cours déjà analysé resterait éternellement plat sans que personne ne
   * pense à passer `force`. La régénération est gratuite (aucun appel IA).
   *
   * ⚠️ La règle ne porte QUE sur le suffixe `-v0`. Un pivot produit par l'IA
   * (`pedagogy-ai-v1`) n'est donc PAS considéré comme périmé : il ne serait
   * sinon jeté et repayé à chaque lecture.
   */
  private static isStalePivot(model: string | null | undefined) {
    return /-v0$/.test(String(model || ''));
  }

  /** Inventaire des sources prêtes ou à préparer pour l'atelier unifié. */
  listSources(tenantId: string, sourceType: SourceType) {
    return this.sources.listSources(tenantId, sourceType);
  }

  /** Métadonnées d'une seule source, pour ouvrir un dossier direct sans attendre tout l'inventaire. */
  getSource(tenantId: string, sourceType: SourceType, sourceId: string) {
    return this.sources.getSource(tenantId, sourceType, sourceId);
  }

  ingestSource(tenantId: string, userId: string, input: Parameters<SourceAdaptersService['ingest']>[2]) {
    return this.sources.ingest(tenantId, userId, input);
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

  /** Projet éditable Masterclass Factory dérivé du pivot écrit, sans seconde IA. */
  renderMasterclassProject(tenantId: string, sourceType: SourceType, sourceId: string) {
    return this.renderPivot.renderMasterclassProject(tenantId, sourceType, sourceId);
  }

  renderPrecepteur(tenantId: string, sourceType: SourceType, sourceId: string) {
    return this.renderPivot.renderPrecepteur(tenantId, sourceType, sourceId);
  }

  renderManual(tenantId: string, sourceType: SourceType, sourceId: string) {
    return this.renderPivot.renderManual(tenantId, sourceType, sourceId);
  }

  /** Enrichissement coûteux mais mis en cache : diagnostic → analogie → briefs visuels. */
  enrichVisualPedagogy(
    tenantId: string,
    userId: string,
    sourceType: SourceType,
    sourceId: string,
    opts: { force?: boolean } = {},
  ) {
    return this.visualPedagogy.generate(tenantId, userId, sourceType, sourceId, opts);
  }

  reviewVisualImage(
    tenantId: string,
    userId: string,
    sourceType: SourceType,
    sourceId: string,
    input: { chapterId: number; role: string; status: string; imageUrl?: string; provider?: string; note?: string },
  ) {
    return this.visualPedagogy.reviewImage(tenantId, userId, sourceType, sourceId, input);
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
      if (existing && !MasterFactoryService.isStalePivot(existing.model)) {
        return { pivotId: existing.id, masterScript: existing.payload, cached: true };
      }
    }

    const masterScript = this.makeMasterScript(root.comprehension, root.pivotId);
    const pivotId = await this.replaceChildPivot({
      tenantId,
      sourceType,
      sourceId,
      parentId: root.pivotId,
      kind: 'master_script',
      payload: masterScript,
      model: 'deterministic-master-script-v1',
    });
    return { pivotId, masterScript, cached: false };
  }

  /**
   * Étape 2-C : transformer le Master Script en timeline de tableau vivant.
   *
   * `ai: true` fait écrire le CONTENU des scènes par `PedagogyAiService` au lieu
   * du gabarit. Sans cette option, le comportement est strictement inchangé —
   * et si l'IA ne produit rien d'exploitable, le gabarit reprend la main moment
   * par moment (le tableau sort toujours).
   */
  async buildSmartboardTimeline(
    tenantId: string,
    sourceType: SourceType,
    sourceId: string,
    opts: { force?: boolean; ai?: boolean; templateOnly?: boolean; expand?: boolean } = {},
  ) {
    const master = await this.buildMasterScript(tenantId, sourceType, sourceId, { force: false });
    const masterPivotId = master.pivotId;
    const wantsAi = opts.ai === true;
    const existing = await this.findChildPivot(masterPivotId, 'smartboard_timeline');
    if (!opts.force) {
      // Un pivot GABARIT ne satisfait pas une demande IA : sans ce test, la
      // première production déterministe figerait le tableau pour toujours.
      // L'inverse est permis — un pivot IA sert aussi une demande ordinaire.
      const usable =
        existing &&
        !MasterFactoryService.isStalePivot(existing.model) &&
        (!wantsAi || existing.model === PedagogyAiService.MODEL_TAG);
      if (usable) {
        return { pivotId: existing.id, smartboardTimeline: existing.payload, cached: true, ai: null };
      }
    }
    /**
     * ⛔ Un `force` ORDINAIRE NE DOIT PAS RÉTROGRADER UN TABLEAU IA.
     * Chaque publication passe par `buildLiveStack(force)` : sans cette garde,
     * publier un cours suffisait à remplacer par le gabarit un contenu payé et
     * relu — silencieusement. On rend donc le pivot IA tel quel. Le gabarit
     * reste joignable en le demandant explicitement (`templateOnly`).
     */
    if (!wantsAi && !opts.templateOnly && existing?.model === PedagogyAiService.MODEL_TAG) {
      this.log.log(
        `[master-factory] ${sourceType}/${sourceId} : tableau IA CONSERVÉ malgré force (pas de rétrogradation)`,
      );
      return { pivotId: existing.id, smartboardTimeline: existing.payload, cached: true, ai: null };
    }

    let enrichment: PedagogyEnrichment | null = null;
    if (wantsAi) {
      // La matière factuelle autorisée vit dans la compréhension (appuis) :
      // le Master Script seul ne suffit pas à nourrir la garde anti-invention.
      const root = await this.requireComprehension(tenantId, sourceType, sourceId);
      enrichment = await this.pedagogyAi.enrichScenes(
        tenantId,
        root.comprehension,
        (master.masterScript as MasterScriptPivot).moments,
      );
    }

    const built = this.makeSmartboardTimeline(
      master.masterScript as MasterScriptPivot,
      masterPivotId,
      enrichment,
    );
    /**
     * `expand` déroule chaque chapitre en plusieurs écrans. Opt-in tant que la
     * preuve E2E compare encore `scenes.length` à `moments.length` : l'activer
     * par défaut ferait échouer une assertion qui n'a rien de faux, juste
     * devenue obsolète. À basculer en défaut une fois cette preuve mise à jour.
     */
    const smartboardTimeline = opts.expand === true
      ? this.expandScenesByChapter(built)
      : built;
    const pivotId = await this.replaceChildPivot({
      tenantId,
      sourceType,
      sourceId,
      parentId: masterPivotId,
      kind: 'smartboard_timeline',
      payload: smartboardTimeline,
      // `enrichment.model` vaut null quand AUCUN moment n'a été produit par
      // l'IA : le pivot reste alors étiqueté gabarit, pour ne pas faire passer
      // un repli complet pour une production IA.
      model: enrichment?.model ?? 'deterministic-smartboard-timeline-v1',
    });
    return {
      pivotId,
      smartboardTimeline,
      cached: false,
      ai: enrichment
        ? {
            ai_moments: enrichment.ai_moments,
            template_moments: enrichment.template_moments,
            rejected_moments: enrichment.rejected_moments,
            failed_moments: enrichment.failed_moments,
            model: enrichment.model,
          }
        : null,
    };
  }

  /**
   * La mindmap est une vue gratuite du Master Script persistant. Elle n'est pas
   * un moteur concurrent : le même moment oral, la même branche et la même scène
   * SmartBoard partagent leurs identifiants.
   */
  async buildMindmap(tenantId: string, sourceType: SourceType, sourceId: string) {
    const master = await this.buildMasterScript(tenantId, sourceType, sourceId, { force: false });
    return {
      masterScriptPivotId: master.pivotId,
      mindmap: this.makeMindmap(master.masterScript as MasterScriptPivot, master.pivotId),
      cached: master.cached,
    };
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
    const mindmap = await this.buildMindmap(tenantId, sourceType, sourceId);
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
      // Troncatures rendues VISIBLES : un plafond silencieux (12 notions) est un
      // trou de contenu que l'appelant doit pouvoir signaler à l'enseignant.
      truncated: {
        master_script_notions:
          (masterScript.masterScript as MasterScriptPivot).meta?.truncated_notions ?? 0,
      },
      masterScript: masterScript.masterScript,
      mindmap: mindmap.mindmap,
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
    opts: { replaceExisting?: boolean; force?: boolean; allowDuringLive?: boolean } = {},
  ) {
    if (!liveSessionId) throw new BadRequestException('liveSessionId manquant');
    // Une session ne peut pas être sa propre source : la boucle écraserait le
    // contenu du direct par un dérivé de lui-même.
    if (sourceType === 'live' && sourceId === liveSessionId) {
      throw new BadRequestException('Une session ne peut pas être sa propre source de publication.');
    }
    const session = await this.assertLiveSessionBelongsToTenant(tenantId, liveSessionId);
    // Publier pendant un direct remplace le prompteur sous les yeux de l'hôte :
    // exigé explicitement, jamais par défaut.
    if (session.status === 'live' && opts.allowDuringLive !== true) {
      throw new BadRequestException(
        'Un direct est en cours sur cette session. Confirme explicitement le remplacement pendant le live.',
      );
    }

    const stack = await this.buildLiveStack(tenantId, sourceType, sourceId, { force: opts.force === true });
    const masterScript = stack.masterScript as MasterScriptPivot;
    const mindmap = stack.mindmap as CourseMindmap;
    const smartboard = stack.smartboardTimeline as SmartboardTimelinePivot;
    const liveScenario = stack.liveScenario as LiveScenarioPivot;

    const blueprint = {
      live_session_id: liveSessionId,
      outline_json: {
        title: liveScenario.live_title,
        description: masterScript.intention_generale,
        estimatedMinutes: masterScript.estimated_duration_minutes ?? null,
        chapters: mindmap.branches.map((branch) => ({
          id: branch.id,
          title: branch.label,
          key_points: branch.key_points,
          script_moment_id: branch.script_moment_id,
        })),
        source: { sourceType, sourceId },
        live_title: liveScenario.live_title,
        mindmap,
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
      // Aucun score n'est calculé : on n'invente pas une note flatteuse.
      blueprint_score: null,
    };

    const sceneRows = this.makeLiveSceneRows(liveSessionId, smartboard, liveScenario, masterScript);
    const scriptRows = this.makeLiveScriptRows(liveSessionId, userId, masterScript);

    // Le prompteur de l'arène lit `config.smartboard_master_script_sections`
    // (apps/app — liveHostSessionAndLiveKitInit / normalizeScriptSections) :
    // sans cette clé, l'hôte voit les MOCKS au lieu de son Master Script.
    const scriptSections = masterScript.moments.map((moment, index) => ({
      id: moment.id,
      slide_index: index,
      title: moment.title,
      content: moment.teacher_script,
      script: moment.teacher_script,
      objective: moment.intention,
      retention: moment.student_understanding || moment.transition || '',
    }));

    const configPatch = {
      ai_mindmap_enabled: true,
      smartboard_master_script_sections: scriptSections,
      master_factory: {
        source_type: sourceType,
        source_id: sourceId,
        pivots: stack.pivots,
        master_script_pivot_id: mindmap.meta.master_script_pivot_id,
      },
    };

    // Publication ATOMIQUE côté SQL : blueprint + scènes + prompteur + patch de
    // config partent dans une seule transaction (le merge du config se fait en
    // base, plus de read-modify-write perdant les écritures concurrentes). Une
    // erreur au milieu annule tout — plus de session à moitié équipée.
    const { data: rpcResult, error: rpcError } = await this.db.rpc('publish_master_factory_stack', {
      p_session_id: liveSessionId,
      p_blueprint: blueprint,
      p_scenes: sceneRows,
      p_scripts: scriptRows,
      p_config_patch: configPatch,
      p_replace: opts.replaceExisting === true,
    });
    if (rpcError) throw new ServiceUnavailableException(rpcError.message);

    const scenesInserted = Number((rpcResult as any)?.scenes_inserted ?? 0);
    const scriptSectionsInserted = Number((rpcResult as any)?.scripts_inserted ?? 0);

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

  private async assertLiveSessionBelongsToTenant(
    tenantId: string,
    liveSessionId: string,
  ): Promise<{ id: string; tenant_id: string; status: string | null }> {
    const { data, error } = await this.db
      .from('live_sessions')
      .select('id, tenant_id, status')
      .eq('id', liveSessionId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException(error.message);
    if (!data) throw new NotFoundException("Live introuvable pour ce tenant.");
    return data;
  }

  private async findChildPivot(parentId: string, kind: string) {
    // Des doublons historiques existent : `maybeSingle` sur 2 lignes est une
    // ERREUR Supabase — on prend la plus récente au lieu d'exploser.
    const { data, error } = await this.db
      .from('course_pivots')
      // `model` est indispensable : c'est lui qui révèle un pivot v0 périmé.
      .select('id, payload, model')
      .eq('parent_id', parentId)
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(1)
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
    // UPDATE en place plutôt que DELETE+INSERT : l'ancien enchaînement laissait
    // un trou si l'insert échouait après la suppression (pivot perdu).
    const now = new Date().toISOString();
    const { data: existing, error: findError } = await this.db
      .from('course_pivots')
      .select('id')
      .eq('parent_id', args.parentId)
      .eq('kind', args.kind)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findError) throw new ServiceUnavailableException(findError.message);

    if (existing?.id) {
      const { error: updateError } = await this.db
        .from('course_pivots')
        .update({ payload: args.payload, model: args.model, updated_at: now })
        .eq('id', existing.id);
      if (updateError) throw new ServiceUnavailableException(updateError.message);
      return existing.id as string;
    }

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
        updated_at: now,
      })
      .select('id')
      .single();
    if (error) {
      // Course avec une requête concurrente sur l'index unique : on reprend la
      // ligne gagnante et on la met à jour (même motif que renderPrecepteur).
      const isDuplicate = (error as any)?.code === '23505' || /duplicate/i.test(String(error.message || ''));
      if (isDuplicate) {
        const { data: concurrent, error: reError } = await this.db
          .from('course_pivots')
          .select('id')
          .eq('parent_id', args.parentId)
          .eq('kind', args.kind)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (reError) throw new ServiceUnavailableException(reError.message);
        if (concurrent?.id) {
          const { error: updateError } = await this.db
            .from('course_pivots')
            .update({ payload: args.payload, model: args.model, updated_at: now })
            .eq('id', concurrent.id);
          if (updateError) throw new ServiceUnavailableException(updateError.message);
          return concurrent.id as string;
        }
      }
      throw new ServiceUnavailableException(error.message);
    }
    return data.id as string;
  }

  private makeMasterScript(comprehension: Comprehension, comprehensionPivotId: string): MasterScriptPivot {
    const notions = comprehension.notions.slice(0, 12);
    // Troncature TRACÉE : au-delà de 12 notions, le surplus n'est pas perdu en
    // silence — le compte remonte jusqu'à la réponse de buildLiveStack.
    const truncatedNotions = Math.max(0, comprehension.notions.length - 12);
    const minutes = Math.max(15, Math.min(90, notions.length * 7));
    // Filtre défensif : des appuis corrompus (« K », « a ») ne doivent jamais
    // devenir des points-clés affichés à l'écran.
    const usableKeyPoint = (value: unknown) => String(value || '').trim().length >= 3;
    return {
      schema_version: 1,
      kind: 'master_script',
      title: comprehension.titre,
      audience: comprehension.public,
      intention_generale:
        comprehension.promesse ||
        "Transformer la source en explication claire, progressive et actionnable pour l'apprenant.",
      estimated_duration_minutes: minutes,
      moments: notions.map((notion, index) => {
        // Appuis nettoyés AVANT toute troncature : un fragment corrompu ne doit
        // ni être cité dans le prompteur, ni évincer un appui réel du slice.
        // ⚠️ Des pivots historiques portent `appuis` en CHAÎNE, pas en tableau —
        // c'est l'origine réelle des points « K »/« a » : un spread de chaîne
        // l'éclate caractère par caractère. On normalise donc en tableau ici.
        const rawAppuis: unknown[] = Array.isArray(notion.appuis)
          ? notion.appuis
          : notion.appuis
            ? [notion.appuis]
            : [];
        const usableAppuis = rawAppuis
          .map((appui) => String(appui || '').trim())
          .filter((appui) => usableKeyPoint(appui));
        return {
        id: `ms-${index + 1}`,
        notion_id: notion.id,
        title: notion.titre,
        intention: notion.pourquoi || `Faire comprendre ${notion.titre}.`,
        message_central: notion.idee_centrale,
        teacher_script: [
          `On aborde maintenant ${notion.titre}.`,
          notion.idee_centrale,
          notion.pourquoi ? `L'enjeu est simple : ${notion.pourquoi}` : null,
          usableAppuis[0] ? `Dans la source, on s'appuie sur ce repère : « ${usableAppuis[0]} ». ` : null,
          "Je vais le rendre concret, puis vérifier que le point est bien compris avant de continuer.",
        ]
          .filter(Boolean)
          .join(' '),
        key_points: [
          notion.idee_centrale,
          ...usableAppuis.slice(0, 2),
        ].filter(usableKeyPoint).map((point) => String(point).trim()).slice(0, 3),
        student_understanding: `L'élève doit pouvoir expliquer ${notion.titre} avec ses propres mots et l'appliquer dans un exemple.`,
        simple_version: notion.idee_centrale,
        /**
         * Contrat repris de l'ancien Academy (course-builder-pipeline-master-script) :
         * le conducteur oral doit dire AU PROF ce que le tableau montre au même
         * instant. Sans ce lien, le prompteur et le SmartBoard dérivent l'un de
         * l'autre pendant le direct.
         */
        slide_hint: `Le tableau affiche « ${notion.titre} » : l'idée centrale, puis les ${Math.max(1, usableAppuis.length)} repère(s) à retenir.`,
        objectives: [
          `Expliquer ${notion.titre} avec ses propres mots.`,
          notion.pourquoi ? `Savoir pourquoi ce point compte : ${notion.pourquoi}` : null,
        ].filter((objective): objective is string => !!objective),
        section_type:
          index === 0 ? 'introduction' : index === notions.length - 1 ? 'conclusion' : 'development',
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
        };
      }),
      meta: {
        source_kind: comprehension.meta.source_type,
        source_id: comprehension.meta.source_id,
        comprehension_pivot_id: comprehensionPivotId,
        generated_at: new Date().toISOString(),
        model: 'deterministic-master-script-v1',
        truncated_notions: truncatedNotions,
      },
    };
  }

  private makeMindmap(masterScript: MasterScriptPivot, masterScriptPivotId: string): CourseMindmap {
    const clean = (value: unknown) => String(value || '')
      .replace(/["\n\r]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const root = { id: 'mindmap-root', label: clean(masterScript.title) || 'Cours' };
    const branches = masterScript.moments.map((moment, index) => ({
      id: `mindmap-${index + 1}`,
      label: clean(moment.title) || `Partie ${index + 1}`,
      notion_id: moment.notion_id,
      key_points: (moment.key_points || []).map(clean).filter((point) => point.length >= 3).slice(0, 3),
      script_moment_id: moment.id,
    }));
    const mermaid = [
      'mindmap',
      `  root(("${root.label}"))`,
      ...branches.flatMap((branch) => [
        `    ("${branch.label}")`,
        ...branch.key_points.map((point) => `      ("${point}")`),
      ]),
    ].join('\n');
    return {
      schema_version: 1,
      kind: 'mindmap',
      title: `${root.label} — Carte mentale`,
      root,
      branches,
      edges: branches.map((branch) => ({ from: root.id, to: branch.id })),
      mermaid,
      meta: {
        master_script_pivot_id: masterScriptPivotId,
        generated_at: new Date().toISOString(),
        model: 'deterministic-mindmap-v1',
      },
    };
  }

  /**
   * `enrichment` (facultatif) porte le contenu écrit par l'IA, moment par
   * moment. Un moment absent de `enrichment.slides` garde EXACTEMENT le gabarit
   * déterministe : c'est le repli, il ne doit jamais changer.
   */
  private makeSmartboardTimeline(
    masterScript: MasterScriptPivot,
    masterScriptPivotId: string,
    enrichment?: PedagogyEnrichment | null,
  ): SmartboardTimelinePivot {
    const meta: SmartboardTimelineMeta = {
      master_script_pivot_id: masterScriptPivotId,
      generated_at: new Date().toISOString(),
      model: enrichment?.model ?? 'deterministic-smartboard-timeline-v1',
      ...(enrichment
        ? {
            ai_moments: enrichment.ai_moments,
            template_moments: enrichment.template_moments,
            rejected_moments: enrichment.rejected_moments,
            failed_moments: enrichment.failed_moments,
          }
        : {}),
    };
    return {
      schema_version: 1,
      kind: 'smartboard_timeline',
      title: `${masterScript.title} — Tableau vivant`,
      scenes: masterScript.moments.map((moment, index) => {
        const sceneId = `sb-${index + 1}`;
        const slide = enrichment?.slides?.[moment.id];
        /**
         * Le croquis et les `blocks` legacy suivent CE QUI EST RÉELLEMENT ÉCRIT
         * au tableau : les points de l'IA quand elle a produit, ceux du gabarit
         * sinon. Une slide IA volontairement sans développement (matière trop
         * maigre) laisse donc le croquis vide — on ne le regonfle pas.
         */
        const keyPoints = slide
          ? slide.development.flatMap((group) => group.points).slice(0, 3)
          : (moment.key_points || []).slice(0, 3);
        return {
          id: sceneId,
          script_moment_id: moment.id,
          chapter_id: index + 1,
          title: moment.title,
          visual_intent: `Faire respirer l'idée : ${moment.message_central}`,
          camera_zone: 'bottom-right',
          render_mode: 'progressive',
          /**
           * ⚠️ FORME LUE PAR LE RENDU — ne pas confondre avec `blocks`.
           * `ProgressiveBuildSlide` (apps/app/.../SlideParallaxStage.jsx) ne connaît
           * que ce vocabulaire : title/subtitle/core_idea/development/slide_summary.
           * Les `blocks` ci-dessous ont longtemps été publiés seuls — la scène
           * s'affichait donc vide en direct. On produit désormais les deux :
           * `gpt_slide` pour le tableau vivant, `blocks` pour les lecteurs legacy.
           */
          gpt_slide: {
            // ⚠️ Le titre AFFICHÉ peut être celui de l'IA (formulé comme une
            // idée) ; `scene.title` ci-dessus reste le titre court du moment,
            // car c'est lui qui nomme la scène dans la régie.
            title: slide?.title || moment.title,
            subtitle: slide?.subtitle || moment.intention || undefined,
            core_idea: slide?.core_idea || moment.message_central,
            development: slide
              ? slide.development
              : keyPoints.length
                ? [{ label: 'À retenir', points: keyPoints }]
                : [],
            slide_summary: slide?.slide_summary || moment.simple_version || moment.message_central,
            student_prompt: slide?.student_prompt || moment.interaction?.question,
            /**
             * LOI 5 — le schéma se DESSINE au tableau. Le croquis est DÉRIVÉ du
             * contenu (notion au centre, repères à retenir autour) : on ne
             * fabrique pas d'illustration décorative, on rend visible la
             * structure réelle du moment. Sans point à retenir, pas de croquis —
             * un schéma vide serait pire que pas de schéma.
             * Vocabulaire imposé par SketchRenderer : circle | point | arrow | label.
             */
            sketch: keyPoints.length
              ? {
                  caption: 'Structure du moment',
                  elements: [
                    { kind: 'circle', center: [50, 45], radius: 16, color: 'amber', label: moment.title },
                    ...keyPoints.map((point, i): SmartboardSketch['elements'][number] => {
                      // Répartition régulière autour du centre, en évitant le haut
                      // occupé par l'étiquette du cercle.
                      const angle = (Math.PI / 2) + ((i + 1) / (keyPoints.length + 1)) * Math.PI * 1.6;
                      const x = Math.round(50 + Math.cos(angle) * 34);
                      const y = Math.round(45 + Math.sin(angle) * 30);
                      return { kind: 'point', center: [x, y], color: 'blue', label: point.slice(0, 48) };
                    }),
                  ],
                }
              : undefined,
          },
          blocks: [
            { id: `${sceneId}-title`, type: 'title', text: slide?.title || moment.title },
            { id: `${sceneId}-idea`, type: 'key-idea', text: slide?.core_idea || moment.message_central },
            { id: `${sceneId}-retain`, type: 'retain', items: keyPoints },
            {
              id: `${sceneId}-prompt`,
              type: 'paragraph',
              text: slide?.student_prompt || moment.interaction?.question,
            },
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
      meta,
    };
  }

  /**
   * ÉCLATEMENT D'UN CHAPITRE EN PLUSIEURS ÉCRANS.
   *
   * Le tunnel publiait UNE scène par chapitre : le chapitre et l'écran étaient
   * confondus, alors que l'éditeur Masterclass déroule chaque chapitre en une
   * vingtaine de segments. Conséquences concrètes : le tableau devait tout dire
   * d'un coup, et l'interlude de reformulation n'avait jamais rien à récapituler.
   *
   * On déroule donc chaque moment selon la progression d'un professeur — poser
   * l'idée, la mettre en repères, vérifier — SANS inventer une ligne : chaque
   * écran ne reprend qu'une part de ce que le moment contient déjà. Un écran
   * dont la matière est absente n'est pas créé.
   *
   * ⚠️ LIMITE CONNUE : le prompteur reste à UNE section par moment (12 sections
   * pour 36 écrans). L'appariement scène↔section se fait par `order_index`, donc
   * seuls les premiers écrans retrouvent leur section ; les suivants narrent à
   * partir de leur propre contenu. À traiter en découpant aussi le Master Script.
   */
  private expandScenesByChapter(pivot: SmartboardTimelinePivot): SmartboardTimelinePivot {
    const scenes = pivot.scenes.flatMap((scene) => {
      const gpt = scene.gpt_slide;
      const points = gpt?.development?.flatMap((group) => group.points) ?? [];
      const parts: SmartboardTimelinePivot['scenes'] = [];
      const base = (suffix: string, over: Partial<SmartboardTimelinePivot['scenes'][number]>) => ({
        ...scene,
        ...over,
        id: `${scene.id}-${suffix}`,
      });

      // 1 — L'idée est posée, seule. C'est le moment où la voix explique.
      parts.push(base('idee', {
        gpt_slide: gpt ? { ...gpt, development: [], sketch: undefined } : undefined,
        // Le croquis n'a pas encore de sens : les repères ne sont pas donnés.
        blocks: scene.blocks.filter((b) => b.type === 'title' || b.type === 'key-idea'),
      }));

      // 2 — Les repères à retenir, avec le croquis qui les relie.
      if (points.length) {
        parts.push(base('reperes', {
          title: `${scene.title} — à retenir`,
          gpt_slide: gpt ? { ...gpt, student_prompt: undefined } : undefined,
          blocks: scene.blocks.filter((b) => b.type !== 'paragraph'),
        }));
      }

      // 3 — La vérification : on ne passe pas au suivant sans s'assurer.
      const prompt = gpt?.student_prompt;
      if (prompt) {
        parts.push(base('verification', {
          title: `${scene.title} — vérification`,
          gpt_slide: gpt ? { ...gpt, development: [], sketch: undefined, core_idea: prompt } : undefined,
          blocks: scene.blocks.filter((b) => b.type === 'title' || b.type === 'paragraph'),
        }));
      }

      // Un moment trop maigre pour être déroulé reste tel quel : mieux vaut un
      // seul écran honnête que trois écrans vides.
      return parts.length > 1 ? parts : [scene];
    });

    return { ...pivot, scenes, meta: { ...(pivot.meta ?? {}), expanded_scenes: scenes.length } as any };
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
    // Optionnel : sans conducteur, les scènes restent publiables — elles perdent
    // seulement `slide_hint`/`objectives`. Une signature stricte ferait échouer
    // toute la publication pour un enrichissement facultatif.
    masterScript?: MasterScriptPivot,
  ) {
    return smartboard.scenes.map((scene, index) => {
      const liveScene = liveScenario.scenes.find((s) => s.smartboard_scene_id === scene.id);
      const moment = (masterScript?.moments || []).find((m) => m.id === scene.script_moment_id);
      const chapterId = scene.chapter_id ?? index + 1;
      const renderMode = scene.render_mode ?? 'progressive';
      return {
        live_session_id: liveSessionId,
        name: scene.title || `Scène ${index + 1}`,
        scene_type: 'smartboard',
        order_index: index,
        is_active: index === 0,
        chapter_id: chapterId,
        render_mode: renderMode,
        // Narration produite plus tard par SceneAudioService : une scène = un audio.
        audio_url: null,
        content_payload_json: {
          source: 'master_factory',
          live_scenario_scene_id: liveScene?.id,
          script_moment_id: scene.script_moment_id,
          chapter_id: chapterId,
          render_mode: renderMode,
          slide_hint: moment?.slide_hint,
          objectives: moment?.objectives,
          audio_url: null,
          /**
           * `ia_data` est ce que lit le tableau vivant : on y verse la slide au
           * vocabulaire du rendu. Auparavant `core_idea` recevait `visual_intent`
           * (une consigne de mise en scène, « Faire respirer l'idée… ») et le
           * développement n'existait pas — d'où des scènes quasi vides en direct.
           */
          ia_data: {
            ...(scene.gpt_slide ?? {
              title: scene.title,
              core_idea: scene.visual_intent,
              development: [],
            }),
            scene_type: 'progressive_build',
            render_mode: renderMode,
            chapter_id: chapterId,
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
